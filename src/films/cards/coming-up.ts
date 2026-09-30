import type { BreakCardData, ComingUpItem } from '../../lib/break-cards';
import { realWait } from '../../lib/evening-copy';
import { moonSlice } from '../../lib/town-calendar';
import type { CardModule } from '../types';
import {
  alpha,
  box,
  clamp,
  disc,
  ease,
  easeOut,
  font,
  glow,
  H,
  oval,
  poly,
  rand,
  sky,
  span,
  TAU,
  W,
  write,
  type Ctx,
  type Type,
} from '../kit';
import { comingUpScore, FOOTER_AT, ROW_AT } from './coming-up-jingle';

// Coming up in Forktown, 12 s: the next three things worth tuning in for, counting down live
// over a sleepy row of rooftops. Every countdown is worked out from the frame's own time.

const INK = '#F1EEDC',
  SOFT = '#C3D4C2',
  LINK = '#BFD8A6',
  NIGHT = '#1B2C2C',
  LIGHT = '#F2C06B';
const GROUND = 158;
const ROW_TOP = 36,
  ROW_GAP = 37,
  TEXT_X = 76,
  RIGHT = W - 12;

/** Shown when the card has no listings of its own; `startsAt` counts from `data.now`. */
const SAMPLE_ROWS: readonly ComingUpItem[] = [
  { title: 'Lantern hour', place: 'The Lantern Fork', townTime: '20:00', startsAt: 42_000 },
  {
    title: 'Films under the stars',
    place: 'The Starlight Cinema',
    townTime: '20:30',
    startsAt: 72_000,
  },
  {
    title: 'Midnight at the Little Stage',
    place: 'The Little Stage',
    townTime: '23:30',
    startsAt: 252_000,
  },
];
const SAMPLE_CALENDAR: NonNullable<BreakCardData['calendar']> = {
  label: 'Spring 10, Year 1',
  season: 'Spring',
  moonName: 'Waxing crescent',
  moonPhase: 0.15,
};

/** The largest size from `max` down to `min` at which `text` fits `width`. */
function fitted(ctx: Ctx, text: string, type: Type, max: number, min: number, width: number) {
  let size = max;
  ctx.font = font(type, size);
  while (size > min && ctx.measureText(text).width > width) ctx.font = font(type, --size);
  return size;
}
/** `text`, shortened with an ellipsis until it fits `width` in the font already set. */
function clipped(ctx: Ctx, text: string, width: number) {
  if (ctx.measureText(text).width <= width) return text;
  let cut = text.length;
  while (cut > 1 && ctx.measureText(`${text.slice(0, cut).trimEnd()}…`).width > width) cut--;
  return `${text.slice(0, cut).trimEnd()}…`;
}

/** The moon in the corner of the programme, lit row by row like the calendar’s. */
function moon(ctx: Ctx, x: number, y: number, r: number, phase: number) {
  disc(ctx, x, y, r + 3, alpha(INK, 0.08));
  disc(ctx, x, y, r, alpha(INK, 0.16));
  for (let row = -r; row < r; row++) {
    const [left, right] = moonSlice(phase, (row + 0.5) / r);
    const from = Math.round(x + left * r),
      to = Math.round(x + right * r);
    if (to > from) box(ctx, from, y + row, to - from, 1, '#F4EFD8');
  }
}

/** A dusk sky, a few slow stars, and the town’s rooftops asleep along the bottom. */
function backdrop(ctx: Ctx, seconds: number) {
  sky(ctx, ['#1C3030', '#213636', '#263C3C', '#2B4242', '#30483F'], 0, 150);
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(rand(i * 7 + 1) * W),
      y = Math.floor(4 + rand(i * 11 + 3) * 132);
    // Keep the stars out of the listings' text, off to the far right and in the gaps.
    if (x > 60 && x < 270 && y > 26) continue;
    const twinkle = 0.5 + 0.5 * Math.sin((seconds / 4) * TAU + i * 1.7);
    box(ctx, x, y, 1, 1, alpha(INK, 0.25 + twinkle * 0.45));
  }
  // Two ridges of hills, trees and rooftops with their lit windows, and one lantern post:
  // light is the only amber here.
  oval(ctx, 70, 178, 150, 30, '#233736');
  oval(ctx, 262, 180, 140, 34, '#233736');
  for (const [x, r] of [
    [74, 7],
    [124, 6],
    [196, 8],
    [284, 6],
  ] as const) {
    box(ctx, x - 1, GROUND - 4, 2, 4, NIGHT);
    oval(ctx, x, GROUND - 3 - r, r, r * 0.95, '#1E3130');
  }
  const roofs = [
    [18, 152, 16, 10],
    [40, 148, 20, 13],
    [96, 154, 14, 9],
    [210, 152, 18, 11],
    [236, 146, 22, 14],
    [264, 151, 16, 10],
    [294, 148, 20, 13],
  ] as const;
  box(ctx, 0, GROUND, W, H - GROUND, NIGHT);
  for (const [i, [x, y, w, h]] of roofs.entries()) {
    box(ctx, x, y, w, GROUND - y + 1, NIGHT);
    poly(ctx, NIGHT, [x - 2, y, x + w / 2, y - h * 0.55, x + w + 2, y]);
    // Each window breathes a little on its own slow clock: a warm light, never a flash.
    const warmth = 0.75 + 0.25 * Math.sin((seconds / 6) * TAU + i * 2.1);
    glow(ctx, x + w / 2, y + 4, 9, LIGHT, 0.18 * warmth);
    box(ctx, x + Math.round(w / 2) - 2, y + 3, 2, 3, alpha(LIGHT, 0.65 + warmth * 0.35));
    if (w > 17) box(ctx, x + Math.round(w / 2) + 2, y + 3, 2, 3, alpha(LIGHT, 0.55 + warmth * 0.3));
  }
  // A lantern post between the houses, lit as on any night after 20:00.
  box(ctx, 181, 146, 2, GROUND - 146, NIGHT);
  box(ctx, 178, 142, 8, 5, NIGHT);
  glow(ctx, 182, 144, 14, LIGHT, 0.3);
  box(ctx, 180, 143, 4, 3, LIGHT);
}

/** One listing: the town time on a paper tag, what is on, and where, counting down. */
function listing(
  ctx: Ctx,
  row: ComingUpItem,
  i: number,
  wait: string,
  top: number,
  amount: number,
) {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha = amount;
  const slide = Math.round((1 - easeOut(amount)) * 10);
  // The tag: the soonest is paper, the ones after it an outline, like a programme's next up.
  const tagX = 20,
    tagW = 44;
  if (i === 0) box(ctx, tagX, top, tagW, 16, INK);
  else {
    box(ctx, tagX, top, tagW, 16, alpha(INK, 0.1));
    box(ctx, tagX, top, tagW, 1, alpha(INK, 0.5));
    box(ctx, tagX, top + 15, tagW, 1, alpha(INK, 0.5));
    box(ctx, tagX, top, 1, 16, alpha(INK, 0.5));
    box(ctx, tagX + tagW - 1, top, 1, 16, alpha(INK, 0.5));
  }
  write(ctx, row.townTime, tagX + tagW / 2, top + 12, {
    size: 10,
    color: i === 0 ? '#263C3C' : INK,
  });
  const x = TEXT_X + slide;
  const titleSize = fitted(ctx, row.title, 'serif', 13, 10, RIGHT - x);
  write(ctx, clipped(ctx, row.title, RIGHT - x), x, top + 11, {
    size: titleSize,
    type: 'serif',
    color: INK,
    align: 'left',
    shadow: alpha('#000000', 0.25),
  });
  // Where, then when: the countdown in the brighter ink so the eye finds it.
  const when = ` · ${wait}`;
  ctx.font = font('italic', 9);
  const whenWidth = ctx.measureText(when).width;
  const place = clipped(ctx, row.place, RIGHT - x - whenWidth);
  write(ctx, place, x, top + 25, { size: 9, type: 'italic', color: SOFT, align: 'left' });
  ctx.font = font('italic', 9);
  write(ctx, when, x + ctx.measureText(place).width, top + 25, {
    size: 9,
    type: 'italic',
    color: i === 0 ? LINK : SOFT,
    align: 'left',
  });
  ctx.restore();
}

export const comingUpCard: CardModule = {
  draw(ctx, p, seconds, data) {
    backdrop(ctx, seconds);
    const rows = (
      data.comingUp ?? SAMPLE_ROWS.map((row) => ({ ...row, startsAt: data.now + row.startsAt }))
    ).slice(0, 3);
    // The eyebrow settles first, with its rule drawn out beneath it.
    const head = ease(span(p, 0, 0.06));
    ctx.save();
    ctx.globalAlpha = head;
    write(ctx, 'COMING UP IN FORKTOWN', 20, 21, { size: 8, color: LINK, align: 'left' });
    box(ctx, 20, 26, Math.round(104 * ease(span(p, 0.02, 0.1))), 1, alpha(LINK, 0.6));
    ctx.restore();
    const now = data.now + seconds * 1000;
    if (!rows.length)
      write(ctx, 'Nothing on the program just now. Stay for the view.', W / 2, 88, {
        size: 10,
        type: 'italic',
        color: SOFT,
      });
    rows.forEach((row, i) => {
      const top = ROW_TOP + i * ROW_GAP;
      const amount = ease(span(p, ROW_AT[i], ROW_AT[i] + 0.07));
      // A dotted thread ties each tag to the next as it arrives.
      if (i > 0) {
        const reach = Math.round((ROW_GAP - 16) * clamp(amount * 1.4));
        for (let y = 0; y < reach; y += 3)
          box(ctx, 41, top - ROW_GAP + 17 + y, 2, 1, alpha(INK, 0.4));
      }
      const wait = realWait(Math.max(0, row.startsAt - now) / 1000);
      listing(ctx, row, i, wait, top, amount);
    });
    // The footer: today's date in town and the moon, as the calendar tells it.
    const calendar = data.calendar ?? SAMPLE_CALENDAR;
    const foot = ease(span(p, FOOTER_AT, FOOTER_AT + 0.07));
    if (foot > 0) {
      ctx.save();
      ctx.globalAlpha = foot;
      const text = `${calendar.label} · ${calendar.moonName}`;
      const size = fitted(ctx, text, 'italic', 9, 7, W - 60);
      const width = ctx.measureText(text).width;
      const left = Math.round((W - width - 16) / 2);
      moon(ctx, left + 5, 169, 5, calendar.moonPhase);
      write(ctx, text, left + 16, 172, { size, type: 'italic', color: INK, align: 'left' });
      ctx.restore();
    }
  },
  score: comingUpScore,
  look: { shade: '#263C3C', ink: INK, accent: LINK },
};
