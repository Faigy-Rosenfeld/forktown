import { BRAND } from '../../lib/brand';
import type { CardModule } from '../types';
import { alpha, box, hump, oval, TAU, W, write, type Ctx } from '../kit';
import { CURL, miso } from '../miso-and-the-moon';
import { rightBackScore } from './right-back-jingle';

// We’ll be right back, 12 s: Miso asleep on the town’s test pattern while the reel changes.
// The card loops for as long as the gap lasts, so every motion here repeats in a period that
// divides 12 s: the frame at 12 s is the frame at 0 s.

export const LOOP = 12;
/** One breath every 3 s: four to the loop. */
export const BREATH = 3;
/** Each "z" drifts up for 6 s, and a new one sets off every 3 s. */
export const DRIFT = 6;

/** Test-pattern bars in brand colours, lightest first, as colour bars run. No lantern amber. */
export const BARS = [
  BRAND.paper,
  BRAND.duskLink,
  BRAND.timber,
  BRAND.leaf,
  BRAND.green,
  BRAND.greenDeep,
  BRAND.ink,
  BRAND.dusk,
];
const BAR_W = W / BARS.length;
const STRIP = 96,
  FLOOR = 106;
/** Where Miso sleeps: the ground under her, on the top edge of the panel. */
const MISO = { x: 138, y: FLOOR, size: 2.8 };

const wave = (seconds: number, period: number) => Math.sin((seconds / period) * TAU);

function pattern(ctx: Ctx) {
  BARS.forEach((color, i) => box(ctx, i * BAR_W, 0, BAR_W, STRIP, color));
  // The short reversed row under the bars, as on a broadcast test card.
  BARS.forEach((_, i) =>
    box(ctx, i * BAR_W, STRIP, BAR_W, FLOOR - STRIP, BARS[BARS.length - 1 - i]),
  );
  box(ctx, 0, FLOOR, W, 180 - FLOOR, BRAND.dusk);
  box(ctx, 0, FLOOR, W, 1, BRAND.duskLine);
}

function sleeper(ctx: Ctx, seconds: number) {
  const breath = wave(seconds, BREATH);
  // A single ear flick each loop, and whiskers that twitch every 2 s (π/3 turns the film's
  // whisker clock, sin(3·s), into a 2 s period).
  const flick = hump(seconds, 8.3, 8.75) * 0.45;
  const { x, y, size } = MISO;
  oval(ctx, x + 4, y + 1, 36, 3.5, alpha('#0B1414', 0.35));
  miso(
    ctx,
    x,
    y,
    { ...CURL, ry: CURL.ry + breath * 0.35, ky: CURL.ky + breath * 0.25 },
    { size, seconds: (seconds * Math.PI) / 3, wrap: true, eyes: 'closed', ears: flick },
  );
}

/** A film reel turning slowly, one turn every 4 s, while the projectionist works. */
function reel(ctx: Ctx, x: number, y: number, seconds: number) {
  const a = (seconds / 4) * TAU;
  oval(ctx, x, y, 5.5, 5.5, BRAND.duskLink);
  oval(ctx, x, y, 1.1, 1.1, BRAND.dusk);
  for (let i = 0; i < 6; i++) {
    const h = a + (i / 6) * TAU;
    oval(ctx, x + Math.cos(h) * 3.4, y + Math.sin(h) * 3.4, 1.05, 1.05, BRAND.dusk);
  }
}

/** Two slow z’s rising from Miso’s nose, one setting off every 3 s. */
function snores(ctx: Ctx, seconds: number) {
  const { x, y, size } = MISO;
  const fromX = x + 18 * size,
    fromY = y - 13 * size;
  for (let i = 0; i < DRIFT / BREATH; i++) {
    const t = (((seconds + i * BREATH) % DRIFT) + DRIFT) % DRIFT;
    const k = t / DRIFT;
    const fade = Math.sin(k * Math.PI);
    if (fade <= 0.02) continue;
    write(ctx, 'z', fromX + k * 34 + Math.sin(k * TAU) * 4, fromY - k * 50, {
      size: Math.round(10 + k * 10),
      type: 'italic',
      color: alpha(BRAND.paper, fade),
      shadow: alpha(BRAND.dusk, fade * 0.6),
    });
  }
}

export const rightBackCard: CardModule = {
  draw(ctx, _p, seconds) {
    // Everything runs on the loop's own clock, so a replay picks up exactly where it began.
    const t = ((seconds % LOOP) + LOOP) % LOOP;
    pattern(ctx);
    sleeper(ctx, t);
    snores(ctx, t);
    write(ctx, 'FORKTOWN', W / 2, 124, { size: 7, color: BRAND.duskLink });
    reel(ctx, W / 2 - 34, 121.5, t);
    reel(ctx, W / 2 + 34, 121.5, t);
    write(ctx, 'We’ll be right back.', W / 2, 146, {
      size: 18,
      type: 'serif',
      color: BRAND.duskInk,
      shadow: alpha('#000000', 0.3),
    });
    write(ctx, 'The projectionist is changing the reel.', W / 2, 164, {
      size: 9,
      type: 'italic',
      color: BRAND.duskMuted,
    });
  },
  score: rightBackScore,
  look: { shade: BRAND.dusk, ink: BRAND.duskInk, accent: BRAND.duskLink },
};
