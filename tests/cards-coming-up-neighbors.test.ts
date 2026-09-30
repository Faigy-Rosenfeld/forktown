import { describe, expect, it } from 'vitest';
import { comingUpCard } from '../src/films/cards/coming-up';
import { neighborsCard } from '../src/films/cards/neighbors';
import { W } from '../src/films/kit';
import {
  BREAK_CARDS,
  sentence,
  type BreakCardData,
  type ComingUpItem,
  type SpotlightHouse,
} from '../src/lib/break-cards';
import { calendarAt, comingUpAt } from '../src/lib/live-breaks';
import { DEFAULT_RESIDENT, type Place } from '../src/lib/schema';
import { readPlaces } from './full-town';

// The "Coming up in Forktown" and "Meet the neighbors" break cards: their words fit the frame
// for every house in town, their countdowns run from the frame's own time, and their copy
// follows the town's rules for a neighbor's own words.

type Text = { text: string; x: number; y: number; font: string; align: string; plain: boolean };

/**
 * A rough but generous width for text in the card fonts, in px: Space Mono is monospaced, and
 * Fraunces and DM Sans are measured by letter class, a little wider than they really set.
 */
function widthOf(font: string, text: string) {
  const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 10);
  if (/Space Mono/.test(font)) return [...text].length * 0.62 * size;
  const sans = /DM Sans/.test(font);
  let em = 0;
  for (const ch of text) {
    if (ch === ' ') em += 0.26;
    else if (/[mwMW@…]/.test(ch)) em += 0.86;
    else if (/[A-Z]/.test(ch)) em += 0.72;
    else if (/[0-9]/.test(ch)) em += 0.6;
    else if (/\p{L}/u.test(ch)) em += sans ? 0.57 : 0.55;
    else em += 0.4;
  }
  return em * size;
}

/**
 * A node stand-in for the canvas that measures text with widthOf, and notes for every fillText
 * the font and alignment in effect and whether it was drawn in the frame's own coordinates
 * (not inside a house or a figure, which scale their own signs).
 */
function measuringContext() {
  const texts: Text[] = [];
  const calls: { name: string; args: unknown[] }[] = [];
  const base = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: false,
    lineWidth: 1,
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    plain: true,
  };
  let state: Record<string, unknown> = { ...base };
  const stack: Record<string, unknown>[] = [];
  const moved = () => {
    state.plain = false;
  };
  const methods: Record<string, (...args: never[]) => unknown> = {
    save: () => stack.push({ ...state }),
    restore: () => {
      state = stack.pop() ?? state;
    },
    translate: moved,
    scale: moved,
    rotate: moved,
    transform: moved,
    setTransform: moved,
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createPattern: () => ({}),
    measureText: (text: string) => {
      const width = widthOf(String(state.font), String(text));
      return { width, actualBoundingBoxLeft: 0, actualBoundingBoxRight: width };
    },
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    getLineDash: () => [],
    fillText: (text: string, x: number, y: number) =>
      texts.push({
        text: String(text),
        x,
        y,
        font: String(state.font),
        align: String(state.textAlign),
        plain: state.plain === true,
      }),
  };
  const ctx = new Proxy(
    {},
    {
      get(_, key) {
        if (key === 'canvas') return { width: 320, height: 180 };
        if (typeof key !== 'string') return undefined;
        if (key in state && key !== 'plain') return state[key];
        return (...args: never[]) => {
          calls.push({ name: key, args });
          return methods[key]?.(...args);
        };
      },
      set(_, key, value) {
        if (typeof key === 'string') state[key] = value;
        return true;
      },
    },
  ) as CanvasRenderingContext2D;
  return { ctx, texts, calls };
}

const frame = (card: typeof neighborsCard, seconds: number, data: BreakCardData) => {
  const recording = measuringContext();
  card.draw(recording.ctx, Math.min(1, seconds / 12), seconds, data);
  return recording;
};

/** The frame's own words (not a house sign), each once: the drop shadow copy is left out. */
function words(texts: Text[]) {
  const seen = new Set<string>();
  return texts.filter((t) => t.plain && !seen.has(t.text) && seen.add(t.text));
}
/** Every line sits inside the frame with 8 px to spare, and no two lines overlap. */
function expectFits(texts: Text[], label: string) {
  const boxes = words(texts).map((t) => {
    const size = Number(/(\d+(?:\.\d+)?)px/.exec(t.font)?.[1] ?? 10);
    const width = widthOf(t.font, t.text);
    const left = t.align === 'center' ? t.x - width / 2 : t.align === 'right' ? t.x - width : t.x;
    return {
      text: t.text,
      left,
      right: left + width,
      top: t.y - size * 0.75,
      bottom: t.y + size * 0.2,
    };
  });
  for (const b of boxes) {
    expect(b.left, `${label}: “${b.text}” starts off the frame`).toBeGreaterThanOrEqual(8);
    expect(b.right, `${label}: “${b.text}” runs off the frame`).toBeLessThanOrEqual(W - 8);
  }
  for (const [i, a] of boxes.entries())
    for (const b of boxes.slice(i + 1)) {
      const across = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const down = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      expect(across > 1 && down > 1, `${label}: “${a.text}” overlaps “${b.text}”`).toBe(false);
    }
}

const TOWN = readPlaces();
const spotlight = (place: Place, movedIn = 'Autumn 28, Year 12'): SpotlightHouse => {
  const founder = place.creator === 'forktown';
  return {
    place,
    founder,
    movedIn: founder ? null : movedIn,
    lantern: founder ? 'FOUNDING LANTERN' : `LANTERN No. 141 OF 141`,
  };
};
/** The widest house the schema allows: 32-letter name, 24-letter neighbor, 40-letter hello. */
function widest(base: Place, name: string): Place {
  return {
    ...base,
    id: 'widest-house',
    name,
    creator: 'W'.repeat(39),
    resident: { ...base.resident, name: 'W'.repeat(24), greeting: 'W'.repeat(40) },
  };
}
const NOW = Date.UTC(2026, 8, 29, 17, 30);

describe('Meet the neighbors', () => {
  it.each(TOWN.map((place) => [place.id, place] as const))(
    'fits %s in the frame, heading, lines and byline',
    (_, place) => {
      for (const seconds of [6, 11.9]) {
        const { texts, calls } = frame(neighborsCard, seconds, {
          now: NOW,
          house: spotlight(place),
        });
        expectFits(texts, `${place.id} at ${seconds} s`);
        expect(calls.length).toBeLessThan(4000);
        expect(words(texts).map((t) => t.text)).toContain(sentence(place.name));
      }
    },
  );

  it('fits the longest names the schema allows, shrinking or leaving a line out', () => {
    const base = TOWN.find((place) => place.creator !== 'forktown') ?? TOWN[0];
    for (const name of [
      'W'.repeat(32),
      'The Very Long Name Of A Hou.',
      'Bartholomew’s Big Bookshop Too',
    ])
      for (const seconds of [6, 11.9]) {
        const house = spotlight(widest(base, name));
        const { texts } = frame(neighborsCard, seconds, { now: NOW, house });
        expectFits(texts, `${name} at ${seconds} s`);
        const shown = words(texts).map((t) => t.text);
        expect(shown).toContain(sentence(name));
        expect(shown).toContain(`@${'W'.repeat(39)}`);
      }
  });

  it('keeps a neighbor’s own punctuation and the handle’s own case', () => {
    const base = TOWN.find((place) => place.creator !== 'forktown') ?? TOWN[0];
    const place = {
      ...base,
      name: 'Hello, World!',
      creator: 'SomeOne-Mixed',
      resident: { ...base.resident, name: 'Hazel', greeting: 'Hey, neighbor!' },
    };
    const shown = words(frame(neighborsCard, 11, { now: NOW, house: spotlight(place) }).texts);
    const lines = shown.map((t) => t.text);
    expect(lines).toContain('Hello, World!');
    expect(lines).not.toContain('Hello, World!.');
    expect(lines).toContain('@SomeOne-Mixed');
    expect(lines).toContain('BROUGHT TO YOU BY');
    expect(lines).toContain('MEET THE NEIGHBORS');
    expect(lines).toContain('Moved in Autumn 28, Year 12.');
    expect(lines).toContain(`Home of ${place.resident.name}`);
    expect(lines).toContain(`“${place.resident.greeting}”`);
    // The greeting is in Fraunces italic; the handle in DM Sans.
    expect(shown.find((t) => t.text.startsWith('“'))?.font).toMatch(/^italic 500 .*Fraunces/);
    expect(shown.find((t) => t.text.startsWith('@'))?.font).toMatch(/DM Sans/);
  });

  it('leaves out “Home of” for a neighbor who kept the default name', () => {
    const base = TOWN.find((place) => place.creator !== 'forktown') ?? TOWN[0];
    const place = { ...base, resident: { ...base.resident, name: DEFAULT_RESIDENT.name } };
    const lines = words(frame(neighborsCard, 11, { now: NOW, house: spotlight(place) }).texts);
    expect(lines.some((t) => t.text.startsWith('Home of'))).toBe(false);
  });

  it('gives a founding house no byline and no move-in date', () => {
    const founder = TOWN.find((place) => place.creator === 'forktown');
    if (!founder) return;
    const lines = words(
      frame(neighborsCard, 11, { now: NOW, house: spotlight(founder) }).texts,
    ).map((t) => t.text);
    expect(lines).toContain('A FOUNDING HOUSE');
    expect(lines).toContain('One of the houses the town began with.');
    expect(lines).toContain('FOUNDING LANTERN');
    expect(lines).not.toContain('BROUGHT TO YOU BY');
    expect(lines.some((t) => t.startsWith('@') || t.startsWith('Moved in'))).toBe(false);
  });

  it('draws its own sample house with no data, and the same frame every time', () => {
    const once = frame(neighborsCard, 5, { now: 0 });
    expect(words(once.texts).map((t) => t.text)).toContain('MEET THE NEIGHBORS');
    expectFits(once.texts, 'sample');
    expect(JSON.stringify(frame(neighborsCard, 5, { now: 0 }).calls)).toBe(
      JSON.stringify(once.calls),
    );
  });
});

describe('Coming up in Forktown', () => {
  const rows = (...waits: number[]): ComingUpItem[] =>
    waits.map((wait, i) => ({
      title: ['Lantern hour', 'An afternoon with the animals', 'Meadow FC v Sunset United'][i % 3],
      place: ['The Lantern Fork', 'Willow Grove Zoo', 'The Lunch Green'][i % 3],
      townTime: ['20:00', '14:00', '10:40'][i % 3],
      startsAt: NOW + wait * 1000,
    }));
  const calendar = {
    label: 'Autumn 28, Year 12',
    season: 'Autumn',
    moonName: 'Waning gibbous',
    moonPhase: 0.6,
  };
  const lines = (seconds: number, data: BreakCardData) =>
    words(frame(comingUpCard, seconds, data).texts).map((t) => t.text);

  it('counts down from the frame’s own time, not the card’s start', () => {
    const data = { now: NOW, comingUp: rows(42, 400, 90_000), calendar };
    expect(lines(3, data)).toContain(' · in 39 seconds');
    expect(lines(8, data)).toContain(' · in 34 seconds');
    expect(lines(8, data)).toContain(' · in about 7 minutes');
    expect(lines(11.9, { ...data, comingUp: rows(10) })).toContain(' · any moment now');
  });

  it('lists at most three rows, with the date and the moon underneath', () => {
    const shown = lines(11, { now: NOW, comingUp: rows(42, 400, 900, 1200), calendar });
    expect(shown.filter((t) => /^\d\d:\d\d$/.test(t))).toEqual(['20:00', '14:00', '10:40']);
    expect(shown).toContain('Autumn 28, Year 12 · Waning gibbous');
    expect(shown).toContain('COMING UP IN FORKTOWN');
  });

  it('eases its rows in one by one', () => {
    const data = { now: NOW, comingUp: rows(42, 400, 900), calendar };
    const count = (seconds: number) =>
      lines(seconds, data).filter((t) => /^\d\d:\d\d$/.test(t)).length;
    expect(count(0)).toBe(0);
    expect(count(1)).toBe(1);
    expect(count(1.8)).toBe(2);
    expect(count(3)).toBe(3);
  });

  it('draws its sample rows with no data, and says so when nothing is coming up', () => {
    expect(lines(6, { now: 0 }).filter((t) => /^\d\d:\d\d$/.test(t))).toHaveLength(3);
    expect(lines(6, { now: NOW, comingUp: [], calendar })).toContain(
      'Nothing on the program just now. Stay for the view.',
    );
  });

  it('lights more of the moon when it is full than when it is new', () => {
    const lit = (moonPhase: number) =>
      frame(comingUpCard, 11, {
        now: NOW,
        comingUp: rows(42),
        calendar: { ...calendar, moonPhase },
      }).calls.filter((call) => call.name === 'fillRect').length;
    expect(lit(0.5)).toBeGreaterThan(lit(0));
  });

  it('fits the real listings at every half hour of a day, and is the same on redraw', () => {
    const card = BREAK_CARDS['coming-up'];
    for (let slot = 0; slot < 48; slot++) {
      const now = NOW + slot * 1_800_000;
      const data = { now, comingUp: comingUpAt(now, TOWN), calendar: calendarAt(now) };
      for (const seconds of [4, card.duration - 0.1]) {
        const { texts, calls } = frame(comingUpCard, seconds, data);
        expectFits(texts, `slot ${slot} at ${seconds} s`);
        expect(calls.length).toBeLessThan(4000);
        expect(JSON.stringify(frame(comingUpCard, seconds, data).calls)).toBe(
          JSON.stringify(calls),
        );
      }
    }
  });

  it('shortens a listing too long for the frame instead of running off it', () => {
    const long = rows(42).map((row) => ({
      ...row,
      title: 'W'.repeat(40),
      place: 'W'.repeat(40),
    }));
    expectFits(frame(comingUpCard, 11, { now: NOW, comingUp: long, calendar }).texts, 'long');
  });
});
