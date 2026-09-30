import { DUCK_COUNT, DUCK_WALK_START } from '../../lib/ducks';
import type { AdModule } from '../types';
import {
  alpha,
  backOut,
  box,
  camera,
  disc,
  ease,
  faded,
  glow,
  H,
  hump,
  lerp,
  line,
  mix,
  oval,
  person,
  poly,
  presence,
  shade,
  sky,
  span,
  track,
  vignette,
  W,
  write,
  type Ctx,
  type Figure,
} from '../kit';
import { composeAd } from '../score-kit';

// Duck Crossing Authority, 20 s: a public safety film. The family walks past the Lunch Green, a
// neighbor stops, turns and shows a heart, and everyone counts ducklings. One of them is late.

/** The family walks in from the river side. */
export const WALK_IN = 0.15;
/** The neighbor does what every neighbor in town does: stops, turns toward them, shows a heart. */
export const STOP = 0.25;
export const TURN = 0.29;
export const HEART = 0.33;
/** About to walk on, when a peep comes from the far kerb. */
export const SPOT = 0.52;
/** The fifth duckling looks up from the daisies, makes a dash for it, and gets home. */
export const STARTLE = SPOT + 0.03;
export const DASH = 0.57;
export const HOME = 0.68;
/** Everyone walks on, the neighbor last. */
export const OFF = 0.71;

const DUCKLINGS = DUCK_COUNT - 1;
const PACE = 900; // px of street per unit of story: a brisk 45 px a second.
const GAP = 0.032; // each duckling follows this far behind the one ahead.
const ENTER = 340;
const WAIT_X = 44;
const SLOT = 26;
const LANE = 146;
const PAVEMENT = 106; // the far pavement, by the green: the neighbor walks here.
const VERGE = 102; // the grass edge where the fifth one dawdles among the daisies.
const DAWDLE_X = 276;
const NEIGHBOR_X = 160;
const PAUSED_X = 154; // after the half step the neighbor takes, just before the peep.
const SIGN_X = 212;
const INK = '#2F4A3B';
const HEART_PINK = '#D77683';
const PAPER = '#F8F7F2';
const pad = (n: number) => String(n).padStart(2, '0');
const CLOCK = `${pad(Math.floor(DUCK_WALK_START / 60))}:${pad(DUCK_WALK_START % 60)}`;

const slotX = (i: number) => WAIT_X + i * SLOT;
/** Where duck i (0 is the mother) would be if nothing stopped it. */
const freeX = (i: number, p: number) => ENTER - (p - WALK_IN - i * GAP) * PACE;
/** When duck i reaches its place in the queue at the left. */
const arrives = (i: number) => WALK_IN + i * GAP + (ENTER - slotX(i)) / PACE;
/** Each duckling gets its number as it passes under the neighbor. */
export const COUNTS = Array.from(
  { length: DUCKLINGS - 1 },
  (_, k) => WALK_IN + (k + 1) * GAP + (ENTER - (NEIGHBOR_X - 6)) / PACE,
);
/** The fifth one's number, as it takes its place in the queue. */
export const FIVE = HOME - 0.005;

type Duck = {
  x: number;
  y: number;
  size: number;
  facing: 1 | -1;
  adult?: boolean;
  /** Walk phase in radians; undefined stands still. */
  stride?: number;
  flap?: number;
  peck?: number;
  hop?: number;
};

/** A film duck in the town's colours: tan mother, yellow ducklings, (x, y) between the feet. */
function duck(ctx: Ctx, d: Duck) {
  const body = d.adult ? '#D2B17B' : '#F3D66D',
    wing = d.adult ? '#A17D53' : '#DDB652',
    belly = d.adult ? '#EEE0B8' : '#FFF0AC';
  shade(ctx, d.x, d.y + 1, 24 * d.size, 0.2);
  ctx.save();
  ctx.translate(d.x, d.y - (d.hop ?? 0) * 9 * d.size);
  ctx.scale(d.facing * d.size, d.size);
  const swing = d.stride === undefined ? 0 : Math.sin(d.stride);
  const bob = d.stride === undefined ? 0 : Math.abs(Math.cos(d.stride));
  // Paddle feet, one forward, one back.
  box(ctx, -4 + swing * 3, -3, 2, 2, '#BC7739');
  box(ctx, 1 - swing * 3, -3, 2, 2, '#BC7739');
  box(ctx, -5 + swing * 3, -1, 5, 2, '#BC7739');
  box(ctx, 0 - swing * 3, -1, 5, 2, '#BC7739');
  ctx.translate(0, -bob * 1.5);
  ctx.rotate(swing * 0.06);
  poly(ctx, body, [-8, -11, -15, -17, -13, -8]);
  oval(ctx, 0, -9, 11, 7, body);
  oval(ctx, 3, -5, 7, 3, belly);
  ctx.save();
  ctx.translate(-1, -11);
  ctx.rotate(-(d.flap ?? 0) * 1.2);
  oval(ctx, -3, 1, 7, 3.5, wing);
  ctx.restore();
  ctx.save();
  ctx.translate(6, -13);
  ctx.rotate((d.peck ?? 0) * 1.1);
  oval(ctx, 1, -2, 3.5, 4.5, body);
  disc(ctx, 3, -7, d.adult ? 5.5 : 6, body);
  if (d.adult) {
    // The mother is the Authority: a little peaked cap, worn with pride.
    box(ctx, -2, -14, 9, 3, INK);
    box(ctx, -1, -15, 7, 1, INK);
    box(ctx, 5, -12, 5, 1, INK);
    box(ctx, 2, -14, 2, 2, '#F3D66D');
  } else {
    box(ctx, 1, -15, 2, 3, body);
    box(ctx, 3, -16, 1, 3, body);
  }
  poly(ctx, '#DF9446', [7, -8, 13, -7, 13, -5, 7, -4]);
  box(ctx, 4, -10, 2, 2, '#29392F');
  box(ctx, 4, -10, 1, 1, '#FFFFFF');
  ctx.restore();
  ctx.restore();
}

/** The neighbor's heart: the same pixel heart the town shows, on its little bubble. */
function heart(ctx: Ctx, x: number, y: number, scale: number) {
  if (scale <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  box(ctx, -10, -18, 20, 15, '#FCFAEF');
  box(ctx, -12, -16, 24, 11, '#FCFAEF');
  box(ctx, -1, -3, 3, 3, '#FCFAEF');
  box(ctx, -6, -15, 4, 2, HEART_PINK);
  box(ctx, 2, -15, 4, 2, HEART_PINK);
  box(ctx, -7, -13, 14, 3, HEART_PINK);
  box(ctx, -5, -10, 10, 2, HEART_PINK);
  box(ctx, -3, -8, 6, 2, HEART_PINK);
  box(ctx, -1, -6, 2, 1, HEART_PINK);
  ctx.restore();
}

/** A duckling's number, on a little enamel disc that rides along above it. */
function badge(ctx: Ctx, x: number, y: number, n: number, scale: number, color = INK) {
  if (scale <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  disc(ctx, 0, 0, 7.5, PAPER);
  disc(ctx, 0, 0, 6.5, color);
  write(ctx, String(n), 0, 3.5, { size: 10, color: PAPER });
  ctx.restore();
}

function morning(ctx: Ctx, seconds: number) {
  sky(ctx, ['#A6D2EA', '#C4E2EE', '#E0EFEA', '#F3F2DE'], 0, 74);
  // The morning sun is up over the river, off to the right.
  glow(ctx, 318, 6, 110, '#FFF4CC', 0.55);
  for (let i = 0; i < 3; i++) {
    const x = ((i * 140 + seconds * 3) % 420) - 50,
      y = 22 + i * 7;
    oval(ctx, x, y, 16, 4, alpha('#FFFFFF', 0.75));
    oval(ctx, x + 8, y - 3, 9, 4, alpha('#FFFFFF', 0.75));
  }
  // The first houses of town, hazy beyond the green.
  const roofs = ['#B8705A', '#6F8A9A', '#A8844E', '#8A6A8A', '#B8705A', '#6F8A9A', '#A8844E'];
  for (let i = 0; i < 7; i++) {
    const x = 40 + i * 40,
      h = 8 + (i % 2) * 3;
    box(ctx, x, 70 - h, 20, h, '#EEE8D8');
    poly(ctx, mix(roofs[i], '#DCEBEA', 0.4), [x - 2, 70 - h, x + 10, 63 - h, x + 22, 70 - h]);
    box(ctx, x + 8, 65, 4, 5, mix('#6A5A4A', '#DCEBEA', 0.4));
  }
  // The Lunch Green.
  box(ctx, 0, 70, W, 32, '#8DB266');
  box(ctx, 0, 70, W, 2, '#A4C47C');
  for (let i = 0; i < 12; i++) oval(ctx, 8 + i * 28, 71, 16, 4, '#79A058');
  // A tree at the corner of the green.
  box(ctx, 20, 40, 6, 48, '#6A5040');
  oval(ctx, 22, 32, 28, 18, '#6E9A4E');
  oval(ctx, 8, 40, 16, 11, '#7FA85A');
  oval(ctx, 38, 40, 16, 12, '#7FA85A');
  oval(ctx, 24, 24, 14, 9, '#8AB866');
  // Patchwork picnic rugs, and the lemonade table.
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 8; col++) {
      const x = 60 + col * 10 - row * 3,
        y = 86 + row * 4;
      poly(ctx, (row + col) % 2 ? '#E7DAB7' : '#CC8F82', [
        x,
        y,
        x + 10,
        y,
        x + 7,
        y + 4,
        x - 3,
        y + 4,
      ]);
    }
  box(ctx, 150, 82, 28, 3, '#B8905E');
  box(ctx, 152, 85, 2, 9, '#8E6C4C');
  box(ctx, 174, 85, 2, 9, '#8E6C4C');
  box(ctx, 155, 76, 5, 6, '#F4EAB0');
  box(ctx, 164, 78, 3, 4, PAPER);
  box(ctx, 169, 78, 3, 4, PAPER);
  // Bunting from the tree across the green.
  const bunting = ['#CC8F82', '#E7DAB7', '#769267', '#6F8A9A'];
  line(ctx, '#6A5040', 1, [40, 50, 80, 57, 120, 59, 160, 57, 196, 52]);
  for (let i = 0; i < 14; i++) {
    const x = 46 + i * 11,
      y = 51 + Math.sin(((x - 40) / 156) * Math.PI) * 7 + Math.sin(seconds * 2 + i) * 0.4;
    poly(ctx, bunting[i % 4], [x - 3, y, x + 3, y, x, y + 5]);
  }
  // The daisies the fifth one can't leave alone.
  for (const [x, y] of [
    [262, 100],
    [286, 99],
    [292, 101],
    [270, 98],
    [300, 100],
  ]) {
    box(ctx, x - 1, y - 1, 3, 3, PAPER);
    box(ctx, x, y, 1, 1, '#E8C04A');
  }
  // Far pavement, the street, and the near pavement.
  box(ctx, 0, 101, W, 8, '#D9D0BC');
  box(ctx, 0, 101, W, 1, '#C8BEA8');
  box(ctx, 0, 108, W, 2, '#B5AA93');
  box(ctx, 0, 110, W, 42, '#8F8D86');
  box(ctx, 0, 110, W, 3, alpha('#5E5C58', 0.35));
  for (let x = 6; x < W; x += 34) box(ctx, x, 129, 16, 2, '#E6E0CC');
  box(ctx, 0, 152, W, 4, '#C8BEA8');
  box(ctx, 0, 152, W, 1, '#DDD4C0');
  box(ctx, 0, 156, W, H - 156, '#E4DBC7');
  box(ctx, 0, 168, W, 1, '#D2C8B2');
  for (let x = 14; x < W; x += 30) box(ctx, x, 156, 1, 12, '#D2C8B2');
  for (let x = 29; x < W; x += 30) box(ctx, x, 169, 1, 11, '#D2C8B2');
}

/** The Authority's enamel plate by the green: the family in silhouette, the last one lagging. */
function sign(ctx: Ctx) {
  const x = SIGN_X;
  shade(ctx, x, 103, 8, 0.25);
  box(ctx, x - 1, 76, 3, 27, '#6E7670');
  box(ctx, x - 1, 76, 1, 27, '#8E968F');
  box(ctx, x - 31, 32, 62, 34, INK);
  box(ctx, x - 29, 34, 58, 30, '#E9EFD9');
  box(ctx, x - 27, 36, 54, 26, INK);
  box(ctx, x - 26, 37, 52, 24, '#E9EFD9');
  // Walking left, like the family: mother, four in a row, a gap, and the fifth.
  const walker = (cx: number, s: number) => {
    const cy = 53;
    oval(ctx, cx, cy, 4 * s, 2.6 * s, INK);
    poly(ctx, INK, [cx + 2.5 * s, cy - 1 * s, cx + 6 * s, cy - 3.5 * s, cx + 4.5 * s, cy + 1 * s]);
    oval(ctx, cx - 2.6 * s, cy - 2.8 * s, 1.4 * s, 2 * s, INK);
    disc(ctx, cx - 3 * s, cy - 4.6 * s, 2 * s, INK);
    poly(ctx, INK, [
      cx - 4.5 * s,
      cy - 5.2 * s,
      cx - 7.5 * s,
      cy - 4.4 * s,
      cx - 4.5 * s,
      cy - 3.6 * s,
    ]);
    box(ctx, cx - 1 * s, cy + 2 * s, 1, 3 * s, INK);
    box(ctx, cx + 1 * s, cy + 2 * s, 1, 3 * s, INK);
  };
  walker(x - 17, 1.25);
  for (let i = 0; i < 4; i++) walker(x - 6.5 + i * 5.5, 0.7);
  walker(x + 22, 0.7);
  box(ctx, x - 22, 66, 44, 11, INK);
  box(ctx, x - 21, 67, 42, 9, '#E9EFD9');
  write(ctx, 'MORNINGS', x, 74, { size: 6, color: INK });
}

const NEIGHBOR: Figure = {
  skin: '#C89A78',
  hair: '#3A2A24',
  coat: '#5A7FA8',
  legs: '#3A4050',
  build: 'adult',
  hairStyle: 'bob',
  hat: 'brim',
  hatColor: '#CDBB94',
  size: 1.2,
};

function neighbor(ctx: Ctx, p: number, seconds: number) {
  let x = NEIGHBOR_X,
    facing: 1 | -1 = -1,
    step: number | undefined,
    lean = 0;
  let eyes: Figure['eyes'] = 'open',
    mouth: Figure['mouth'] = 'smile';
  if (p < STOP) {
    x = lerp(ENTER, NEIGHBOR_X, span(p, 0.05, STOP));
    step = seconds * 9;
    if (p > STOP - 0.02) eyes = 'wide';
  } else if (p < 0.495) {
    facing = p >= TURN && p < 0.4 ? 1 : -1;
    eyes = p >= HEART ? 'happy' : 'wide';
    mouth = p >= HEART ? 'grin' : 'o';
  } else if (p < OFF + 0.02) {
    // A half step to walk on, frozen mid-stride by the peep, then a turn to look.
    const half = span(p, 0.495, SPOT);
    x = lerp(NEIGHBOR_X, PAUSED_X, half);
    step = half * (Math.PI / 2);
    facing = p >= SPOT + 0.025 ? 1 : -1;
    eyes = p >= DASH ? 'happy' : p >= SPOT ? 'wide' : 'open';
    mouth = p >= DASH ? 'grin' : p >= SPOT ? 'o' : 'smile';
  } else {
    // Off after them at a respectful distance, with a little waddle of their own.
    x = PAUSED_X - (p - OFF - 0.02) * PACE * 0.7;
    step = seconds * 9;
    lean = Math.sin(seconds * 9) * 0.16;
    eyes = 'happy';
  }
  shade(ctx, x, PAVEMENT + 1, 18);
  person(ctx, x, PAVEMENT, { ...NEIGHBOR, facing, step, eyes, mouth, lean });
  const love = (from: number, to: number) =>
    backOut(span(p, from, from + 0.025)) * (1 - ease(span(p, to - 0.02, to)));
  heart(
    ctx,
    x + 1,
    PAVEMENT - 50,
    Math.max(love(HEART, 0.48), love(DASH, OFF + 0.03) * 1.15) * 1.25,
  );
}

/** The fifth one: pecking at daisies, a start, then a scramble across the street. */
function fifthDuck(p: number, seconds: number): Duck {
  const dash = span(p, DASH, HOME);
  const leaving = Math.max(0, p - OFF) * PACE * 0.85;
  const cross = ease(span(dash, 0, 0.75));
  return {
    x: p < DASH ? DAWDLE_X : lerp(DAWDLE_X, slotX(DUCKLINGS), dash) - leaving,
    y: lerp(VERGE, LANE, cross),
    size: lerp(0.6, 0.75, cross),
    facing: p < STARTLE ? 1 : -1,
    peck: p < STARTLE ? Math.max(0, Math.sin(seconds * 4.2)) ** 3 : 0,
    hop: hump(p, STARTLE, STARTLE + 0.025) + hump(p, HOME, HOME + 0.02) * 0.6,
    stride: p >= DASH && p < HOME ? seconds * 26 : p >= OFF ? seconds * 13 : undefined,
    flap: p >= DASH && p < HOME ? 0.5 + Math.sin(seconds * 17) * 0.5 : 0,
  };
}

function fifthExtras(ctx: Ctx, p: number, seconds: number, d: Duck) {
  // Three lines of alarm when it looks up and sees the family gone.
  const alarm = presence(p, STARTLE + 0.004, DASH + 0.01, 0.006);
  faded(ctx, alarm, () => {
    line(ctx, INK, 1, [d.x - 2, d.y - 20, d.x - 5, d.y - 25]);
    line(ctx, INK, 1, [d.x + 2, d.y - 22, d.x + 2, d.y - 28]);
    line(ctx, INK, 1, [d.x + 6, d.y - 20, d.x + 9, d.y - 25]);
  });
  // Dust from a very small emergency.
  const dash = span(p, DASH, HOME);
  if (dash > 0 && dash < 1)
    for (let i = 0; i < 3; i++) {
      const puff = (seconds * 7 + i / 3) % 1;
      faded(ctx, (1 - puff) * 0.8, () =>
        box(ctx, d.x + 8 + puff * 12, d.y - 3 - puff * 4 - (i % 2) * 2, 3 + puff * 3, 2, '#EFE6CF'),
      );
    }
}

function family(p: number, seconds: number): Duck[] {
  const leaving = Math.max(0, p - OFF) * PACE * 0.85;
  const ducks: Duck[] = [];
  for (let i = 0; i < DUCKLINGS; i++) {
    const moving = p < arrives(i) || p >= OFF;
    // They turn round to watch the fifth one come; the mother has been looking all along.
    const watching = p < OFF && p >= (i === 0 ? arrives(0) + 0.01 : SPOT + 0.03 + i * 0.006);
    ducks.push({
      x: p < OFF ? Math.max(slotX(i), freeX(i, p)) : slotX(i) - leaving,
      y: LANE,
      size: i === 0 ? 1.1 : 0.75,
      facing: watching ? 1 : -1,
      adult: i === 0,
      stride: moving ? seconds * 13 + i * 1.7 : undefined,
      hop: i > 0 ? hump(p, HOME + 0.01 * i, HOME + 0.01 * i + 0.025) * 0.5 : 0,
    });
  }
  return ducks;
}

function street(ctx: Ctx, p: number, seconds: number) {
  morning(ctx, seconds);
  const fifth = fifthDuck(p, seconds);
  const ducks = family(p, seconds);
  const early = fifth.y < 112;
  if (early) duck(ctx, fifth);
  sign(ctx);
  neighbor(ctx, p, seconds);
  for (const d of ducks) if (d.x < ENTER + 24 && d.x > -30) duck(ctx, d);
  if (!early) duck(ctx, fifth);
  fifthExtras(ctx, p, seconds, fifth);
  // The mother, proud: two little twinkles.
  const proud = span(p, HOME, HOME + 0.05);
  if (proud > 0 && proud < 1)
    faded(ctx, Math.sin(proud * Math.PI), () => {
      for (const side of [-1, 1]) {
        const x = ducks[0].x + 4 + side * (13 + proud * 8),
          y = LANE - 30 - proud * 8;
        box(ctx, x - 3, y, 7, 1, '#FFF4C5');
        box(ctx, x, y - 3, 1, 7, '#FFF4C5');
      }
    });
  // Counting, one duckling at a time.
  COUNTS.forEach((at, k) =>
    badge(ctx, ducks[k + 1].x + 2, LANE - 31, k + 1, backOut(span(p, at, at + 0.02))),
  );
  const five = backOut(span(p, FIVE, FIVE + 0.025)) * 1.15;
  badge(ctx, fifth.x + 2, LANE - 31, DUCKLINGS, five, HEART_PINK);
}

/** "If you meet the ducks": the Authority's three rules, ticked as the neighbor does each. */
function rules(ctx: Ctx, p: number) {
  const show = presence(p, 0.2, 0.485, 0.02);
  faded(ctx, show, () => {
    const x = 10,
      y = 10;
    box(ctx, x, y, 124, 54, alpha('#F4F1E4', 0.96));
    box(ctx, x + 2, y + 2, 120, 1, INK);
    box(ctx, x + 2, y + 51, 120, 1, INK);
    box(ctx, x + 2, y + 2, 1, 50, INK);
    box(ctx, x + 121, y + 2, 1, 50, INK);
    write(ctx, 'IF YOU MEET THE DUCKS', x + 8, y + 13, {
      size: 6,
      color: '#516B42',
      align: 'left',
    });
    const items = [
      ['STOP', STOP],
      ['TURN TOWARD THEM', TURN],
      ['SHOW A HEART', HEART],
    ] as const;
    items.forEach(([text, at], i) => {
      const ry = y + 26 + i * 11;
      box(ctx, x + 8, ry - 7, 8, 8, INK);
      box(ctx, x + 9, ry - 6, 6, 6, PAPER);
      const tick = backOut(span(p, at, at + 0.02));
      if (tick > 0) {
        ctx.save();
        ctx.translate(x + 12, ry - 3);
        ctx.scale(tick, tick);
        if (i === 2) {
          box(ctx, -3, -3, 2, 2, HEART_PINK);
          box(ctx, 1, -3, 2, 2, HEART_PINK);
          box(ctx, -3, -2, 6, 2, HEART_PINK);
          box(ctx, -2, 0, 4, 1, HEART_PINK);
          box(ctx, -1, 1, 2, 1, HEART_PINK);
        } else line(ctx, '#516B42', 2, [-3, 0, -1, 2, 3, -3]);
        ctx.restore();
      }
      write(ctx, text, x + 21, ry, { size: 8, color: INK, align: 'left' });
    });
  });
}

export const duckCrossingAuthorityAdScore: AdModule['score'] = (ad) =>
  composeAd(ad, (s) => {
    // Story time runs a breath ahead of the picture: convert, so each sound lands on its frame.
    const at = (p: number) => (p * s.duration - s.time(0)) / s.story;
    // The two-note chime of a safety film.
    s.note(at(0.01), 76, 0.9, 'bell', 0.08, 0.1);
    s.note(at(0.04), 72, 1.3, 'bell', 0.08, -0.1);
    s.section({
      from: at(0.07),
      to: at(SPOT),
      bpm: 104,
      root: 60,
      chords: [0, 5, 7, 0],
      groove: 'march',
      melody: [7, 4, 7, 4, 5, 7, 9, null, 7, 5, 4, 2, 0, null, null, null],
      step: 0.5,
      voice: 'pluck',
      gain: 0.55,
      level: 0.75,
      fade: 0.3,
    });
    s.fx('quack', at(STOP - 0.02), 0.35, 0.16, 0.6);
    s.fx('click', at(STOP), 0.08, 0.12, -0.6);
    s.fx('click', at(TURN), 0.08, 0.12, -0.6);
    s.fx('pop', at(HEART), 0.16, 0.14, 0.1);
    s.fx('quack', at(HEART + 0.01), 0.3, 0.1, 0.2);
    COUNTS.forEach((c, k) => {
      const pan = 0.05 - k * 0.1;
      s.fx('squeak', at(c), 0.12, 0.05, pan);
      s.note(at(c), 72 + [0, 2, 4, 5][k], 0.5, 'bell', 0.08, pan);
    });
    // The hush: a half step, and a peep from across the street.
    s.chord(at(SPOT), [53, 57, 60, 65], 1.3, 'pad', 0.05);
    s.fx('squeak', at(SPOT), 0.18, 0.09, 0.7);
    s.fx('boing', at(STARTLE), 0.3, 0.06, 0.7);
    s.section({
      from: at(DASH),
      to: at(0.8),
      bpm: 138,
      root: 60,
      chords: [0, 7, 5, 0],
      groove: 'drive',
      melody: [12, 11, 9, 7, 9, 7, 5, 4, 5, 4, 2, 4, 7, null, 12, null],
      step: 0.5,
      voice: 'pluck',
      gain: 0.5,
      level: 0.7,
      fade: 0.3,
    });
    s.fx('pop', at(DASH), 0.16, 0.14, 0.1);
    s.fx('flutter', at(DASH), 1.8, 0.06, 0.4);
    for (let i = 0; i < 10; i++) s.fx('step', at(DASH + i * 0.011), 0.06, 0.05, 0.6 - i * 0.1);
    s.note(at(FIVE), 79, 0.8, 'bell', 0.1, 0);
    s.fx('sparkle', at(FIVE), 1.2, 0.08);
    s.fx('quack', at(HOME), 0.35, 0.14, -0.5);
    s.fx('quack', at(HOME + 0.02), 0.3, 0.1, -0.5);
    s.chord(at(0.8), [48, 55, 60, 64], 4, 'pad', 0.05);
  });

export const duckCrossingAuthorityAd: AdModule = {
  draw(ctx, p, seconds) {
    // Close on the Authority's sign, back to the whole street, in on the fifth one, and out.
    const view = track(p, [
      [0, SIGN_X + 12, 68, 2.3],
      [0.07, SIGN_X + 12, 68, 2.3],
      [0.15, 160, 100, 1.15],
      [SPOT - 0.01, 160, 100, 1.15],
      [SPOT + 0.03, 230, 82, 1.7],
      [DASH + 0.01, 230, 82, 1.7],
      [HOME - 0.02, 160, 100, 1.15],
    ]);
    camera(ctx, view, () => street(ctx, p, seconds));
    vignette(ctx, 0.25);
    rules(ctx, p);
    faded(ctx, presence(p, 0.02, 0.485, 0.02), () => {
      box(ctx, W - 50, 10, 40, 15, alpha('#1F3326', 0.85));
      write(ctx, CLOCK, W - 30, 21, { size: 9, color: PAPER });
    });
    faded(ctx, presence(p, 0.015, 0.16, 0.02), () => {
      box(ctx, 12, 138, 138, 30, alpha('#1F3326', 0.82));
      write(ctx, 'A PUBLIC SAFETY FILM', 20, 150, { size: 6, color: '#F3D66D', align: 'left' });
      write(ctx, 'DUCK CROSSING AUTHORITY', 20, 162, { size: 8, color: PAPER, align: 'left' });
    });
  },
  score: duckCrossingAuthorityAdScore,
  look: { shade: '#1F3326', ink: '#F8F7F2', accent: '#F3D66D' },
};
