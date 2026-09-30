import type { AdModule } from '../types';
import {
  alpha,
  backOut,
  box,
  camera,
  caption,
  clamp,
  disc,
  ease,
  easeIn,
  easeOut,
  glow,
  H,
  handOf,
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
  vignette,
  W,
  write,
  type Ctx,
  type Figure,
  type View,
} from '../kit';
import { composeAd } from '../score-kit';

// Carry-In Movers, 10 s: the moving order comes back all green checks, two movers whistle a whole
// house down the lane to its open plot, and the newcomer brings the plant.

/** The moving order: the town’s real rules for a first house, ticked one box at a time. */
export const ORDER = [
  'One new house file',
  'Your first house',
  'All checks green',
  'Up to date',
] as const;
export const FOOTNOTE = 'Heavy lifting: us.';
export const MOVED_IN = 'Your house has moved in.';

// Story beats in spot progress (0..1 across the 10 s), shared by the picture and the jingle.
export const CHECKS = [0.035, 0.062, 0.089, 0.116] as const;
const STROKE = 0.012;
export const NOTE = 0.135;
export const CUT = 0.23;
export const ARRIVE = 0.45;
export const SET_DOWN = 0.49;
export const PLANT = 0.53;
export const DOOR = 0.555;
export const LANTERN = 0.59;
/** Everything has happened well before the sponsor slate at 0.7. */
export const END = 0.66;

const TEAL = '#3F7A6E',
  TEAL_DEEP = '#2F5E55',
  TEAL_LIGHT = '#5E9A8C',
  CAP = '#C8553D',
  GLOVE = '#D9BF8C',
  GLOVE_DEEP = '#B89C6A',
  INK = '#2F3A33',
  PAPER = '#FDFCF8',
  CHECK = '#3E9A56',
  WARM = '#FFE3A6';

// ---------------------------------------------------------------------------------------------
// Shot 1: the moving order on a clipboard.

const BOX_X = 207;
const ROW_Y = [84, 104, 124, 144] as const;
const REST = [268, 150] as const;

/** Where each tick starts, bends and ends: a quick hand-drawn check that overshoots the box. */
function tickPoints(i: number) {
  const x = BOX_X,
    y = ROW_Y[i] - 9;
  return [x + 2, y + 6, x + 5, y + 9, x + 13, y - 3] as const;
}
function tick(i: number, t: number) {
  const [ax, ay, bx, by, cx, cy] = tickPoints(i);
  if (t < 0.35) {
    const u = t / 0.35;
    return {
      points: [ax, ay, lerp(ax, bx, u), lerp(ay, by, u)],
      tip: [lerp(ax, bx, u), lerp(ay, by, u)],
    };
  }
  const u = (t - 0.35) / 0.65;
  const tip = [lerp(bx, cx, u), lerp(by, cy, u)];
  return { points: [ax, ay, bx, by, ...tip], tip };
}

/** The pencil tip: it hops from box to box, ticks each one, then goes back to the pocket. */
function pencilTip(p: number): readonly number[] {
  let from: readonly number[] = REST;
  let start = 0.005;
  for (let i = 0; i < CHECKS.length; i++) {
    const c = CHECKS[i];
    if (p < c) {
      const t = ease(span(p, start, c));
      const [ax, ay] = tickPoints(i);
      return [lerp(from[0], ax, t), lerp(from[1], ay, t) - Math.sin(t * Math.PI) * 5];
    }
    if (p < c + STROKE) return tick(i, span(p, c, c + STROKE)).tip;
    const [, , , , cx, cy] = tickPoints(i);
    from = [cx, cy];
    start = c + STROKE;
  }
  const t = ease(span(p, start, start + 0.05));
  return [lerp(from[0], REST[0], t), lerp(from[1], REST[1], t) - Math.sin(t * Math.PI) * 4];
}

/** A mover’s green pencil in a work glove, held to write: tip down-left, sleeve off to the right. */
function pencil(ctx: Ctx, x: number, y: number) {
  const dx = 0.55,
    dy = -0.83;
  // A point `d` along the pencil from its tip, `side` pixels across it.
  const at = (d: number, side = 0) => [x + dx * d - dy * side, y + dy * d + dx * side];
  const [gx, gy] = at(9);
  line(ctx, TEAL, 14, [gx + 9, gy + 4, gx + 140, gy + 44]);
  line(ctx, TEAL_LIGHT, 14, [gx + 9, gy + 4, gx + 12, gy + 5]);
  line(ctx, '#5E9C6A', 4, [...at(8), ...at(27)]);
  line(ctx, '#7FB88A', 1, [...at(8, -1), ...at(27, -1)]);
  line(ctx, '#B9B6AC', 4, [...at(28), ...at(30)]);
  line(ctx, '#E58A86', 4, [...at(31), ...at(33)]);
  poly(ctx, '#E8C9A0', [...at(1), ...at(7, 2), ...at(7, -2)]);
  poly(ctx, INK, [...at(0), ...at(2.8, 0.9), ...at(2.8, -0.9)]);
  oval(ctx, gx + 4, gy + 2, 7, 6, GLOVE, 0.4);
  oval(ctx, gx - 1, gy - 1, 3.5, 2.2, GLOVE_DEEP, -0.6);
  box(ctx, gx + 1, gy + 5, 7, 1, GLOVE_DEEP);
}

function orderShot(ctx: Ctx, p: number, seconds: number) {
  // An out-of-focus lane behind the clipboard.
  sky(ctx, ['#8EC3E0', '#B2D6E6', '#DCEBE4'], 0, 114);
  for (let i = 0; i < 3; i++) {
    const x = ((i * 130 + seconds * 5) % 420) - 50;
    oval(ctx, x, 26 + i * 14, 34, 8, alpha('#FFFFFF', 0.5));
  }
  oval(ctx, 40, 114, 100, 16, '#9FC084');
  oval(ctx, 290, 116, 110, 18, '#95B97A');
  box(ctx, 0, 112, W, H - 112, '#86A870');
  box(ctx, 16, 84, 44, 30, alpha('#F1E4C6', 0.7));
  poly(ctx, alpha('#B8674A', 0.7), [10, 86, 38, 66, 66, 86]);
  box(ctx, 262, 88, 40, 26, alpha('#D6E0E4', 0.7));
  poly(ctx, alpha('#5E6E8A', 0.7), [256, 90, 282, 72, 308, 90]);
  box(ctx, 0, 140, W, 40, alpha('#6E9460', 0.5));

  // The clipboard, held up to the lens.
  box(ctx, 89, 15, 148, 176, alpha('#0B0E14', 0.2));
  box(ctx, 86, 12, 148, 176, '#9A7650');
  box(ctx, 86, 12, 3, 176, '#86643F');
  box(ctx, 94, 22, 132, 166, PAPER);
  box(ctx, 94, 22, 132, 2, '#EDEAE0');
  box(ctx, 134, 8, 52, 18, '#B9B6AC');
  box(ctx, 134, 22, 52, 4, '#8E8A80');
  box(ctx, 146, 12, 28, 6, '#8E8A80');
  write(ctx, 'CARRY-IN MOVERS', 160, 40, { size: 7, color: TEAL });
  write(ctx, 'Moving day.', 160, 60, { size: 16, type: 'serif', color: INK });
  box(ctx, 106, 66, 108, 1, '#D8D2C0');
  for (let i = 0; i < ORDER.length; i++) {
    const done = p >= CHECKS[i] + STROKE * 0.35;
    box(ctx, BOX_X, ROW_Y[i] - 9, 11, 11, '#A8A294');
    box(ctx, BOX_X + 1, ROW_Y[i] - 8, 9, 9, done ? '#E4F2E2' : PAPER);
    write(ctx, ORDER[i], 104, ROW_Y[i], { size: 8, color: INK, align: 'left' });
    const t = span(p, CHECKS[i], CHECKS[i] + STROKE);
    if (t > 0) line(ctx, CHECK, 2.2, tick(i, t).points);
  }
  // The punchline, in the mover’s own hand.
  const note = backOut(span(p, NOTE, NOTE + 0.02));
  if (note > 0) {
    ctx.save();
    ctx.translate(160, 170);
    ctx.scale(note, note);
    write(ctx, FOOTNOTE, 0, 0, { size: 11, type: 'italic', color: TEAL_DEEP });
    ctx.restore();
  }

  // One mover holds the board; the other ticks the boxes.
  line(ctx, TEAL, 14, [-20, 214, 72, 140]);
  line(ctx, TEAL_LIGHT, 14, [66, 145, 70, 141]);
  oval(ctx, 80, 134, 8, 7, GLOVE);
  for (let k = 0; k < 3; k++) {
    oval(ctx, 89, 127 + k * 5, 4, 2.4, GLOVE);
    box(ctx, 87, 128 + k * 5, 4, 1, GLOVE_DEEP);
  }
  oval(ctx, 84, 124, 2.5, 4, GLOVE_DEEP);
  const [tx, ty] = pencilTip(p);
  pencil(ctx, tx, ty);
}

// ---------------------------------------------------------------------------------------------
// Shot 2: down the lane to the open plot.

const WORLD = { w: 460, h: H };
const HORIZON = 128;
const GL = 146;
const PX = 330;
const LX = PX + 64;
const HX0 = 100;

type Paint = { wall: string; side: string; roof: string; roofSide: string; door: string };
const HOME: Paint = {
  wall: '#F1E4C6',
  side: '#DECDA8',
  roof: '#B8674A',
  roofSide: '#A35840',
  door: '#6E4E40',
};
const NEIGHBORS: readonly (readonly [number, Paint])[] = [
  [34, { wall: '#D6E0E4', side: '#BCC8CE', roof: '#5E6E8A', roofSide: '#4E5E78', door: '#3E4A5E' }],
  [
    104,
    { wall: '#E8D8C0', side: '#D2BFA4', roof: '#6E8A5E', roofSide: '#5E7A50', door: '#5A4632' },
  ],
];

const BIG: Figure = {
  skin: '#E0AC88',
  hair: '#5A3A2A',
  coat: TEAL,
  legs: TEAL_DEEP,
  shoes: '#3A3230',
  build: 'adult',
  size: 1.2,
  hat: 'cap',
  hatColor: CAP,
};
const SMALL: Figure = {
  skin: '#8A5E44',
  hair: '#1C1A20',
  coat: TEAL,
  legs: TEAL_DEEP,
  shoes: '#3A3230',
  build: 'adult',
  size: 1.1,
  hat: 'cap',
  hatColor: CAP,
};
/** The same newcomer who put a paper down on an open plot at Open Plot Realty. */
const NEWCOMER: Figure = {
  skin: '#B07A58',
  hair: '#2A2226',
  coat: '#5E86B8',
  legs: '#4A5A6E',
  build: 'adult',
  size: 1.05,
  hat: 'beanie',
  hatColor: '#7B5A78',
};

/** Where the house is along the lane: a steady march that slows to a stop over the plot. */
export function carryX(p: number) {
  const t = span(p, CUT - 0.02, ARRIVE);
  const t0 = 0.7,
    v = 1 / (t0 + (1 - t0) / 2);
  const q = t < t0 ? v * t : v * t0 + v * (t - t0) - (v * (t - t0) ** 2) / (2 * (1 - t0));
  return lerp(HX0, PX, q);
}

function pane(ctx: Ctx, x: number, y: number, w: number, h: number, lit: number, wall: string) {
  box(ctx, x, y, w, h, mix('#9CC4D8', '#FFD98A', lit));
  box(ctx, x, y, w, 1, mix('#C4E0EC', '#FFE8B8', lit));
  box(ctx, x + Math.floor(w / 2), y, 1, h, wall);
  box(ctx, x - 1, y + h, w + 2, 1, '#F8F7F2');
}

/** A Forktown cottage, drawn from its doorstep (x, base) so it can be lifted, tilted and set down. */
function house(
  ctx: Ctx,
  x: number,
  base: number,
  look: Paint,
  { lit = 0, open = 0, scale = 1, tilt = 0, squash = 0 } = {},
) {
  ctx.save();
  ctx.translate(x, base);
  ctx.rotate(tilt);
  ctx.scale(scale * (1 + squash * 0.6), scale * (1 - squash));
  box(ctx, 12, -47, 7, 16, '#9A5E4C');
  box(ctx, 11, -49, 9, 3, '#7E4A3C');
  box(ctx, -26, -28, 52, 28, look.wall);
  box(ctx, -26, -28, 4, 28, look.side);
  box(ctx, -26, -2, 52, 2, '#A89C84');
  poly(ctx, look.roof, [-31, -27, 0, -48, 31, -27]);
  poly(ctx, look.roofSide, [-31, -27, 0, -48, 0, -27]);
  box(ctx, -31, -28, 62, 2, mix(look.roofSide, '#2A1E18', 0.25));
  disc(ctx, 0, -36, 3.5, mix(look.roofSide, '#2A1E18', 0.3));
  disc(ctx, 0, -36, 2.2, mix('#9CC4D8', '#FFD98A', lit));
  pane(ctx, -20, -22, 12, 9, lit, look.wall);
  pane(ctx, 13, -22, 9, 9, lit, look.wall);
  box(ctx, -21, -12, 14, 3, '#6F9A58');
  for (let i = 0; i < 4; i++) box(ctx, -20 + i * 3.5, -13, 1, 1, i % 2 ? '#F8F7F2' : '#E58A86');
  // The front door, and the warm room behind it once it swings open.
  box(ctx, -3, -18, 12, 16, mix(look.door, '#2A1E18', 0.3));
  box(ctx, -2, -17, 10, 15, mix('#3A2A22', WARM, open));
  const door = 10 * (1 - open * 0.78);
  box(ctx, -2, -17, door, 15, mix(look.door, '#4A362C', open * 0.6));
  if (door > 4) box(ctx, -2 + door - 3, -10, 1, 1, '#D8C8A8');
  box(ctx, -5, -2, 16, 2, '#C9B48B');
  ctx.restore();
}

function tree(ctx: Ctx, x: number, base: number, r: number) {
  box(ctx, x - 2, base - r, 4, r, '#6A5040');
  disc(ctx, x, base - r - r * 0.5, r, '#5E8A4E');
  disc(ctx, x - r * 0.5, base - r - r * 0.2, r * 0.7, '#6E9A58');
  disc(ctx, x + r * 0.4, base - r - r * 0.9, r * 0.55, '#7FAA64');
}

function lanternPost(ctx: Ctx, x: number, base: number, lit: number) {
  if (lit > 0) glow(ctx, x, base - 30, 34, '#FFD27A', lit * 0.65);
  box(ctx, x - 1, base - 27, 2, 27, '#3E3A40');
  box(ctx, x - 3, base - 1, 6, 2, '#3E3A40');
  box(ctx, x - 3, base - 35, 7, 9, '#3E3A40');
  box(ctx, x - 2, base - 34, 5, 7, mix('#5E5C66', '#FFE6A8', lit));
  poly(ctx, '#3E3A40', [x - 4, base - 35, x + 0.5, base - 39, x + 5, base - 35]);
  if (lit > 0) glow(ctx, x, base + 2, 18, '#FFD27A', lit * 0.25);
}

/** The open plot: string lines between four pegs, and a pennant until the house arrives. */
function plot(ctx: Ctx, p: number, seconds: number) {
  oval(ctx, PX, GL + 2, 40, 5, '#B89A6E');
  oval(ctx, PX, GL + 1, 34, 3, '#C8AA7C');
  for (const dx of [-36, 36]) {
    box(ctx, PX + dx - 1, GL - 6, 2, 9, '#8E6C4C');
    box(ctx, PX + dx - 1, GL - 7, 2, 1, '#F8F7F2');
  }
  box(ctx, PX - 36, GL - 5, 72, 1, alpha('#F8F7F2', 0.8));
  if (p < SET_DOWN) {
    const flap = Math.sin(seconds * 6) * 1.5;
    box(ctx, PX + 35, GL - 20, 1, 15, '#8E6C4C');
    poly(ctx, CAP, [PX + 36, GL - 20, PX + 45, GL - 17 + flap, PX + 36, GL - 14]);
  }
}

function plant(ctx: Ctx, x: number, y: number) {
  poly(ctx, '#B8674A', [x - 4, y - 6, x + 4, y - 6, x + 3, y, x - 3, y]);
  box(ctx, x - 5, y - 7, 10, 2, '#C97C5C');
  oval(ctx, x - 3, y - 11, 2.5, 4.5, '#5E9A4E', -0.4);
  oval(ctx, x + 3, y - 11, 2.5, 4.5, '#5E9A4E', 0.4);
  oval(ctx, x, y - 13, 2.5, 5.5, '#7FB36A');
  disc(ctx, x + 1, y - 18, 1.5, '#E58A86');
}

/** A figure that can bend at the knees while it sets something heavy down. */
function figure(ctx: Ctx, x: number, y: number, f: Figure, crouch = 0) {
  if (crouch <= 0) return person(ctx, x, y, f);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 + crouch * 0.06, 1 - crouch * 0.16);
  person(ctx, 0, 0, f);
  ctx.restore();
}

function musicNote(ctx: Ctx, x: number, y: number, a: number) {
  const ink = alpha(INK, a);
  box(ctx, x, y, 3, 2, ink);
  box(ctx, x + 2, y - 6, 1, 7, ink);
  box(ctx, x + 3, y - 6, 2, 1, ink);
  box(ctx, x + 4, y - 5, 1, 2, ink);
}

function puffs(ctx: Ctx, p: number) {
  // Dust from both corners, and the chimney lets out one surprised breath.
  const t = span(p, SET_DOWN, SET_DOWN + 0.06);
  if (t > 0 && t < 1)
    for (const side of [-1, 1])
      for (let k = 0; k < 3; k++)
        disc(
          ctx,
          PX + side * (27 + t * (8 + k * 5)),
          GL - 1 - k * 2 - t * 3,
          1.5 + t * (3 - k * 0.6),
          alpha('#E6DCC4', (1 - t) * 0.9),
        );
  const s = span(p, SET_DOWN + 0.005, SET_DOWN + 0.09);
  if (s > 0 && s < 1)
    for (let k = 0; k < 3; k++)
      disc(
        ctx,
        PX + 15 + k * 2 + s * 5,
        GL - 51 - s * 16 - k * 4,
        2 + s * 3 - k * 0.5,
        alpha('#F4F1EA', (1 - s) * 0.85),
      );
}

function lane(ctx: Ctx, p: number, seconds: number) {
  const dusk = ease(span(p, 0.3, LANTERN));
  // The far side: hills and a tree line, then the neighbors, then the lane in front.
  oval(ctx, 90, HORIZON + 4, 150, 22, mix('#9FC084', '#7E9A78', dusk));
  oval(ctx, 330, HORIZON + 6, 180, 24, mix('#95B97A', '#76927A', dusk));
  box(ctx, 0, HORIZON, WORLD.w, H - HORIZON, mix('#86A870', '#6E8E66', dusk));
  for (const [x, look] of NEIGHBORS) house(ctx, x, GL - 8, look, { scale: 0.78 });
  tree(ctx, 160, GL - 8, 9);
  tree(ctx, 214, GL - 10, 7);
  tree(ctx, 436, GL - 8, 11);
  for (let x = 236; x < 290; x += 9) disc(ctx, x, GL - 10, 6, '#6E9A58');
  box(ctx, 0, GL + 5, WORLD.w, 11, mix('#D2C29C', '#B8AA8C', dusk));
  box(ctx, 0, GL + 5, WORLD.w, 1, '#E4D8B8');
  box(ctx, 0, GL + 16, WORLD.w, H - GL - 16, mix('#7FA06A', '#627E5C', dusk));
  plot(ctx, p, seconds);
  lanternPost(ctx, LX, GL + 1, ease(span(p, LANTERN, LANTERN + 0.03)));

  // The house, carried: it bobs with the movers’ step, then comes down with a bump.
  const hx = carryX(p);
  const walking = p < ARRIVE;
  const step = seconds * 10;
  const lift =
    (1 - easeIn(span(p, ARRIVE, SET_DOWN))) * 18 + (walking ? Math.abs(Math.sin(step)) : 0);
  const open = easeOut(span(p, DOOR, DOOR + 0.03));
  const lit = ease(span(p, DOOR, DOOR + 0.04));
  if (open > 0) glow(ctx, PX + 3, GL - 6, 22, '#FFD98A', open * 0.4);
  shade(ctx, hx, GL + 2, 62 - lift, 0.16);
  house(ctx, hx, GL + 1 - lift, HOME, {
    lit,
    open,
    tilt: walking ? Math.sin(step) * 0.02 : 0,
    squash: hump(p, SET_DOWN, SET_DOWN + 0.025) * 0.05,
  });
  puffs(ctx, p);

  // The movers: in step, whistling, then a ta-da either side of the door.
  const crouch =
    p < SET_DOWN ? ease(span(p, ARRIVE, SET_DOWN)) : 1 - ease(span(p, SET_DOWN, SET_DOWN + 0.03));
  const away = ease(span(p, SET_DOWN + 0.01, SET_DOWN + 0.04));
  const stepping = walking || (away > 0 && away < 1);
  const tada = backOut(span(p, LANTERN - 0.005, LANTERN + 0.02));
  const hold: [number, number] = [0.15, lerp(0.15, 2.3, tada)];
  const mood = {
    eyes: 'happy' as const,
    mouth: tada > 0.3 ? ('grin' as const) : ('smile' as const),
  };
  const smallX = away > 0 ? lerp(PX - 35, PX - 58, away) : hx - 35;
  const bigX = away > 0 ? lerp(PX + 32, PX + 46, away) : hx + 32;
  shade(ctx, smallX, GL + 2, 14);
  shade(ctx, bigX, GL + 2, 16);
  figure(
    ctx,
    smallX,
    GL + 2,
    {
      ...SMALL,
      ...mood,
      step: stepping ? step : undefined,
      arms: p < SET_DOWN + 0.01 ? [0.9, 0.9] : hold,
    },
    crouch,
  );
  figure(
    ctx,
    bigX,
    GL + 2,
    {
      ...BIG,
      ...mood,
      mouth: walking ? 'o' : mood.mouth,
      facing: away > 0.5 ? -1 : 1,
      step: stepping ? step : undefined,
      arms: p < SET_DOWN + 0.01 ? [-0.9, -0.9] : hold,
    },
    crouch,
  );
  const tune = presence(p, CUT, ARRIVE + 0.02, 0.03);
  if (tune > 0)
    for (let k = 0; k < 3; k++) {
      const phase = (seconds * 0.9 + k / 3) % 1;
      musicNote(ctx, bigX + 8 + phase * 12, GL - 48 - phase * 18, tune * Math.sin(phase * Math.PI));
    }

  // The newcomer: all they carry is the plant, and it is plenty.
  const catchUp = span(p, ARRIVE, PLANT - 0.012);
  const nx = p < ARRIVE ? hx - 60 : lerp(PX - 60, PX - 32, easeOut(catchUp));
  const ny = GL + 8 - hump(p, LANTERN, LANTERN + 0.035) * 4;
  const moving = p < PLANT - 0.012;
  const setting = span(p, PLANT - 0.012, PLANT);
  const placed = p >= PLANT;
  let arms: [number, number] = [1.1, 1.3];
  if (placed)
    arms =
      p < DOOR - 0.004
        ? [0.1, 2.9]
        : p < LANTERN
          ? [0.1, 0.4]
          : [0.3, 2 + Math.sin(seconds * 9) * 0.3];
  else if (setting > 0) arms = [lerp(1.1, 0.5, setting), lerp(1.3, 0.6, setting)];
  const f: Figure = {
    ...NEWCOMER,
    step: moving ? seconds * 8 + 1 : undefined,
    arms,
    lean: moving ? -0.08 : setting > 0 && !placed ? 0.3 * setting : 0,
    eyes: p >= LANTERN ? 'happy' : p >= DOOR ? 'wide' : placed ? 'closed' : 'closed',
    mouth: p >= LANTERN ? 'grin' : p >= DOOR ? 'o' : placed ? 'smile' : 'flat',
  };
  shade(ctx, nx, ny, 14);
  person(ctx, nx, ny, f);
  if (placed) plant(ctx, PX - 21, GL + 8);
  else {
    const hand = handOf(nx, ny, f);
    plant(ctx, lerp(hand.x + 1, PX - 21, setting), lerp(hand.y + 5, GL + 8, setting));
  }
  if (!placed) {
    const drip = (seconds * 1.7) % 1;
    const wet = alpha('#9CD0EA', 1 - drip);
    disc(ctx, nx - 8 - drip * 3, ny - 38 + drip * 10, 1.8, wet);
    box(ctx, nx - 8.5 - drip * 3, ny - 42 + drip * 10, 1, 3, wet);
  }
}

/** The camera walks with the house, then settles in on the doorstep and the lantern. */
function laneView(p: number): View {
  const follow = { x: carryX(p) + 24, y: 110, zoom: 1.3 };
  const settle = ease(span(p, ARRIVE - 0.03, DOOR));
  return {
    x: lerp(follow.x, PX + 8, settle),
    y: lerp(follow.y, 116, settle),
    zoom: lerp(follow.zoom, 1.5, settle),
  };
}

function laneShot(ctx: Ctx, p: number, seconds: number) {
  const view = laneView(p);
  const dusk = ease(span(p, 0.3, LANTERN));
  const hh = H / 2 / view.zoom;
  const y = clamp(view.y, hh, H - hh);
  const horizon = (HORIZON - y) * view.zoom + H / 2;
  sky(
    ctx,
    [
      mix('#8EC3E0', '#7088B4', dusk),
      mix('#AAD2E4', '#A09CC0', dusk),
      mix('#CFE4E6', '#D8B0B4', dusk),
      mix('#EDEFD8', '#F0CCA8', dusk),
    ],
    0,
    horizon + 2,
  );
  for (let i = 0; i < 3; i++) {
    const x = ((((i * 150 + seconds * 4 - view.x * 0.3) % 440) + 440) % 440) - 60;
    oval(ctx, x, 22 + i * 12, 30, 7, alpha('#FFFFFF', 0.45 - dusk * 0.2));
  }
  camera(ctx, view, () => lane(ctx, p, seconds), WORLD);
  caption(ctx, MOVED_IN, presence(p, DOOR + 0.005, 0.72, 0.02));
}

export const carryInMoversAdScore: AdModule['score'] = (ad) =>
  composeAd(ad, (s) => {
    // Score time runs a breath behind the picture: convert each picture beat so it lands.
    const at = (p: number) => (p * ad.duration - 0.1) / (ad.duration - 0.4);
    s.section({
      from: 0,
      to: at(CUT),
      bpm: 112,
      root: 60,
      chords: [0, 5],
      groove: 'tick',
      voice: 'pluck',
      gain: 0.5,
      level: 0.7,
      fade: 0.15,
    });
    CHECKS.forEach((c, i) => {
      s.fx('scribble', at(c), 0.14, 0.12, 0.25);
      s.note(at(c + STROKE), 72 + [0, 4, 7, 12][i], 0.5, 'bell', 0.07, 0.1);
    });
    s.fx('pop', at(NOTE), 0.14, 0.1);
    s.fx('swish', at(CUT - 0.014), 0.3, 0.12);
    s.section({
      from: at(CUT),
      to: at(END) + 0.04,
      bpm: 112,
      root: 60,
      chords: [0, 5, 7, 0],
      groove: 'march',
      voice: 'pluck',
      gain: 0.4,
      level: 0.75,
      fade: 0.4,
    });
    // The big mover whistles the whole way down the lane.
    const eighth = 60 / 112 / 2 / (ad.duration - 0.4);
    [7, 12, 11, 7, 9, 7, 4, 7].forEach((d, i) =>
      s.note(at(CUT) + 0.01 + i * eighth, 72 + d, 0.26, 'lead', 0.05, 0.2),
    );
    s.fx('thud', at(SET_DOWN), 0.5, 0.3);
    s.fx('rumble', at(SET_DOWN), 0.4, 0.08);
    s.fx('pop', at(PLANT), 0.14, 0.12, -0.3);
    s.fx('creak', at(DOOR), 0.6, 0.12, 0.1);
    s.fx('chime', at(LANTERN), 1.6, 0.14, 0.4);
    [0, 4, 7, 12].forEach((d, i) =>
      s.note(at(LANTERN) + i * 0.012, 72 + d, 0.8, 'bell', 0.05, 0.3),
    );
    s.chord(0.72, [48, 55, 60, 64], 2, 'pad', 0.05);
  });

export const carryInMoversAd: AdModule = {
  draw(ctx, p, seconds) {
    if (p < CUT) orderShot(ctx, p, seconds);
    else laneShot(ctx, p, seconds);
    // A teal wipe, the movers’ own colour, from the paperwork to the lane.
    const wipe = hump(p, CUT - 0.014, CUT + 0.014);
    if (wipe > 0) {
      box(ctx, 0, 0, W * wipe, H, TEAL);
      box(ctx, W * wipe - 6, 0, 6, H, TEAL_LIGHT);
    }
    vignette(ctx, 0.3);
  },
  score: carryInMoversAdScore,
  look: { shade: '#1F2E2A', ink: '#FFF6E2', accent: '#8FD0BE' },
};
