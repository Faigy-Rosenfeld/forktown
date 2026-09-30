// Renders the live stream's intermission reel (docs/INTERMISSION_REEL.md): "We’ll be right back"
// and every live-break ad, one MP4 each, plus manifest.json for the stream box's transmitter.
//
//   npm run render:intermission -- --out <dir> [--only <id>]
//
// Pictures come from tests/manual/breaks.html in headless Chrome (window.breakRender draws the same
// 320×180 frame /live/ shows, scaled 4× with no smoothing), frame by frame at t = k/15, so the
// render is exact and independent of the machine's speed. Sound is rendered here in Node with the
// cinema's own mixer. FFmpeg joins them. Node-side rules: import only cinema.ts, break-cards.ts
// and cinema-render.ts from src/ (nothing that reaches places.ts or arrivals.ts).
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer as createNetServer, type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';
import {
  BREAK_CARDS,
  REEL_SEGMENTS,
  type CardArtwork,
  type Playable,
  type ReelSegment,
} from '../src/lib/break-cards';
import { CINEMA_ADS } from '../src/lib/cinema';
import { renderCinemaPCM } from '../src/music/cinema-render';
import {
  JPEG_QUALITY,
  MANIFEST_FILE,
  REEL_FPS,
  RENDER_USAGE,
  chromeCandidates,
  compareSegments,
  encodeWav,
  ffmpegArgs,
  formatSeconds,
  frameCount,
  parseDevToolsActivePort,
  parseRenderArgs,
  reelManifest,
  segmentFile,
  segmentSource,
  selectSegments,
} from './render-intermission-lib';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PAGE = '/tests/manual/breaks.html';
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Keeps the last few KB of a child's stderr for error messages, and never lets the pipe fill. */
function tail(stream: NodeJS.ReadableStream | null) {
  let text = '';
  stream?.on('data', (chunk: Buffer) => {
    text = (text + chunk.toString()).slice(-4000);
  });
  return () => text.trim();
}

function exited(child: ChildProcess) {
  return new Promise<number | null>((done) => {
    if (child.exitCode !== null || child.signalCode !== null) done(child.exitCode);
    else child.once('close', (code) => done(code));
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${what} took longer than ${ms / 1000} s`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const probe = createNetServer();
    probe.once('error', fail);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => done(port));
    });
  });
}

// ---- A minimal Chrome DevTools Protocol client over Node's global WebSocket.

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void };
type CdpMessage = {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { message: string };
  sessionId?: string;
};

class Cdp {
  private next = 0;
  private readonly pending = new Map<number, Pending>();
  private readonly listeners = new Map<string, ((params: Record<string, unknown>) => void)[]>();
  private closed: Error | null = null;

  private constructor(private readonly socket: WebSocket) {
    socket.addEventListener('message', (event) => this.receive(String(event.data)));
    socket.addEventListener('close', () =>
      this.fail(new Error('Chrome closed the DevTools connection')),
    );
  }

  static connect(url: string): Promise<Cdp> {
    return new Promise((done, fail) => {
      const socket = new WebSocket(url);
      socket.addEventListener('open', () => done(new Cdp(socket)), { once: true });
      socket.addEventListener('error', () => fail(new Error(`Could not open ${url}`)), {
        once: true,
      });
    });
  }

  send<T = unknown>(method: string, params: object = {}, sessionId?: string): Promise<T> {
    if (this.closed) return Promise.reject(this.closed);
    const id = ++this.next;
    this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    });
  }

  on(method: string, listener: (params: Record<string, unknown>) => void) {
    this.listeners.set(method, [...(this.listeners.get(method) ?? []), listener]);
  }

  close() {
    this.fail(new Error('DevTools connection closed'));
    this.socket.close();
  }

  private receive(text: string) {
    const message = JSON.parse(text) as CdpMessage;
    if (message.id === undefined) {
      for (const listener of this.listeners.get(message.method ?? '') ?? []) {
        listener(message.params ?? {});
      }
      return;
    }
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.error) pending.reject(new Error(message.error.message));
    else pending.resolve(message.result);
  }

  private fail(error: Error) {
    this.closed ??= error;
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}

type Evaluated = {
  result: { value?: unknown };
  exceptionDetails?: { text: string; exception?: { description?: string } };
};

// ---- The render.

const cleanups: (() => void | Promise<void>)[] = [];
async function cleanUp() {
  while (cleanups.length) {
    try {
      await cleanups.pop()!();
    } catch (error) {
      console.warn(`Cleanup: ${errorText(error)}`);
    }
  }
}

function findChrome(): string {
  const candidates = chromeCandidates(process.platform, process.env);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(
      `No Chrome or Edge found. Set CHROME_PATH to a Chromium browser. Looked in:\n  ${candidates.join('\n  ')}`,
    );
  }
  return found;
}

function checkFfmpeg() {
  const probe = spawnSync(FFMPEG, ['-hide_banner', '-version'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (probe.error || probe.status !== 0) {
    throw new Error(`ffmpeg did not run (${FFMPEG}). Install it on PATH or set FFMPEG_PATH.`);
  }
  return probe.stdout.split('\n')[0].trim();
}

function playableFor(segment: ReelSegment): Playable {
  const source = segmentSource(segment);
  if (source.kind === 'card') {
    const card = BREAK_CARDS[source.card as CardArtwork];
    if (!card) throw new Error(`No break card called ${source.card}`);
    return card;
  }
  const ad = CINEMA_ADS.find((candidate) => candidate.artwork === source.artwork);
  if (!ad) throw new Error(`No cinema ad with the artwork ${source.artwork}`);
  return ad;
}

async function startVite(work: string): Promise<{ server: ViteDevServer; origin: string }> {
  const port = await freePort();
  const server = await createServer({
    configFile: join(ROOT, 'vite.config.ts'),
    root: ROOT,
    // A private dependency cache, so a dev server already running here is never disturbed.
    cacheDir: join(work, 'vite'),
    optimizeDeps: { entries: [PAGE.slice(1)] },
    server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
    logLevel: 'warn',
    clearScreen: false,
  });
  cleanups.push(() => server.close());
  await server.listen();
  return { server, origin: `http://127.0.0.1:${port}` };
}

async function startChrome(work: string) {
  const path = findChrome();
  const profile = mkdtempSync(join(work, 'chrome-'));
  const chrome = spawn(
    path,
    [
      '--headless=new',
      `--user-data-dir=${profile}`,
      '--remote-debugging-port=0',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--mute-audio',
      '--hide-scrollbars',
      '--force-color-profile=srgb',
      '--window-size=1400,1000',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true },
  );
  const stderr = tail(chrome.stderr);
  const gone = exited(chrome);
  cleanups.push(async () => {
    if (chrome.exitCode === null && chrome.signalCode === null) {
      chrome.kill();
      await withTimeout(gone, 5000, 'Chrome shutting down').catch(() => chrome.kill('SIGKILL'));
    }
  });
  const file = join(profile, 'DevToolsActivePort');
  const deadline = Date.now() + 30_000;
  let endpoint: ReturnType<typeof parseDevToolsActivePort> = null;
  while (!endpoint) {
    if (chrome.exitCode !== null)
      throw new Error(`Chrome exited (${chrome.exitCode}): ${stderr()}`);
    if (Date.now() > deadline) throw new Error(`Chrome never wrote ${file}: ${stderr()}`);
    await sleep(100);
    try {
      endpoint = parseDevToolsActivePort(readFileSync(file, 'utf8'));
    } catch {
      // Not written yet.
    }
  }
  const cdp = await Cdp.connect(`ws://127.0.0.1:${endpoint.port}${endpoint.path}`);
  cleanups.push(async () => {
    await withTimeout(cdp.send('Browser.close'), 3000, 'Browser.close').catch(() => {});
    cdp.close();
    await withTimeout(gone, 5000, 'Chrome shutting down').catch(() => {});
  });
  return { cdp, path };
}

async function openPage(cdp: Cdp, url: string) {
  const { targetId } = await cdp.send<{ targetId: string }>('Target.createTarget', {
    url: 'about:blank',
  });
  const { sessionId } = await cdp.send<{ sessionId: string }>('Target.attachToTarget', {
    targetId,
    flatten: true,
  });
  const problems: string[] = [];
  cdp.on('Runtime.exceptionThrown', (params) => {
    const details = params.exceptionDetails as Evaluated['exceptionDetails'];
    problems.push(details?.exception?.description ?? details?.text ?? 'exception');
  });
  cdp.on('Runtime.consoleAPICalled', (params) => {
    if (params.type !== 'error') return;
    const args = (params.args as { value?: unknown; description?: string }[]) ?? [];
    problems.push(args.map((arg) => String(arg.value ?? arg.description ?? '')).join(' '));
  });
  cdp.on('Inspector.targetCrashed', () => problems.push('The page crashed'));
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Inspector.enable', {}, sessionId).catch(() => {});

  const evaluate = async <T>(expression: string, timeout = 60_000): Promise<T> => {
    const reply = await withTimeout(
      cdp.send<Evaluated>(
        'Runtime.evaluate',
        { expression, awaitPromise: true, returnByValue: true },
        sessionId,
      ),
      timeout,
      'The page',
    );
    if (reply.exceptionDetails) {
      const { text, exception } = reply.exceptionDetails;
      throw new Error(exception?.description ?? text);
    }
    return reply.result.value as T;
  };

  // The first visit can race Vite's dependency optimizer, so a failed load gets two more tries.
  for (let attempt = 1; ; attempt++) {
    problems.length = 0;
    try {
      await cdp.send('Page.navigate', { url }, sessionId);
      const deadline = Date.now() + 60_000;
      while (
        !(await evaluate<boolean>(`typeof window.breakRender === 'object'`).catch(() => false))
      ) {
        if (Date.now() > deadline) throw new Error('window.breakRender never appeared');
        await sleep(200);
      }
      await evaluate(`window.breakRender.ready.then(() => true)`, 90_000);
      return { evaluate };
    } catch (error) {
      const detail = problems.length ? `\n  ${problems.slice(0, 5).join('\n  ')}` : '';
      if (attempt >= 3) throw new Error(`${PAGE} did not get ready: ${errorText(error)}${detail}`);
      console.warn(`${PAGE} did not get ready (${errorText(error)}); trying again.${detail}`);
      await sleep(1000);
    }
  }
}

/** Writes one frame; if ffmpeg exits instead of draining, fails with its exit code and stderr. */
function writeChunk(
  stream: NodeJS.WritableStream,
  chunk: Buffer,
  done: Promise<number | null>,
  failure: (code: number | null) => string,
) {
  if (stream.write(chunk)) return Promise.resolve();
  return Promise.race([
    new Promise<void>((resolve) => stream.once('drain', () => resolve())),
    done.then((code) => {
      throw new Error(failure(code));
    }),
  ]);
}

async function renderSegment(
  segment: ReelSegment,
  out: string,
  work: string,
  evaluate: <T>(expression: string, timeout?: number) => Promise<T>,
) {
  const frames = frameCount(segment.duration);
  const wav = join(work, `${segment.id}.wav`);
  writeFileSync(wav, encodeWav(renderCinemaPCM(playableFor(segment))));
  const output = join(out, segmentFile(segment.id));
  const partial = join(out, `${segment.id}.rendering.mp4`);
  const ffmpeg = spawn(FFMPEG, ffmpegArgs({ wav, output: partial, duration: segment.duration }), {
    stdio: ['pipe', 'ignore', 'pipe'],
    windowsHide: true,
  });
  const stderr = tail(ffmpeg.stderr);
  const done = exited(ffmpeg);
  ffmpeg.stdin!.on('error', () => {}); // An early exit shows up as the exit code below.
  const kill = () => {
    if (ffmpeg.exitCode === null) ffmpeg.kill('SIGKILL');
    rmSync(partial, { force: true });
  };
  cleanups.push(kill);

  const id = JSON.stringify(segment.id);
  const grab = (k: number) => {
    const frame = evaluate<string>(
      `(() => { window.breakRender.draw(${id}, ${k} / ${REEL_FPS});` +
        ` return document.getElementById('render').toDataURL('image/jpeg', ${JPEG_QUALITY}); })()`,
    );
    frame.catch(() => {}); // Awaited below; this only keeps an abandoned frame from shouting.
    return frame;
  };
  // Chrome draws frame k+1 while this process hands frame k to ffmpeg.
  let next = grab(0);
  for (let k = 0; k < frames; k++) {
    const url = await next;
    if (k + 1 < frames) next = grab(k + 1);
    const prefix = 'data:image/jpeg;base64,';
    if (typeof url !== 'string' || !url.startsWith(prefix)) {
      throw new Error(`${segment.id} frame ${k}: the page did not return a JPEG`);
    }
    await writeChunk(
      ffmpeg.stdin!,
      Buffer.from(url.slice(prefix.length), 'base64'),
      done,
      (code) => `ffmpeg stopped early on ${segment.id} (exit ${code}): ${stderr()}`,
    );
  }
  ffmpeg.stdin!.end();
  const code = await done;
  if (code !== 0) throw new Error(`ffmpeg failed on ${segment.id} (exit ${code}): ${stderr()}`);
  renameSync(partial, output);
  cleanups.splice(cleanups.indexOf(kill), 1);
  rmSync(wav, { force: true });
  return frames;
}

async function main() {
  let args;
  try {
    args = parseRenderArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${errorText(error)}\n\n${RENDER_USAGE}`);
    process.exitCode = 2;
    return;
  }
  if (args.help || args.out === null) {
    console.log(RENDER_USAGE);
    return;
  }
  const started = performance.now();
  const segments = selectSegments(REEL_SEGMENTS, args.only);
  const out = resolve(args.out);
  mkdirSync(out, { recursive: true });
  console.log(`ffmpeg: ${checkFfmpeg()}`);

  const work = mkdtempSync(join(tmpdir(), 'forktown-reel-'));
  cleanups.push(() =>
    rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }),
  );
  const { origin } = await startVite(work);
  const { cdp, path } = await startChrome(work);
  console.log(`Chrome: ${path}`);
  const { evaluate } = await openPage(cdp, `${origin}${PAGE}`);
  const problems = compareSegments(
    REEL_SEGMENTS,
    await evaluate<ReelSegment[]>('window.breakRender.segments()'),
  );
  if (problems.length) {
    throw new Error(`The page and this script disagree on the reel:\n  ${problems.join('\n  ')}`);
  }
  const ready = performance.now();
  console.log(`Ready in ${formatSeconds((ready - started) / 1000)}. Rendering to ${out}`);

  const rendered = new Set<string>();
  let frames = 0;
  for (const segment of segments) {
    const from = performance.now();
    frames += await renderSegment(segment, out, work, evaluate);
    rendered.add(segment.id);
    const took = (performance.now() - from) / 1000;
    console.log(
      `  ${segment.id.padEnd(24)} ${String(segment.duration).padStart(3)} s  ` +
        `${String(segment.duration * REEL_FPS).padStart(4)} frames  ${formatSeconds(took)}`,
    );
  }

  const manifestPath = join(out, MANIFEST_FILE);
  let previous: unknown = null;
  try {
    previous = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    // No earlier manifest (or an unreadable one): list only what exists now.
  }
  const { manifest, missing } = reelManifest(
    REEL_SEGMENTS,
    rendered,
    new Date().toISOString(),
    previous,
    (file) => existsSync(join(out, file)),
  );
  writeFileSync(`${manifestPath}.tmp`, `${JSON.stringify(manifest, null, 2)}\n`);
  renameSync(`${manifestPath}.tmp`, manifestPath);
  const total = (performance.now() - started) / 1000;
  const seconds = manifest.segments.reduce((sum, segment) => sum + segment.duration, 0);
  console.log(
    `Wrote ${manifestPath}: ${manifest.segments.length} segments, ${seconds} s of reel. ` +
      `${frames} frames in ${formatSeconds((performance.now() - ready) / 1000)} ` +
      `(${formatSeconds(total)} in all).`,
  );
  if (missing.length) {
    console.warn(`Not in the manifest yet (render them without --only): ${missing.join(', ')}`);
  }
}

process.once('SIGINT', () => {
  console.error('Interrupted.');
  void cleanUp().finally(() => process.exit(130));
});

try {
  await main();
} catch (error) {
  console.error(errorText(error));
  process.exitCode = 1;
} finally {
  await cleanUp();
}
