import { FOUNDER_SLOTS, LANTERN_HOUR } from '../../lib/lanterns';
import type { AdModule } from '../types';
import {
  alpha,
  backOut,
  box,
  camera,
  caption,
  disc,
  ease,
  faded,
  glow,
  handOf,
  hump,
  lerp,
  line,
  mix,
  oval,
  person,
  poly,
  presence,
  rand,
  sky,
  span,
  starfield,
  TAU,
  track,
  vignette,
  W,
  write,
  type Ctx,
  type Figure,
} from '../kit';
import { composeAd } from '../score-kit';

// Lantern Fork Electric, 10 s: the old lamplighter reaches for lantern No. 1 at 19:59, and the
// Fork beats him to it, oldest first. He gives up, sits down, and the streetlamps come on anyway.

/** 20:00: the clock turns over, and the Fork (and its three sisters on the ridge) wake up. */
export const NIGHTFALL = 0.1;
/** The three founders' lanterns he nearly gets to first. */
export const GAG = [0.105, 0.16, 0.205] as const;
/** The Fork is fully lit: he plants his pole, waves a hand at it (well then), blows out his
 * taper, and sits down under the nearest lamp. */
export const PLANT = 0.42;
export const SHRUG = 0.44;
export const BLOW = 0.475;
export const OUT = 0.5;
export const SIT = 0.51;
/** The streetlamps wave outward from the Fork, one pair per step. */
export const WAVE = 0.54;
const WAVE_STEP = 0.04;
/** Asleep before the slate: the story is over by here. */
export const DOZE = 0.62;

// The Fork is drawn from the town's own art (plot-local px, negative y up) at 0.72 scale.
const TREE = { x: 160, y: 148, s: 0.72 };
const LOBES = [
  { cx: -44, cy: -92, rx: 32, ry: 22 },
  { cx: 58, cy: -86, rx: 26, ry: 20 },
  { cx: 28, cy: -104, rx: 30, ry: 24 },
];
// Eight founders under the left lobe, then the neighbors along the crown and the east lobe.
const SLOTS: readonly (readonly [number, number])[] = [
  [-60, -84],
  [-53, -80],
  [-46, -78],
  [-39, -78],
  [-32, -80],
  [-25, -84],
  [-49, -88],
  [-35, -88],
  [10, -88],
  [17, -86],
  [24, -85],
  [31, -85],
  [38, -87],
  [45, -76],
  [52, -74],
  [59, -73],
  [66, -75],
  [20, -94],
  [34, -94],
  [50, -81],
  [64, -81],
  [14, -100],
  [27, -100],
  [40, -100],
];
/** Every lantern in lighting order, oldest first: world px of its cap, and when it comes on. */
export const LANTERNS = SLOTS.map(([lx, ly], i) => {
  const founder = i < FOUNDER_SLOTS;
  const at = founder
    ? (GAG[i] ?? 0.235 + (i - GAG.length) * 0.016)
    : 0.315 + (i - FOUNDER_SLOTS) * 0.0068;
  return { x: TREE.x + lx * TREE.s, y: TREE.y + ly * TREE.s, at, founder };
});
/** The newest neighbor's lantern flies the terracotta pennant; it is the last to light. */
export const NEWEST = LANTERNS.length - 1;
/** Streetlamps either side of the Fork; the nearest pair first. */
export const LAMPS = [76, 108, 138].flatMap((reach, k) =>
  [-1, 1].map((side) => ({ x: TREE.x + side * reach, at: WAVE + k * WAVE_STEP })),
);

const INK = '#F1EEDC';
const GLOW = '#FFE0A0';
const LIT = '#FFE0A0';
const CORE = '#FFF6D8';
const UNLIT = '#7C8676';
const CAP = '#3A382E';
const ROAD_Y = 155;

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
/** What the little clock in the corner reads: a minute to nightfall, then nightfall itself. */
export const clockText = (p: number) => hhmm(LANTERN_HOUR.start - (p < NIGHTFALL ? 1 : 0));

/** 0 until the light comes on, a quick bloom past 1, then steady. */
const bloom = (p: number, at: number) => (p < at ? 0 : backOut(span(p, at, at + 0.025)));

export const lanternForkElectricAdScore: AdModule['score'] = (ad) =>
  composeAd(ad, (s) => {
    // Story time runs a breath ahead of the picture: convert, so each sound lands on its frame.
    const at = (p: number) => (p * s.duration - s.time(0)) / s.story;
    for (const [i, t] of [0.02, 0.05, 0.08].entries())
      s.fx('tick', at(t), 0.08, 0.1, i % 2 ? 0.25 : -0.25);
    s.fx('toll', at(NIGHTFALL), 2.4, 0.09, -0.1);
    s.fx('chime', at(NIGHTFALL), 1.4, 0.05, 0.7);
    s.section({
      from: at(NIGHTFALL),
      to: at(0.7),
      bpm: 88,
      root: 55,
      chords: [0, 5, 7, 0],
      groove: 'waltz',
      voice: 'keys',
      gain: 0.55,
      fade: 0.5,
    });
    // Oldest first: the founders climb a pentatonic scale, the neighbors shimmer above it.
    const founders = [67, 69, 71, 74, 76, 79, 81, 83];
    const shimmer = [86, 83, 79, 83, 86, 88, 91, 88, 86, 83, 86, 88, 91, 93, 95, 98];
    LANTERNS.forEach((lantern, i) => {
      const pan = (lantern.x / W - 0.5) * 1.4;
      if (lantern.founder) s.note(at(lantern.at), founders[i], 0.9, 'bell', 0.07, pan);
      else s.note(at(lantern.at), shimmer[i - FOUNDER_SLOTS], 0.6, 'bell', 0.035, pan);
    });
    // He gasps when the first one beats him, and huffs at the next two.
    s.fx('gasp', at(GAG[0] + 0.004), 0.45, 0.08, -0.35);
    s.fx('pop', at(GAG[1]), 0.12, 0.08, -0.3);
    s.fx('pop', at(GAG[2]), 0.12, 0.09, -0.25);
    s.fx('sparkle', at(LANTERNS[NEWEST].at), 1.2, 0.08, 0.3);
    s.fx('swish', at(SHRUG), 0.25, 0.05, -0.3);
    s.fx('wind', at(BLOW), 0.35, 0.08, -0.3);
    s.fx('thud', at(SIT), 0.2, 0.07, -0.3);
    for (const lamp of LAMPS) {
      const pan = (lamp.x / W - 0.5) * 1.6;
      s.fx('click', at(lamp.at), 0.1, 0.1, pan);
      s.fx('hum', at(lamp.at), 0.5, 0.03, pan);
    }
    for (const [k, pitch] of [62, 59, 55].entries())
      s.note(at(WAVE + k * WAVE_STEP), pitch, 1.4, 'bell', 0.06, 0);
    s.fx('snore', at(DOZE), 1.6, 0.05, -0.3);
    s.chord(0.72, [43, 50, 55, 59], 2.4, 'pad', 0.05);
  });

export const lanternForkElectricAd: AdModule = {
  draw(ctx, p, seconds) {
    const night = ease(span(p, 0, 0.6));
    sky(
      ctx,
      [
        mix('#27305A', '#0F1729', night),
        mix('#3C4570', '#16213A', night),
        mix('#5E5C86', '#1D2C47', night),
        mix('#86708A', '#2A3A56', night),
      ],
      0,
      140,
    );
    faded(ctx, 0.3 + night * 0.7, () =>
      starfield(ctx, seconds, { count: 30, seed: 20, bottom: 100 }),
    );
    moon(ctx, 276, 26, 8, alpha('#F4EFD8', 0.85));
    // One slow take: close on the lamplighter, out to the whole Fork, then out to the street.
    const view = track(p, [
      [0, 126, 109, 1.9],
      [0.22, 128, 108, 1.9],
      [0.3, 132, 106, 1.8],
      [0.41, 160, 100, 1.35],
      [0.47, 140, 106, 1.55],
      [0.5, 140, 106, 1.55],
      [0.64, 160, 96, 1.12],
    ]);
    // The ridge sits far off, so it moves a third as much.
    const far = {
      x: lerp(160, view.x, 0.35),
      y: lerp(90, view.y, 0.35),
      zoom: 1 + (view.zoom - 1) * 0.35,
    };
    camera(ctx, far, () => ridge(ctx, p));
    camera(ctx, view, () => street(ctx, p, seconds));
    clock(ctx, p);
    caption(ctx, 'Oldest first. No pushing.', presence(p, 0.22, 0.44, 0.02), { y: 24 });
    vignette(ctx, 0.4);
  },
  score: lanternForkElectricAdScore,
  look: { shade: '#141C2C', ink: INK, accent: '#BFD8A6' },
};

/** A thin crescent: the disc, minus a second disc, clipped so the sky shows through. */
function moon(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  ctx.beginPath();
  ctx.rect(x - r, y - r, r * 2, r * 2);
  ctx.arc(x - r * 0.5, y - r * 0.25, r * 0.9, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill('evenodd');
  ctx.restore();
}

/** The far ridge with its three sister forks, which keep the same nightfall as the Fork. */
function ridge(ctx: Ctx, p: number) {
  poly(
    ctx,
    '#1A2536',
    [0, 128, 46, 121, 96, 126, 150, 119, 204, 125, 256, 118, 320, 124, 320, 180, 0, 180],
  );
  poly(ctx, '#1F2C3A', [0, 134, 64, 129, 128, 133, 190, 128, 250, 132, 320, 128, 320, 180, 0, 180]);
  const lit = bloom(p, NIGHTFALL);
  for (const [x, y] of [
    [34, 123],
    [253, 120],
    [291, 122],
  ]) {
    box(ctx, x, y - 5, 1, 5, '#141C28');
    box(ctx, x - 2, y - 7, 2, 2, '#141C28');
    box(ctx, x + 1, y - 7, 2, 2, '#141C28');
    disc(ctx, x - 2, y - 9, 3, '#172230');
    box(ctx, x + 2, y - 6, 1, 1, lit > 0 ? LIT : '#3C4450');
    glow(ctx, x + 2.5, y - 5.5, 6, GLOW, lit * 0.5);
    for (let k = 0; k < 3; k++) box(ctx, x + 5 + k * 4, y - 2 - (k % 2), 3, 3 + (k % 2), '#141C28');
  }
}

const HOUSES = [
  { x: 26, w: 23, h: 17, wall: '#46524E', roof: '#3A3242', lantern: 1 },
  { x: 57, w: 20, h: 14, wall: '#4E4C46', roof: '#2E3A46', lantern: 5 },
  { x: 242, w: 20, h: 15, wall: '#4A5250', roof: '#3A3040', lantern: 12 },
  { x: 274, w: 21, h: 18, wall: '#524E48', roof: '#343A46', lantern: 20 },
];

function street(ctx: Ctx, p: number, seconds: number) {
  box(ctx, 0, 138, W, 42, '#22342A');
  box(ctx, 0, 138, W, 1, '#2C4232');
  // Each house's windows and its lantern post light with its lantern on the Fork.
  for (const house of HOUSES) {
    const lit = bloom(p, LANTERNS[house.lantern].at);
    const base = 146;
    box(ctx, house.x, base - house.h, house.w, house.h, house.wall);
    poly(ctx, house.roof, [
      house.x - 2,
      base - house.h,
      house.x + house.w / 2,
      base - house.h - 9,
      house.x + house.w + 2,
      base - house.h,
    ]);
    const door = house.x + Math.round(house.w / 2) - 2;
    box(ctx, door, base - 7, 4, 7, '#2A2A30');
    for (const wx of [house.x + 3, house.x + house.w - 7]) {
      box(
        ctx,
        wx,
        base - house.h + 4,
        4,
        4,
        lit > 0 ? mix('#2E3838', LIT, Math.min(1, lit)) : '#2E3838',
      );
      glow(ctx, wx + 2, base - house.h + 6, 7, GLOW, lit * 0.3);
    }
    box(ctx, house.x + 2, base - 6, 1, 10, '#4A4538');
    box(ctx, house.x + 2, base - 6, 3, 1, '#4A4538');
    box(ctx, house.x + 3, base - 4, 3, 3, lit > 0 ? LIT : UNLIT);
    glow(ctx, house.x + 4.5, base - 2.5, 6, GLOW, lit * 0.45);
  }
  const all = bloom(p, LANTERNS[NEWEST].at);
  glow(ctx, 168, 82, 86, GLOW, all * 0.12);
  fork(ctx);
  LANTERNS.forEach((lantern, i) => hang(ctx, lantern, p, i === NEWEST));
  lamplighter(ctx, p, seconds);
  // The road in front of the Fork, with a kerb.
  box(ctx, 0, ROAD_Y - 1, W, 1, '#4A4E44');
  box(ctx, 0, ROAD_Y, W, 10, '#393C35');
  box(ctx, 0, ROAD_Y + 10, W, 15, '#18241C');
  for (let x = 6; x < W; x += 22) box(ctx, x, ROAD_Y + 5, 9, 1, '#4E5046');
  for (const lamp of LAMPS) streetlamp(ctx, lamp.x, bloom(p, lamp.at));
  if (p >= SIT) {
    // His pole, parked against the nearest lamp.
    line(ctx, '#6F5A3C', 1, [95, 153, 85.5, 121]);
    box(ctx, 85, 120, 1, 2, '#9A8A64');
  }
}

/** The Fork itself: trunk, two limbs and three stepped lobes, in the town's night colours. */
function fork(ctx: Ctx) {
  ctx.save();
  ctx.translate(TREE.x, TREE.y);
  ctx.scale(TREE.s, TREE.s);
  const bark = '#5C5446',
    barkLight = '#6E6452',
    barkDark = '#463F36';
  oval(ctx, 6, 3, 58, 12, alpha('#0B1715', 0.4));
  box(ctx, -14, -3, 8, 5, bark);
  box(ctx, 7, -3, 9, 5, bark);
  poly(ctx, bark, [-9, 2, 9, 2, 6, -42, -6, -42]);
  box(ctx, -6, -42, 4, 44, barkLight);
  box(ctx, 4, -40, 3, 42, barkDark);
  const boughs = [
    [-6, -44, 9],
    [-11, -50, 9],
    [-16, -56, 9],
    [-21, -62, 9],
    [-26, -67, 9],
    [-31, -72, 9],
    [6, -46, 9],
    [10, -53, 9],
    [14, -60, 9],
    [18, -67, 9],
    [22, -74, 9],
    [25, -81, 9],
    [26, -74, 7],
    [33, -74, 7],
    [40, -74, 7],
    [47, -75, 7],
  ];
  for (const [cx, cy, w] of boughs) {
    box(ctx, cx - Math.floor(w / 2), cy - Math.floor(w / 2), w, w, bark);
    box(ctx, cx - Math.floor(w / 2), cy - Math.floor(w / 2), w, 2, barkLight);
  }
  LOBES.forEach((lobe, k) => {
    stepped(ctx, lobe, '#2E4A3A');
    stepped(ctx, lobe, '#263F31', (dy) => dy > 0.45 * lobe.ry);
    for (let i = 0; i < 6; i++) {
      const a = rand(k * 17 + i) * TAU,
        reach = 0.35 + rand(k * 31 + i * 7) * 0.45;
      box(
        ctx,
        lobe.cx + Math.cos(a) * lobe.rx * reach,
        lobe.cy + Math.sin(a) * lobe.ry * reach,
        4,
        2,
        '#243B2D',
      );
    }
    stepped(
      ctx,
      {
        cx: Math.round(lobe.cx - 0.28 * lobe.rx),
        cy: Math.round(lobe.cy - 0.32 * lobe.ry),
        rx: 0.55 * lobe.rx,
        ry: 0.5 * lobe.ry,
      },
      '#3A5A46',
    );
    box(ctx, lobe.cx - 0.45 * lobe.rx, lobe.cy - 0.62 * lobe.ry, 5, 3, '#46684F');
  });
  ctx.restore();
}

/** One lobe as a single stepped path of 2 px rows, like the town's Fork. */
function stepped(
  ctx: Ctx,
  lobe: { cx: number; cy: number; rx: number; ry: number },
  fill: string,
  keep: (dy: number) => boolean = () => true,
) {
  ctx.beginPath();
  const rows: { y: number; half: number }[] = [];
  for (let y = lobe.cy - lobe.ry; y < lobe.cy + lobe.ry; y += 2) {
    const dy = y + 1 - lobe.cy;
    const half = 2 * Math.round((lobe.rx * Math.sqrt(Math.max(0, 1 - (dy / lobe.ry) ** 2))) / 2);
    if (half > 0 && keep(dy)) rows.push({ y, half });
  }
  if (!rows.length) return;
  rows.forEach(({ y, half }, i) => {
    if (i) ctx.lineTo(lobe.cx + half, y);
    else ctx.moveTo(lobe.cx + half, y);
    ctx.lineTo(lobe.cx + half, y + 2);
  });
  for (let i = rows.length - 1; i >= 0; i--) {
    ctx.lineTo(lobe.cx - rows[i].half, rows[i].y + 2);
    ctx.lineTo(lobe.cx - rows[i].half, rows[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** A lantern on its hanger; `lit` blooms past 1 as it comes on, then holds. */
function hang(ctx: Ctx, l: (typeof LANTERNS)[number], p: number, newest: boolean) {
  const lit = bloom(p, l.at);
  const w = l.founder ? 4 : 3,
    h = l.founder ? 5 : 4;
  box(ctx, l.x + w - 2, l.y - 1, 1, 1, CAP);
  box(ctx, l.x, l.y, w, 1, CAP);
  box(ctx, l.x, l.y + 1, w, h - 1, lit > 0 ? mix(UNLIT, LIT, Math.min(1, lit * 2)) : UNLIT);
  if (lit > 0) {
    box(ctx, l.x + w - 2, l.y + h - 2, 1, 1, CORE);
    glow(
      ctx,
      l.x + w / 2,
      l.y + h / 2 + 0.5,
      (l.founder ? 10 : 8) * (0.7 + 0.3 * lit),
      GLOW,
      0.5 * lit,
    );
    // Four short rays for a moment: one soft burst, never repeated.
    const burst = hump(p, l.at, l.at + (l.founder ? 0.035 : 0.02));
    if (burst > 0) {
      const cx = l.x + w / 2 - 0.5,
        cy = l.y + h / 2;
      const ray = alpha(CORE, burst * 0.9),
        r = h / 2 + 1 + burst * 2;
      box(ctx, cx, cy - r - 2, 1, 2, ray);
      box(ctx, cx, cy + r, 1, 2, ray);
      box(ctx, cx - r - 2, cy, 2, 1, ray);
      box(ctx, cx + r + 1, cy, 2, 1, ray);
    }
  }
  if (newest) {
    // The terracotta pennant of the newest neighbor.
    poly(ctx, '#B86E5A', [l.x + w, l.y - 4, l.x + w + 6, l.y - 2.5, l.x + w, l.y - 1]);
    box(ctx, l.x + w, l.y - 4, 3, 1, '#D8977F');
  }
}

function streetlamp(ctx: Ctx, x: number, lit: number) {
  if (lit > 0) oval(ctx, x + 1, ROAD_Y + 4, 18, 4, alpha(GLOW, 0.14 * Math.min(1, lit)));
  box(ctx, x, ROAD_Y - 32, 2, 33, '#4E5A52');
  box(
    ctx,
    x - 3,
    ROAD_Y - 36,
    8,
    6,
    lit > 0 ? mix('#5E6858', '#F4D79A', Math.min(1, lit * 2)) : '#5E6858',
  );
  box(ctx, x - 4, ROAD_Y - 38, 10, 2, '#56645A');
  glow(ctx, x + 1, ROAD_Y - 33, 28, GLOW, lit * 0.32);
}

const LAMPLIGHTER: Figure = {
  skin: '#D9A47C',
  hair: '#4A3A30',
  coat: '#3E5C6C',
  legs: '#2C3240',
  shoes: '#231E26',
  build: 'adult',
  size: 0.85,
  hat: 'cap',
  hatColor: '#26343E',
  facing: 1,
};
const HOME = { x: 98, y: 151 };
/** The shoulder the pole arm swings from, for this figure standing still. */
const SHOULDER = { x: HOME.x + 0.85, y: HOME.y - 22 * 0.85 };

/** Where the tip of his pole is headed: each founder's lantern in turn, until he gives up. */
function aim(p: number) {
  const under = (i: number, gap: number) => ({
    x: LANTERNS[i].x + (LANTERNS[i].founder ? 2 : 1.5),
    y: LANTERNS[i].y + 5 + gap,
  });
  // He creeps up on No. 1; each lantern lights while his flame is still a hand short of it.
  if (p < GAG[0]) return under(0, lerp(20, 8, ease(span(p, 0.01, GAG[0]))));
  const jump = (from: number, gap: number, to: number, next: number, reach: number) => {
    const a = under(from, gap + hump(p, GAG[from], GAG[from] + 0.035) * 9),
      b = under(to, next),
      k = ease(span(p, reach, GAG[to] - 0.003));
    return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) };
  };
  if (p < GAG[1]) return jump(0, 8, 1, 7, 0.128);
  if (p < GAG[2]) return jump(1, 7, 2, 6, 0.17);
  // Beaten three times, he watches the rest come on without him; the pole droops.
  const a = under(2, 6 + hump(p, GAG[2], GAG[2] + 0.035) * 9),
    droop = ease(span(p, 0.225, 0.3));
  const hang = { x: a.x + 6 * droop, y: a.y + 16 * droop };
  return hang;
}

function lamplighter(ctx: Ctx, p: number, seconds: number) {
  if (p >= SIT) {
    // Sat down under the lamp, and asleep before it has even finished lighting the street.
    const dozing = p >= DOZE - 0.02;
    person(ctx, HOME.x + 2, HOME.y, {
      ...LAMPLIGHTER,
      sitting: true,
      arms: [0.2, 0.9],
      lean: dozing ? -0.18 : -0.08,
      eyes: dozing ? 'closed' : p >= WAVE && p < WAVE + 0.04 ? 'wide' : 'happy',
      mouth: 'smile',
    });
    if (dozing)
      for (let k = 0; k < 2; k++) {
        const t = (seconds * 0.8 + k * 0.5) % 1;
        write(ctx, 'z', HOME.x + 9 + t * 6 + k * 3, HOME.y - 26 - t * 10, {
          size: 7 + k,
          type: 'italic',
          color: alpha(INK, Math.sin(t * Math.PI) * ease(span(p, DOZE, DOZE + 0.02))),
        });
      }
    return;
  }
  // Once the Fork is lit he plants the pole behind him, which frees a hand for "oh well".
  const plant = ease(span(p, PLANT, PLANT + 0.02));
  const reach = aim(p);
  const front = Math.atan2(reach.x - SHOULDER.x, reach.y - SHOULDER.y);
  const shrug = hump(p, SHRUG, BLOW);
  const figure: Figure = {
    ...LAMPLIGHTER,
    arms:
      plant > 0
        ? [lerp(front - 0.4, -0.35, plant), lerp(front, 0.3, plant) + shrug * 1.5]
        : [front - 0.4, front],
    ...face(p),
  };
  const hand = handOf(HOME.x, HOME.y, figure);
  const dx = reach.x - hand.x,
    dy = reach.y - hand.y,
    length = Math.hypot(dx, dy) || 1;
  const base = {
    x: lerp(hand.x - (dx / length) * 7, HOME.x - 3.5, plant),
    y: lerp(hand.y - (dy / length) * 7, HOME.y + 0.5, plant),
  };
  const tip = { x: lerp(reach.x, HOME.x - 5.5, plant), y: lerp(reach.y, HOME.y - 44, plant) };
  const pole = () => {
    line(ctx, '#6F5A3C', 1, [base.x, base.y, tip.x, tip.y]);
    box(ctx, tip.x - 0.5, tip.y - 1, 1, 2, '#9A8A64');
  };
  if (plant >= 0.5) pole();
  person(ctx, HOME.x, HOME.y, figure);
  if (plant < 0.5) pole();
  if (p < OUT) {
    // A taper at the tip: a steady little flame that breathes, never flickers.
    const flame = 1 + Math.sin(seconds * 9) * 0.15;
    glow(ctx, tip.x, tip.y - 3, 7, GLOW, 0.55);
    oval(ctx, tip.x, tip.y - 2.5, 1, 1.6 * flame, LIT);
    box(ctx, tip.x - 0.5, tip.y - 2, 1, 1, CORE);
  } else {
    // A curl of smoke where the flame was.
    const t = span(p, OUT, OUT + 0.08);
    for (let k = 0; k < 3; k++)
      disc(
        ctx,
        tip.x + Math.sin(t * 6 + k) * 1.5,
        tip.y - 3 - t * 10 - k * 3,
        0.8 + k * 0.3,
        alpha('#A8B0B4', (1 - t) * 0.6),
      );
  }
  // One long puff climbs from his mouth to the flame.
  const puff = span(p, BLOW, OUT);
  if (puff > 0 && puff < 1)
    for (let k = 0; k < 3; k++) {
      const q = Math.max(0, puff - k * 0.12);
      if (q <= 0) continue;
      disc(
        ctx,
        lerp(HOME.x + 5, tip.x, q) + Math.sin(q * Math.PI) * 5,
        lerp(HOME.y - 20, tip.y - 2, q),
        1.3 - k * 0.3,
        alpha('#E8EEF0', 0.7),
      );
    }
}

function face(p: number): Pick<Figure, 'eyes' | 'mouth'> {
  if (p < GAG[0]) return { eyes: 'open', mouth: 'flat' };
  if (p < 0.15) return { eyes: 'wide', mouth: 'o' };
  if (p < GAG[2]) return { eyes: 'open', mouth: 'flat' };
  if (p < SHRUG) return { eyes: 'wide', mouth: 'o' };
  if (p < BLOW) return { eyes: 'happy', mouth: 'smile' };
  return { eyes: 'closed', mouth: 'o' };
}

/** A little flip clock in the corner: a minute to nightfall, then nightfall. */
function clock(ctx: Ctx, p: number) {
  const amount = 1 - ease(span(p, 0.4, 0.46));
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha = amount;
  box(ctx, 10, 10, 50, 19, alpha('#0B1220', 0.75));
  ctx.strokeStyle = alpha('#BFD8A6', 0.6);
  ctx.lineWidth = 1;
  ctx.strokeRect(10.5, 10.5, 49, 18);
  box(ctx, 11, 19, 48, 1, alpha('#000000', 0.35));
  // The old time folds away and the new one drops in.
  const fold = span(p, NIGHTFALL - 0.008, NIGHTFALL),
    drop = span(p, NIGHTFALL - 0.002, NIGHTFALL + 0.006);
  const squash = p < NIGHTFALL ? 1 - fold : drop;
  ctx.translate(35, 19.5);
  ctx.scale(1, Math.max(0.05, squash));
  write(ctx, clockText(p), 0, 4, { size: 11, color: INK });
  ctx.restore();
}
