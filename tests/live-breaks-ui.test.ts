import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BREAK_CARDS, LIVE_BREAK_ADS } from '../src/lib/break-cards';
import {
  DEFAULT_BREAK_MINUTES,
  nextBreakAfter,
  welcomeTimeline,
  type BreakItem,
  type WelcomeStep,
} from '../src/lib/live-breaks';
import {
  forcedStart,
  installLiveHarness,
  playableOf,
  upcomingPlayable,
  welcomeEarliest,
  welcomeFallback,
  welcomePhase,
  type ForktownLive,
} from '../src/lib/live-harness';
import { FUNKY_FUN, HOMES } from './fixtures';

// The /live/ page's breaks, as far as node can see them: the pure bookkeeping the page runs on
// (welcome timing, forced starts, sound warm-up, the window API) and the wiring in its source.

const T0 = Date.UTC(2026, 8, 29);
const source = (file: string) => readFileSync(file, 'utf8');
/** The text of the block that starts at `start`, up to `end`. */
function block(text: string, start: string, end: string) {
  const from = text.indexOf(start);
  expect(from, start).toBeGreaterThan(-1);
  return text.slice(from, text.indexOf(end, from));
}

describe('The welcome’s timing', () => {
  const mount = T0 + 5_000;

  it('goes off two seconds after the page opens, or thirty when it waits for the box', () => {
    expect(welcomeFallback(mount, false)).toBe(mount + 2_000);
    expect(welcomeFallback(mount, true)).toBe(mount + 30_000);
  });

  it('waits for its trigger, then for the films, for ten seconds at most', () => {
    const trigger = mount + 2_000;
    expect(welcomeEarliest(trigger, mount + 1_000, trigger - 1)).toBeNull();
    // Films already there: straight away.
    expect(welcomeEarliest(trigger, mount + 1_000, trigger)).toBe(trigger);
    // Films arrive after the trigger: half a second after them.
    expect(welcomeEarliest(trigger, null, trigger + 3_000)).toBeNull();
    expect(welcomeEarliest(trigger, trigger + 4_000, trigger + 4_000)).toBe(trigger + 4_500);
    // Still loading ten seconds on: the welcome goes ahead without them.
    expect(welcomeEarliest(trigger, null, trigger + 9_999)).toBeNull();
    expect(welcomeEarliest(trigger, null, trigger + 10_000)).toBe(trigger + 10_000);
  });

  it('never moves once decided, whenever the films settle later', () => {
    const trigger = mount + 2_000;
    const decided = welcomeEarliest(trigger, null, trigger + 12_000);
    for (const settledAt of [null, trigger + 11_000, trigger + 60_000])
      for (const ms of [trigger + 12_000, trigger + 30_000, trigger + 600_000])
        expect(welcomeEarliest(trigger, settledAt, ms)).toBe(decided);
    const early = welcomeEarliest(trigger, trigger + 1_000, trigger + 1_000);
    for (const ms of [trigger + 2_000, trigger + 100_000])
      expect(welcomeEarliest(trigger, trigger + 1_000, ms)).toBe(early);
  });

  it('reports none, armed, scheduled, showing and done', () => {
    const steps = welcomeTimeline(['funky-fun'], T0 + 400_000, HOMES, [], {}, null);
    expect(steps.map((step) => step.kind)).toEqual(['card', 'hold']);
    const [card, hold] = steps;
    expect(welcomePhase(false, null, [], card.start)).toBe('none');
    expect(welcomePhase(true, null, [], card.start)).toBe('armed');
    expect(welcomePhase(true, T0, steps, card.start - 1)).toBe('scheduled');
    expect(welcomePhase(true, T0, steps, card.start)).toBe('showing');
    expect(welcomePhase(true, T0, steps, hold.end - 1)).toBe('showing');
    expect(welcomePhase(true, T0, steps, hold.end)).toBe('done');
    // Nobody could be placed: nothing left to do.
    expect(welcomePhase(true, T0, [], T0)).toBe('done');
  });
});

describe('A forced item', () => {
  it('starts two seconds in, and half a second after the films are ready', () => {
    expect(forcedStart(T0, null)).toBeNull();
    expect(forcedStart(T0, T0 + 300)).toBe(T0 + 2_000);
    expect(forcedStart(T0, T0 + 4_000)).toBe(T0 + 4_500);
  });
});

describe('Sound ahead of a break', () => {
  const eggs: BreakItem = { kind: 'ad', ad: LIVE_BREAK_ADS.find((ad) => ad.artwork === 'eggs')! };
  const base = {
    places: HOMES,
    minutes: null as number | null,
    forced: null as { item: BreakItem; start: number } | null,
    welcome: [] as WelcomeStep[],
    mountedAt: T0 - 600_000,
  };

  it('plays the ad or the card itself', () => {
    expect(playableOf(eggs)).toBe(eggs.kind === 'ad' && eggs.ad);
    expect(playableOf({ kind: 'card', card: BREAK_CARDS.neighbors })).toBe(BREAK_CARDS.neighbors);
  });

  it('warms a forced item or a welcome card up to fifteen seconds ahead, never after it starts', () => {
    const forced = { item: eggs, start: T0 + 20_000 };
    const at = (ms: number) => upcomingPlayable({ ...base, ms, forced });
    expect(at(T0 + 4_000)).toBeNull();
    expect(at(T0 + 5_000)).toBe(playableOf(eggs));
    expect(at(T0 + 19_999)).toBe(playableOf(eggs));
    expect(at(T0 + 20_000)).toBeNull();
    const welcome = welcomeTimeline([FUNKY_FUN.id], T0 + 400_000, HOMES, [], {}, null);
    const card = welcome[0];
    expect(upcomingPlayable({ ...base, ms: card.start - 10_000, welcome })).toBe(
      BREAK_CARDS.welcome,
    );
    // The hold has no sound of its own.
    expect(upcomingPlayable({ ...base, ms: card.end - 5_000, welcome })).toBeNull();
    // Before the box starts it, the welcome's first card will begin the moment it is placed.
    expect(upcomingPlayable({ ...base, ms: T0, welcomeArmed: true })).toBe(BREAK_CARDS.welcome);
    expect(
      upcomingPlayable({ ...base, ms: card.start - 10_000, welcome, welcomeArmed: false }),
    ).toBe(BREAK_CARDS.welcome);
  });

  it('warms the scheduled break only when breaks are on and the page will air it', () => {
    const found = nextBreakAfter(T0, HOMES, DEFAULT_BREAK_MINUTES)!;
    expect(found).not.toBeNull();
    const ms = found.start - 10_000;
    const minutes = DEFAULT_BREAK_MINUTES;
    expect(upcomingPlayable({ ...base, ms })).toBeNull();
    expect(upcomingPlayable({ ...base, ms, minutes })).toBe(playableOf(found.item));
    expect(upcomingPlayable({ ...base, ms: found.start - 16_000, minutes })).toBeNull();
    // A page that opened just before it skips that break, so there is nothing to warm.
    expect(upcomingPlayable({ ...base, ms, minutes, mountedAt: found.start - 14_000 })).toBeNull();
  });

  it('picks whichever starts first', () => {
    const found = nextBreakAfter(T0, HOMES, DEFAULT_BREAK_MINUTES)!;
    const ms = found.start - 12_000;
    const forced = { item: eggs, start: found.start - 1_000 };
    const neighbors = { kind: 'card', card: BREAK_CARDS.neighbors } as const;
    expect(upcomingPlayable({ ...base, ms, minutes: DEFAULT_BREAK_MINUTES, forced })).toBe(
      playableOf(eggs),
    );
    expect(
      upcomingPlayable({
        ...base,
        ms,
        minutes: DEFAULT_BREAK_MINUTES,
        forced: { item: neighbors, start: found.start + 1_000 },
      }),
    ).toBe(playableOf(found.item));
  });
});

describe('window.forktownLive', () => {
  afterEach(() => vi.unstubAllGlobals());
  const api = (label: string): ForktownLive => ({
    version: 1,
    build: { sha: label, builtAt: '2026-09-30T00:00:00.000Z' },
    quietFor: (seconds) => seconds < 10,
    startWelcome: () => label === 'on',
    state: () => ({
      shot: `shot:${label}`,
      label,
      break: null,
      welcome: 'none',
      films: 'ready',
      build: { sha: label, builtAt: '2026-09-30T00:00:00.000Z' },
    }),
  });

  it('reads the page’s latest values on every call', () => {
    const page = { current: api('first') };
    vi.stubGlobal('window', {});
    const remove = installLiveHarness(() => page.current);
    const live = window.forktownLive!;
    expect(live.version).toBe(1);
    expect(live.state().shot).toBe('shot:first');
    page.current = api('on');
    expect(live.state().label).toBe('on');
    expect(live.build.sha).toBe('on');
    expect(live.startWelcome()).toBe(true);
    expect([live.quietFor(5), live.quietFor(20)]).toEqual([true, false]);
    remove();
    expect(window.forktownLive).toBeUndefined();
  });

  it('survives StrictMode: an old cleanup never removes the newer install', () => {
    vi.stubGlobal('window', {});
    const first = installLiveHarness(() => api('a'));
    const second = installLiveHarness(() => api('b'));
    first();
    expect(window.forktownLive?.state().label).toBe('b');
    second();
    expect(window.forktownLive).toBeUndefined();
  });
});

describe('The live page’s wiring', () => {
  const live = source('src/components/LiveStream.tsx');
  const overlay = source('src/components/BreakOverlay.tsx');
  const sound = source('src/components/Soundtrack.tsx');
  const css = source('src/live.css');

  it('keeps one canvas named “Forktown live:”, and the overlay out of the way', () => {
    expect(live.match(/Forktown live: /g)).toHaveLength(1);
    expect(overlay).not.toContain('Forktown live');
    expect(overlay).toContain('className="live-break" aria-hidden="true"');
    expect(overlay).not.toMatch(/role=/);
  });

  it('covers the whole picture with the art scaled whole, over dusk', () => {
    const rule = block(css, '.live-break {', '}');
    expect(rule).toContain('position: absolute');
    expect(rule).toContain('inset: 0');
    expect(rule).toContain('z-index: 6');
    expect(rule.toLowerCase()).toContain('background: #263c3c');
    const canvas = block(css, '.live-break canvas {', '}');
    expect(canvas).toContain('object-fit: contain');
    expect(canvas).toContain('image-rendering: pixelated');
    expect(overlay).toMatch(/width=\{W\} height=\{H\}/);
    expect(overlay).toMatch(/const W = 320,\s+H = 180;/);
  });

  it('asks for every face the cards and ads write in', () => {
    for (const face of [
      "'500 20px Fraunces'",
      "'italic 500 9px Fraunces'",
      `'bold 10px "Space Mono"'`,
      `'500 12px "DM Sans"'`,
    ])
      expect(overlay).toContain(face);
    expect(overlay).toContain('document.fonts');
    expect(overlay).toContain('loadReel()');
  });

  it('paints the town except while a break fully covers it, and tells the box which break', () => {
    expect(live).toContain('const covered = opacity === 1;');
    expect(live).toMatch(/if \(!covered\)\s+renderTwilight\(/);
    expect(live).toContain('data-break={shown?.key}');
    expect(live).toContain('<BreakOverlay active={shown} ms={ms} />');
    expect(live).toContain('installLiveHarness(');
  });

  it('holds on the new house with a “New neighbor” label, still lifted like a follow', () => {
    expect(live).toContain('welcomeShotAt(welcomeStep)');
    expect(live).toContain("welcomeHold ? 'New neighbor' : 'Following'");
    expect(live).toContain('plotEntrance(welcomePlot)');
    expect(live).toContain('liveLabelLift(');
    expect(live).toContain('liveEaseSeconds');
    expect(live).toContain('{followCaption}');
  });

  it('plays a break’s sound full and centred, only while the town’s sound may play', () => {
    const cinema = block(sound, 'player.current?.cinemaSound(', '}, [');
    expect(cinema).toMatch(/enabled && playing && !hidden\s+\? breakSound/);
    expect(cinema).toContain('{ ...breakSound, gain: 1, pan: 0 }');
    expect(sound).toContain('[cinema, cinemaListening, enabled, playing, hidden, breakSound]');
    const football = block(sound, 'listening.gain < 0.015', '}, [');
    expect(football).toContain('!!breakSound');
    expect(sound).toContain('[football, enabled, playing, hidden, listening, breakSound]');
    expect(sound).toContain('player.current?.cinemaPrepare(prepare)');
    // The pinned off switch stays the first of its kind (dialog-focus-and-sound.test.ts).
    expect(sound.indexOf('if (!enabled) {')).toBe(sound.lastIndexOf('if (!enabled) {'));
  });
});
