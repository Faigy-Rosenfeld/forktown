import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  REEL_FPS,
  REEL_GAIN,
  SEGMENT_ID,
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
} from '../scripts/render-intermission-lib';
import {
  BREAK_CARDS,
  LIVE_BREAK_ADS,
  REEL_SEGMENTS,
  type ReelSegment,
} from '../src/lib/break-cards';

// The offline reel renderer's pure half. The render itself needs Chrome and FFmpeg, so it is run
// by hand (docs/INTERMISSION_REEL.md); everything it decides is checked here.

const SEGMENTS: ReelSegment[] = [
  { id: 'right-back', kind: 'card', duration: 12, interruptibleAfter: 3 },
  { id: 'ad-eggs', kind: 'ad', duration: 10 },
  { id: 'ad-zoo', kind: 'ad', duration: 30 },
];
const AT = '2026-09-30T06:00:00.000Z';

describe('render:intermission arguments', () => {
  it.each([
    [['--out', 'reel'], { out: 'reel', only: null, help: false }],
    [['--out=C:/x y/reel'], { out: 'C:/x y/reel', only: null, help: false }],
    [['--out', 'r', '--only', 'right-back'], { out: 'r', only: ['right-back'], help: false }],
    [
      ['--only', 'ad-zoo,right-back', '--out', 'r', '--only=ad-zoo', '--only', ' ad-eggs '],
      { out: 'r', only: ['ad-zoo', 'right-back', 'ad-eggs'], help: false },
    ],
    [['--help'], { out: null, only: null, help: true }],
    [['-h', '--out', 'r'], { out: 'r', only: null, help: true }],
  ])('%j', (argv, expected) => {
    expect(parseRenderArgs(argv)).toEqual(expected);
  });

  it.each([
    [[], /--out <dir> is required/],
    [['--out'], /--out needs a value/],
    [['--out', '--only', 'x'], /--out needs a value/],
    [['--out='], /--out needs a value/],
    [['--out', 'a', '--out', 'b'], /twice/],
    [['--out', 'a', '--only', ','], /--only needs a segment id/],
    [['--out', 'a', 'extra'], /Unknown argument: extra/],
    [['--fps', '30'], /Unknown argument: --fps/],
  ])('rejects %j', (argv, message) => {
    expect(() => parseRenderArgs(argv)).toThrow(message);
  });
});

describe('The reel segments', () => {
  it('are right-back and then every live-break ad, each a whole number of frames', () => {
    expect(REEL_SEGMENTS[0]).toEqual({
      id: 'right-back',
      kind: 'card',
      duration: BREAK_CARDS['right-back'].duration,
      interruptibleAfter: 3,
    });
    expect(REEL_SEGMENTS.slice(1).map((segment) => segmentSource(segment))).toEqual(
      LIVE_BREAK_ADS.map((ad) => ({ kind: 'ad', artwork: ad.artwork })),
    );
    for (const segment of REEL_SEGMENTS) {
      expect(segment.id).toMatch(SEGMENT_ID);
      expect(segmentFile(segment.id)).toMatch(/^[a-z0-9-]+\.mp4$/);
      expect(frameCount(segment.duration)).toBe(segment.duration * REEL_FPS);
    }
    expect(segmentSource(REEL_SEGMENTS[0])).toEqual({ kind: 'card', card: 'right-back' });
  });

  it('frames run 0…n−1, so a loop never shows its first frame twice', () => {
    expect(frameCount(12)).toBe(180);
    expect(frameCount(0.2)).toBe(3);
    expect(() => frameCount(10.05)).toThrow(/whole number of frames/);
    expect(() => frameCount(0)).toThrow();
  });

  it('--only picks segments in reel order and names the real ones for a typo', () => {
    expect(selectSegments(SEGMENTS, null)).toEqual(SEGMENTS);
    expect(selectSegments(SEGMENTS, ['ad-zoo', 'right-back']).map((s) => s.id)).toEqual([
      'right-back',
      'ad-zoo',
    ]);
    expect(() => selectSegments(SEGMENTS, ['ad-zo'])).toThrow(
      'Unknown segment ad-zo. The reel has: right-back, ad-eggs, ad-zoo.',
    );
  });

  it('must match what the preview page reports, id, kind, length and cut point', () => {
    expect(
      compareSegments(
        SEGMENTS,
        SEGMENTS.map((s) => ({ ...s })),
      ),
    ).toEqual([]);
    expect(
      compareSegments(SEGMENTS, [
        { id: 'right-back', kind: 'card', duration: 12 },
        { id: 'ad-eggs', kind: 'ad', duration: 20 },
      ]),
    ).toEqual([
      'segment 0: Node has right-back card 12 s from 3 s, the page has right-back card 12 s',
      'segment 1: Node has ad-eggs ad 10 s, the page has ad-eggs ad 20 s',
      'segment 2: Node has ad-zoo ad 30 s, the page has nothing',
    ]);
  });

  it('refuses ids that could leave the reel folder', () => {
    for (const id of ['../x', 'Right-Back', 'a b', 'ad-', '']) {
      expect(() => segmentFile(id)).toThrow(/plain slug/);
    }
    expect(() => segmentSource({ id: 'eggs', kind: 'ad' })).toThrow(/ad-/);
  });
});

describe('manifest.json', () => {
  it('lists every rendered segment in reel order, in the shape the stream box validates', () => {
    const { manifest, missing } = reelManifest(
      SEGMENTS,
      new Set(['ad-zoo', 'right-back', 'ad-eggs']),
      AT,
    );
    expect(missing).toEqual([]);
    expect(manifest).toEqual({
      version: 1,
      fps: 15,
      width: 1280,
      height: 720,
      renderedAt: AT,
      segments: [
        {
          id: 'right-back',
          kind: 'card',
          file: 'right-back.mp4',
          duration: 12,
          interruptibleAfter: 3,
        },
        { id: 'ad-eggs', kind: 'ad', file: 'ad-eggs.mp4', duration: 10 },
        { id: 'ad-zoo', kind: 'ad', file: 'ad-zoo.mp4', duration: 30 },
      ],
    });
    expect(Object.keys(manifest.segments[1])).not.toContain('interruptibleAfter');
  });

  it('with --only keeps earlier segments that are unchanged and still on disk', () => {
    const full = reelManifest(SEGMENTS, new Set(SEGMENTS.map((s) => s.id)), AT).manifest;
    const onDisk = new Set(['right-back.mp4', 'ad-zoo.mp4']);
    const later = '2026-10-01T06:00:00.000Z';
    // ad-eggs.mp4 is gone; ad-zoo is still there and still 30 s.
    const { manifest, missing } = reelManifest(
      SEGMENTS,
      new Set(['right-back']),
      later,
      JSON.parse(JSON.stringify(full)),
      (file) => onDisk.has(file),
    );
    expect(manifest.renderedAt).toBe(later);
    expect(manifest.segments.map((s) => s.id)).toEqual(['right-back', 'ad-zoo']);
    expect(missing).toEqual(['ad-eggs']);

    // An ad that got longer since the last render must be rendered again, not listed stale.
    const longer = SEGMENTS.map((s) => (s.id === 'ad-zoo' ? { ...s, duration: 20 } : s));
    expect(reelManifest(longer, new Set(['right-back']), later, full, () => true).missing).toEqual([
      'ad-zoo',
    ]);
    // A manifest from another frame size or rate keeps nothing.
    expect(
      reelManifest(SEGMENTS, new Set(['right-back']), later, { ...full, fps: 30 }, () => true)
        .missing,
    ).toEqual(['ad-eggs', 'ad-zoo']);
    // Nor does junk.
    expect(reelManifest(SEGMENTS, new Set(), later, 'junk', () => true).missing).toEqual([
      'right-back',
      'ad-eggs',
      'ad-zoo',
    ]);
  });
});

describe('The reel soundtrack WAV', () => {
  it('is 16-bit stereo PCM at the mix rate, scaled by the reel gain and clamped', () => {
    const left = new Float32Array([0, 1, -1, 2, Number.NaN]);
    const right = new Float32Array([0.5, -0.5, 0.25, -3, 0]);
    const wav = encodeWav({ left, right, sampleRate: 24000 });
    const view = new DataView(wav.buffer);
    const text = (at: number) => String.fromCharCode(...wav.slice(at, at + 4));
    expect(wav.length).toBe(44 + 5 * 4);
    expect([text(0), text(8), text(12), text(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data']);
    expect(view.getUint32(4, true)).toBe(wav.length - 8);
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(24000);
    expect(view.getUint32(28, true)).toBe(24000 * 4);
    expect(view.getUint16(32, true)).toBe(4);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(5 * 4);
    const samples = Array.from({ length: 10 }, (_, i) => view.getInt16(44 + i * 2, true));
    const s = (value: number) => Math.round(value * REEL_GAIN * 32767);
    expect(samples).toEqual([0, s(0.5), s(1), s(-0.5), s(-1), s(0.25), 32767, -32767, 0, 0]);
    expect(REEL_GAIN).toBe(0.55);
  });
});

describe('The ffmpeg command', () => {
  const args = ffmpegArgs({
    wav: 'C:/tmp/a b.wav',
    output: 'C:/out/ad-zoo.rendering.mp4',
    duration: 30,
  });
  const after = (flag: string) => args[args.indexOf(flag) + 1];

  it('reads JPEG frames on stdin at 15 fps and the WAV as the second input', () => {
    expect(args.slice(args.indexOf('-f'), args.indexOf('-f') + 8)).toEqual([
      '-f',
      'image2pipe',
      '-framerate',
      '15',
      '-c:v',
      'mjpeg',
      '-i',
      'pipe:0',
    ]);
    expect(args.filter((_, i) => args[i - 1] === '-i')).toEqual(['pipe:0', 'C:/tmp/a b.wav']);
  });

  it('writes 1280×720 H.264 yuv420p and AAC 44.1 kHz stereo 128k, exactly as long, moov first', () => {
    expect(after('-vf')).toContain('scale=1280:720');
    expect(after('-vf')).toContain('format=yuv420p');
    expect(args.join(' ')).toContain('-c:v libx264');
    expect(after('-r')).toBe('15');
    expect(after('-c:a')).toBe('aac');
    expect(after('-b:a')).toBe('128k');
    expect(after('-ar')).toBe('44100');
    expect(after('-ac')).toBe('2');
    expect(after('-t')).toBe('30');
    expect(after('-movflags')).toBe('+faststart');
    expect(args.slice(-3)).toEqual(['-f', 'mp4', 'C:/out/ad-zoo.rendering.mp4']);
  });
});

describe('Finding Chrome', () => {
  it('on Windows: CHROME_PATH, Chrome in each Program Files and LOCALAPPDATA, then Edge', () => {
    const env = {
      chrome_path: 'D:/Portable/chrome.exe',
      PROGRAMFILES: 'C:\\Program Files',
      'ProgramFiles(x86)': 'C:\\Program Files (x86)',
      LocalAppData: 'C:\\Users\\me\\AppData\\Local',
      PATH: 'C:\\Windows',
    };
    expect(chromeCandidates('win32', env)).toEqual([
      'D:/Portable/chrome.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Users\\me\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Users\\me\\AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe',
    ]);
    expect(chromeCandidates('win32', {})).toEqual([]);
  });

  it('on a Mac the app bundles come first; elsewhere the usual names on PATH', () => {
    const mac = chromeCandidates('darwin', { PATH: '/opt/homebrew/bin' });
    expect(mac.slice(0, 3)).toEqual([
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ]);
    expect(mac).toContain('/opt/homebrew/bin/chromium');
    const linux = chromeCandidates('linux', {
      PATH: '/usr/local/bin:/usr/bin::/usr/bin',
      CHROME_PATH: '/snap/bin/chromium',
    });
    expect(linux[0]).toBe('/snap/bin/chromium');
    expect(linux.slice(1, 4)).toEqual([
      '/usr/local/bin/google-chrome-stable',
      '/usr/bin/google-chrome-stable',
      '/usr/local/bin/google-chrome',
    ]);
    expect(linux).toContain('/usr/bin/chrome-headless-shell');
    expect(new Set(linux).size).toBe(linux.length);
    expect(chromeCandidates('linux', {})).toContain('/usr/bin/chromium');
  });

  it('reads the DevTools port and browser path Chrome writes to the profile', () => {
    expect(parseDevToolsActivePort('53117\n/devtools/browser/4f1c-9a\n')).toEqual({
      port: 53117,
      path: '/devtools/browser/4f1c-9a',
    });
    expect(parseDevToolsActivePort('9222\r\n/devtools/browser/x\r\n')).toEqual({
      port: 9222,
      path: '/devtools/browser/x',
    });
    for (const text of [
      '',
      '53117',
      '53117\n',
      'x\n/devtools/browser/a',
      '0\n/devtools/browser/a',
    ]) {
      expect(parseDevToolsActivePort(text)).toBeNull();
    }
    expect(parseDevToolsActivePort('53117\n/json/version')).toBeNull();
  });
});

describe('The renderer stays Node-safe', () => {
  // Value imports only; a type import is erased and never runs.
  const IMPORT = /^\s*(?:import|export)\s+(?!type\s)[^'"]*?from\s+['"](\.[^'"]+)['"]/gm;
  const resolveImport = (file: string, from: string) => {
    const base = join(dirname(file), from);
    return [base, `${base}.ts`, join(base, 'index.ts')].find(
      (path) => existsSync(path) && statSync(path).isFile(),
    );
  };
  const reach = (entry: string) => {
    const seen = new Set<string>();
    const queue = [entry];
    while (queue.length) {
      const file = queue.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      for (const [, from] of readFileSync(file, 'utf8').matchAll(IMPORT)) {
        const target = resolveImport(file, from);
        if (target) queue.push(target);
      }
    }
    return [...seen].map((file) => relative('.', file).replaceAll('\\', '/'));
  };

  it('imports from src/ only cinema.ts, break-cards.ts and cinema-render.ts', () => {
    const direct = [
      ...readFileSync('scripts/render-intermission.ts', 'utf8').matchAll(IMPORT),
      ...readFileSync('scripts/render-intermission-lib.ts', 'utf8').matchAll(IMPORT),
    ]
      .map(([, from]) => from)
      .filter((from) => from.includes('/src/'));
    expect(new Set(direct)).toEqual(
      new Set(['../src/lib/break-cards', '../src/lib/cinema', '../src/music/cinema-render']),
    );
  });

  it('never reaches places.ts, arrivals.ts or live-breaks.ts (they need Vite defines)', () => {
    const reached = reach('scripts/render-intermission.ts');
    expect(reached).toContain('src/music/cinema-render.ts');
    expect(
      reached.filter((file) => /src\/lib\/(places|arrivals|live-breaks)\.ts$/.test(file)),
    ).toEqual([]);
  });
});

it('formats render times', () => {
  expect(formatSeconds(4.56)).toBe('4.6 s');
  expect(formatSeconds(125.4)).toBe('2 min 05 s');
});
