import { drawGlow, LIGHT } from '../../city/glow';
import { drawHouse, houseBounds, STEPPING_STONES } from '../../city/houses';
import { drawSproutStake } from '../../city/lantern-post';
import { drawResident } from '../../city/residents';
import type { SpotlightHouse } from '../../lib/break-cards';
import { BRAND } from '../../lib/brand';
import type { Place } from '../../lib/schema';
import type { CardModule } from '../types';
import {
  alpha,
  box,
  ease,
  easeOut,
  font,
  hump,
  lerp,
  oval,
  span,
  W,
  write,
  type Ctx,
} from '../kit';
import { welcomeScore } from './welcome-jingle';

// A new neighbor just moved in, 10 s. The newest house lands on its open plot, the door opens
// and its neighbor steps out onto the path, and at dusk the house’s own lantern post lights.

/**
 * Shown when the card has no house of its own: My Little Place, as a literal, since cards never
 * read the roster.
 */
export const SAMPLE_HOUSE: SpotlightHouse = {
  place: {
    id: 'my-little-place',
    name: 'My Little Place',
    creator: 'renanbazinin',
    plot: 'A1',
    building: 'studio',
    color: '#b88e19',
    decoration: 'bench',
    story: 'A small corner of the internet, made with curiosity and a little courage.',
    design: {
      wall: '#F0E5C8',
      trim: '#795C58',
      floors: 1,
      roof: 'classic',
      windows: 'shutters',
      garden: 'wildflowers',
      feature: 'none',
    },
    resident: {
      name: 'Renan',
      figure: 'male',
      skin: '#A97652',
      hair: '#3F3735',
      outfit: '#b88e19',
      accessory: 'glasses',
      // The sample is the card's own copy, so its greeting keeps the town's voice (no "!").
      greeting: 'Hey, neighbor.',
      routine: { morning: 'work', afternoon: 'stroll', evening: 'stroll', night: 'sleep' },
    },
    sign: {
      mode: 'text',
      text: 'MAKE SOMETHING',
      color: '#FFF4D4',
      background: '#4C5E6C',
      html: '',
    },
  },
  founder: false,
  movedIn: 'Spring 1, Year 1',
  lantern: 'LANTERN No. 9 OF 19',
};

/** The story, in card time (0..1 over 10 s). */
export const BEATS = {
  /** The house drops onto its plot, touching down at the end, then bounces once. */
  land: [0.06, 0.16],
  bounce: [0.16, 0.21],
  door: [0.3, 0.36],
  walk: [0.36, 0.52],
  shut: [0.5, 0.56],
  greet: [0.52, 0.6],
  dusk: [0.62, 0.72],
  light: [0.72, 0.78],
} as const;

/** The house stands in a box on the left; the words run down a column on the right. */
export const STAGE = { x: 8, y: 18, w: 162, h: 150 };
export const COLUMN = { x: 176, w: W - 176 - 14 };
/** Map houses are drawn 1.12× the size of the figures who live in them. */
const HOUSE_TO_FIGURE = 1.12;
/** The lawn every house stands on, in house-local px (drawHouse's own plot). */
const LAWN = [-70, 7, 0, -28, 70, 7, 0, 42];
const HANDLE_FONT = (size: number) => `500 ${size}px "DM Sans", sans-serif`;

type Fit = { x: number; y: number; scale: number };
/** Fit a house into the stage the way BuildingPreview does, never larger than the map’s. */
export function fitHouse(place: Place): Fit {
  const { top, bottom, left, right } = houseBounds(place);
  const scale = Math.min(STAGE.w / (left + right + 10), STAGE.h / (top + bottom + 14), 1.12);
  return {
    x: STAGE.x + STAGE.w / 2,
    y: STAGE.y + (STAGE.h - (top + bottom) * scale) / 2 + top * scale,
    scale,
  };
}

/** Greedy wrap of whole words; a word wider than the column is broken where it has to be. */
function wrap(ctx: Ctx, words: readonly string[], width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= width) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = '';
    let rest = word;
    while (ctx.measureText(rest).width > width && rest.length > 1) {
      let cut = rest.length - 1;
      while (cut > 1 && ctx.measureText(rest.slice(0, cut)).width > width) cut--;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    line = rest;
  }
  if (line) lines.push(line);
  return lines;
}

type Layout = {
  heading: { size: number; lines: string[] };
  /** The neighbor’s greeting, kept whole on one line, or null when it can’t be. */
  greeting: { text: string; size: number } | null;
  handle: number;
  top: number;
};
const words = (text: string) => text.split(/\s+/).filter(Boolean);
/**
 * The heading: the house’s name on one line and "just moved in." on the next, at the largest
 * size from 20 px down to 15 px that fits the column. A longer name wraps between its words
 * instead, in at most three lines down to 12 px, and only a name with one very long word is
 * broken inside it. The greeting shows whole on one line, 9 px down to 7 px, or not at all.
 * Everything is measured once, so nothing moves when the later lines fade in.
 */
function layout(ctx: Ctx, house: SpotlightHouse): Layout {
  const { place } = house;
  const fits = (tokens: readonly string[], most: number, smallest: number) => {
    for (let size = 20; size >= smallest; size--) {
      ctx.font = font('serif', size);
      const lines = wrap(ctx, tokens, COLUMN.w);
      if (lines.length <= most) return { size, lines };
    }
    return null;
  };
  const split = [...words(place.name), 'just moved in.'];
  let heading = fits([place.name.trim(), 'just moved in.'], 2, 15) ?? fits(split, 3, 12);
  if (!heading) {
    ctx.font = font('serif', 12);
    heading = { size: 12, lines: wrap(ctx, split, COLUMN.w) };
  }
  ctx.font = font('italic', 9);
  let greeting: Layout['greeting'] = null;
  const said = place.resident.greeting.trim();
  for (let size = 9; said && !greeting && size >= 7; size--) {
    ctx.font = font('italic', size);
    if (ctx.measureText(`“${said}”`).width <= COLUMN.w) greeting = { text: `“${said}”`, size };
  }
  let handle = 10;
  ctx.font = HANDLE_FONT(handle);
  while (handle > 5 && ctx.measureText(`@${place.creator}`).width > COLUMN.w)
    ctx.font = HANDLE_FONT(--handle);
  // Eyebrow, heading, greeting, byline and lantern caption, baseline to baseline (see draw).
  const height =
    7 +
    8 +
    heading.lines.length * Math.round(heading.size * 1.15) +
    8 +
    (greeting ? 12 : 0) +
    16 +
    (house.lantern ? 29 : 13);
  return { heading, greeting, handle, top: Math.max(12, (180 - height) / 2) };
}

/** Where the neighbor stands, in house-local px, and which way they face. */
function walker(p: number) {
  const walk = span(p, ...BEATS.walk);
  const from = { x: -9.5, y: 14 },
    to = {
      x: STEPPING_STONES.x + STEPPING_STONES.dx * 2.2,
      y: STEPPING_STONES.y + STEPPING_STONES.dy * 2.2 + 1,
    };
  return {
    x: lerp(from.x, to.x, walk),
    y: lerp(from.y, to.y, walk),
    moving: walk > 0 && walk < 1,
    facing: walk < 1 ? ('sw' as const) : ('se' as const),
    // Two strides a second, as the town’s neighbors walk.
    phase: walk * (BEATS.walk[1] - BEATS.walk[0]) * 10 * 2,
  };
}

/** The house, its lantern post and its neighbor, by day or by night, lit or not. */
function scene(
  ctx: Ctx,
  place: Place,
  fit: Fit,
  drop: number,
  p: number,
  night: boolean,
  lit: boolean,
) {
  const door = ease(span(p, ...BEATS.door)) * (1 - ease(span(p, ...BEATS.shut)));
  drawHouse(
    ctx,
    place,
    fit.x,
    fit.y + drop,
    night,
    fit.scale,
    { minutes: 1200, lantern: { lit, newest: true }, door },
    true,
  );
  if (p < BEATS.walk[0]) return;
  const who = walker(p);
  drawResident(
    ctx,
    place.resident,
    fit.x + who.x * fit.scale,
    fit.y + drop + who.y * fit.scale,
    fit.scale / HOUSE_TO_FIGURE,
    { moving: who.moving, facing: who.facing, walkPhase: who.phase, greeting: false },
    { night, speech: false },
  );
}

/** A little lantern that lights beside its caption: amber here is only ever the light. */
function lanternMark(ctx: Ctx, x: number, y: number, lit: number) {
  box(ctx, x + 2, y - 9, 1, 1, BRAND.duskMuted);
  box(ctx, x + 1, y - 8, 3, 1, BRAND.duskMuted);
  box(ctx, x, y - 7, 5, 6, LIGHT.unlitNight);
  box(ctx, x + 1, y - 1, 3, 1, BRAND.duskMuted);
  if (lit <= 0) return;
  box(ctx, x, y - 7, 5, 6, alpha(LIGHT.lit, lit));
  box(ctx, x + 2, y - 5, 1, 2, alpha(LIGHT.core, lit));
  drawGlow(ctx, x + 2.5, y - 4, 9, 0.55 * lit);
}

/** The lawn’s outline, in house-local px: the plot, and the shadow a landing house casts. */
function lawn(ctx: Ctx, fit: Fit, dy: number, spread: number, color: string) {
  ctx.save();
  ctx.translate(fit.x, fit.y + dy);
  ctx.scale(fit.scale * spread, fit.scale * spread);
  ctx.beginPath();
  for (let i = 0; i < LAWN.length; i += 2) ctx.lineTo(LAWN[i], LAWN[i + 1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** A few stars come out over the house at dusk, and stay put: nothing here twinkles. */
const STARS = [
  [22, 18],
  [48, 34],
  [70, 12],
  [104, 26],
  [132, 14],
  [152, 40],
  [30, 56],
  [160, 22],
] as const;

export const welcomeCard: CardModule = {
  draw(ctx, p, _seconds, data) {
    const house = data.house ?? SAMPLE_HOUSE;
    const { place, lantern } = house;
    const fit = fitHouse(place);
    const fade = (from: number, to: number) => ease(span(p, from, to));
    box(ctx, 0, 0, W, 180, BRAND.dusk);
    const dusk = fade(...BEATS.dusk),
      light = fade(...BEATS.light);
    for (const [x, y] of STARS) box(ctx, x, y, 1, 1, alpha(BRAND.duskInk, dusk * 0.7));

    // The house drops onto its open plot, bounces once, and puffs dust at each corner.
    const land = span(p, ...BEATS.land);
    const drop = -48 * (1 - land * land) - 3 * hump(p, ...BEATS.bounce);
    const shown = fade(BEATS.land[0], BEATS.land[0] + 0.02);
    const covered = fade(BEATS.land[1] - 0.01, BEATS.land[1] + 0.01);
    if (covered < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - covered;
      lawn(ctx, fit, 0, 1, BRAND.duskRaised);
      ctx.translate(fit.x, fit.y);
      ctx.scale(fit.scale * HOUSE_TO_FIGURE, fit.scale * HOUSE_TO_FIGURE);
      drawSproutStake(ctx, 0, 0, true, 2);
      ctx.restore();
    }
    lawn(ctx, fit, 3, 0.8 + 0.2 * land, alpha('#0B1414', 0.35 * shown));
    ctx.save();
    ctx.globalAlpha = shown;
    if (dusk < 1) scene(ctx, place, fit, drop, p, false, false);
    if (dusk > 0 && light < 1) {
      ctx.globalAlpha = shown * dusk;
      scene(ctx, place, fit, drop, p, true, false);
    }
    if (light > 0) {
      ctx.globalAlpha = shown * light;
      scene(ctx, place, fit, drop, p, true, true);
    }
    ctx.restore();
    const puff = span(p, BEATS.land[1], BEATS.land[1] + 0.12);
    if (puff > 0 && puff < 1)
      for (const [lx, ly] of [
        [-70, 7],
        [70, 7],
        [0, 42],
        [-38, 26],
        [38, 26],
      ])
        oval(
          ctx,
          fit.x + lx * (1 + puff * 0.12) * fit.scale,
          fit.y + ly * fit.scale - easeOut(puff) * 6,
          3 + easeOut(puff) * 7,
          1.5 + easeOut(puff) * 3,
          alpha(BRAND.paper, 0.5 * (1 - puff)),
        );

    // The words, measured once so nothing shifts as each line arrives.
    const words = layout(ctx, house);
    const left = { align: 'left' as CanvasTextAlign };
    let y = words.top + 7;
    ctx.save();
    ctx.globalAlpha = fade(0, 0.04);
    write(ctx, 'A NEW NEIGHBOR', COLUMN.x, y, { ...left, size: 7, color: BRAND.duskLink });
    const lineHeight = Math.round(words.heading.size * 1.15);
    const rise = (1 - easeOut(span(p, 0, 0.1))) * 4;
    ctx.globalAlpha = fade(0.01, 0.07);
    y += 8;
    for (const line of words.heading.lines) {
      y += lineHeight;
      write(ctx, line, COLUMN.x, y - 2 + rise, {
        ...left,
        size: words.heading.size,
        type: 'serif',
        color: BRAND.duskInk,
        shadow: alpha('#000000', 0.3),
      });
    }
    y += 8;
    ctx.globalAlpha = fade(...BEATS.greet);
    if (words.greeting) {
      y += 12;
      write(ctx, words.greeting.text, COLUMN.x, y, {
        ...left,
        size: words.greeting.size,
        type: 'italic',
        color: BRAND.duskMuted,
      });
    }
    y += 16;
    ctx.globalAlpha = fade(0.12, 0.2);
    write(ctx, 'BUILT BY', COLUMN.x, y, { ...left, size: 7, color: BRAND.duskLink });
    ctx.font = HANDLE_FONT(words.handle);
    ctx.fillStyle = BRAND.duskInk;
    ctx.textAlign = 'left';
    ctx.fillText(`@${place.creator}`, COLUMN.x, y + 13);
    if (lantern) {
      ctx.globalAlpha = fade(BEATS.light[0] - 0.02, BEATS.light[1]);
      lanternMark(ctx, COLUMN.x, y + 30, light);
      write(ctx, lantern, COLUMN.x + 9, y + 29, { ...left, size: 7, color: BRAND.duskInk });
    }
    ctx.restore();
  },
  score: welcomeScore,
  look: { shade: BRAND.dusk, ink: BRAND.duskInk, accent: BRAND.duskLink },
};
