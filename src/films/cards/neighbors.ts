import { sentence, type SpotlightHouse } from '../../lib/break-cards';
import { DEFAULT_RESIDENT } from '../../lib/schema';
import { drawHouse, houseBounds } from '../../city/houses';
import { drawResident } from '../../city/residents';
import type { CardModule } from '../types';
import {
  alpha,
  backOut,
  box,
  clamp,
  ease,
  easeOut,
  font,
  H,
  lerp,
  oval,
  rand,
  sky,
  span,
  TAU,
  W,
  write,
  type Ctx,
  type Type,
} from '../kit';
import { BEATS, neighborsScore } from './neighbors-jingle';

// Meet the neighbors, 12 s: one house from the town on a bright afternoon. The door opens, its
// neighbor steps out onto the path and waves, and the lower third says who brought it to town.

const INK = '#343E35',
  GREEN = '#516B42',
  DEEP = '#405934',
  SOFT = '#4D5C4A',
  PAPER = '#F1EEDC',
  LINK = '#BFD8A6',
  DUSK = '#263C3C',
  /** The lawn every house is drawn on, so its plot melts into the meadow. */
  LAWN = '#BFD5A4';
const LEFT = 20,
  /** The text column ends where the house's space begins. */
  COLUMN = 146,
  HOUSE_LEFT = 170,
  HOUSE_RIGHT = W - 6,
  BAND = 146,
  HORIZON = 58,
  /** House px of garden in front of its ground point that stay clear of the lower third. */
  FRONT = 34;
/** Story times: the door opens, the neighbor walks out, turns and waves, and the door shuts. */
const { doorOpen: DOOR_OPEN, stepOut: STEP_OUT, onPath: ON_PATH, doorShut: DOOR_SHUT } = BEATS,
  { wave: WAVE, waveAgain: WAVE_AGAIN } = BEATS;
/** The neighbor's walk, in house px: from the doorstep down the path toward the street. */
const DOORSTEP = { x: -9, y: 13 },
  PATH_END = { x: -40, y: 27 };

/** Shown when the card has no house of its own. A literal: cards never read the roster. */
const SAMPLE_HOUSE: SpotlightHouse = {
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
      greeting: 'Come in, the kettle’s on.',
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

/** The largest size from `max` down to `min` at which `text` fits `width`, or 0 if none does. */
function fitted(
  ctx: Ctx,
  text: string,
  width: number,
  max: number,
  min: number,
  face: (size: number) => string,
) {
  for (let size = max; size >= min; size--) {
    ctx.font = face(size);
    if (ctx.measureText(text).width <= width) return size;
  }
  return 0;
}
const face = (type: Type) => (size: number) => font(type, size);
const sans = (size: number) => `500 ${size}px "DM Sans", sans-serif`;

/** A line that eases up into place, and fades in, from story time `at`. */
function entering(ctx: Ctx, p: number, at: number, paint: (rise: number) => void) {
  const amount = ease(span(p, at, at + 0.05));
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha *= amount;
  paint(Math.round((1 - easeOut(amount)) * 4));
  ctx.restore();
}

/** A round tree at the edge of the meadow, `r` wide, swaying a touch in the breeze. */
function tree(ctx: Ctx, x: number, y: number, r: number, seconds: number, phase: number) {
  const sway = Math.round(Math.sin((seconds / 4) * TAU + phase) * 0.8);
  box(ctx, x - 1, y - r * 0.6, 3, r * 0.8, '#6F5A3C');
  oval(ctx, x + sway, y - r * 1.1, r, r * 0.9, '#7FA06A');
  oval(ctx, x + sway - r * 0.25, y - r * 1.3, r * 0.55, r * 0.45, '#95B478');
}

/**
 * A bright afternoon seen from a little above, like the town: a band of sky, two slow clouds,
 * far hills and trees, and a wide meadow for the words and the house. `clear` is where the
 * heading ends, so no tree grows behind it.
 */
function meadow(ctx: Ctx, seconds: number, clear: number) {
  sky(ctx, ['#B9D6DC', '#C8DFDF', '#D6E7DF', '#E3EEDC'], 0, HORIZON + 2);
  const cloud = (x: number, y: number, w: number) => {
    oval(ctx, x, y, w, w * 0.22, alpha('#FFFFFF', 0.75));
    oval(ctx, x - w * 0.3, y - w * 0.12, w * 0.45, w * 0.22, alpha('#FFFFFF', 0.75));
    oval(ctx, x + w * 0.25, y - w * 0.1, w * 0.4, w * 0.2, alpha('#FFFFFF', 0.7));
  };
  // They drift over the house's side of the sky only, a few px across the whole card.
  cloud(212 + seconds * 2, 12, 24);
  cloud(300 - seconds * 1.2, 30, 16);
  oval(ctx, 250, HORIZON + 2, 120, 9, '#A9C590');
  oval(ctx, 60, HORIZON + 2, 100, 5, '#B3CC98');
  for (const [x, r, phase] of [
    [HOUSE_LEFT + 2, 7, 0],
    [HOUSE_RIGHT - 26, 6, 4],
    [HOUSE_RIGHT - 6, 9, 2],
  ] as const)
    if (x - r > clear + 6) tree(ctx, x, HORIZON + 3, r, seconds, phase);
  // Distance haze at the back of the meadow, then the lawn every plot is drawn on.
  sky(ctx, ['#C9DDB2', '#C4D9AB', LAWN], HORIZON, HORIZON + 18);
  box(ctx, 0, HORIZON + 16, W, H - HORIZON - 16, LAWN);
  // Tufts and a few wildflowers, kept out from behind the words.
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(rand(i * 13 + 5) * W),
      y = Math.floor(HORIZON + 8 + rand(i * 17 + 9) * (BAND - HORIZON - 8));
    if (x < HOUSE_LEFT && y < 120) continue;
    const far = (y - HORIZON) / (BAND - HORIZON);
    box(ctx, x, y, far > 0.5 ? 3 : 2, 1, '#A9C48F');
    box(ctx, x + 1, y - 1, 1, 1, '#A9C48F');
    if (i % 4 === 0) {
      box(ctx, x + 4, y - 2, 1, 2, '#8FAE78');
      box(ctx, x + 3, y - 3, 3, 1, ['#E7B7C0', '#C9C3E6', '#F1E3A8'][i % 3]);
    }
  }
}

export const neighborsCard: CardModule = {
  draw(ctx, p, seconds, data) {
    const { place, founder, movedIn, lantern } = data.house ?? SAMPLE_HOUSE;
    const { resident } = place;

    // The heading shrinks like the sponsor on an ad’s slate: from 20 px down to 12.
    const heading = sentence(place.name);
    // A name too wide even then (32 capitals) keeps shrinking rather than lose a letter.
    const headingSize =
      fitted(ctx, heading, W - 40, 20, 12, face('serif')) ||
      fitted(ctx, heading, W - LEFT - 12, 11, 7, face('serif')) ||
      7;
    ctx.font = font('serif', headingSize);
    const headingRight = LEFT + ctx.measureText(heading).width;

    // The house, fitted into the right-hand space, taller when the heading leaves room above,
    // its garden clear of the lower third.
    const bounds = houseBounds(place);
    const ceiling = headingRight < HOUSE_LEFT - 6 ? 8 : 52;
    const scale = Math.min(
      (HOUSE_RIGHT - HOUSE_LEFT) / (bounds.left + bounds.right + 10),
      (BAND - 3 - ceiling) / (bounds.top + FRONT),
      1.1,
    );
    const baseline = Math.round(BAND - 3 - FRONT * scale);
    meadow(ctx, seconds, headingRight);
    const cx = Math.round((HOUSE_LEFT + HOUSE_RIGHT) / 2);
    const arrive = backOut(span(p, 0.02, 0.12));
    const door = clamp(
      Math.min(span(p, DOOR_OPEN, DOOR_OPEN + 0.02), 1 - span(p, DOOR_SHUT - 0.03, DOOR_SHUT)),
    );
    ctx.save();
    ctx.globalAlpha = clamp(arrive * 1.5);
    drawHouse(ctx, place, cx, baseline + Math.round((1 - arrive) * 8), false, scale, {
      minutes: seconds * 2,
      activity: 'home',
      door,
    });
    ctx.restore();

    // The neighbor steps out, walks down the path toward the words, and waves.
    if (p >= STEP_OUT) {
      const walk = ease(span(p, STEP_OUT, ON_PATH));
      const at = {
        x: cx + lerp(DOORSTEP.x, PATH_END.x, walk) * scale,
        y: baseline + lerp(DOORSTEP.y, PATH_END.y, walk) * scale,
      };
      const waving = (p >= WAVE[0] && p < WAVE[1]) || (p >= WAVE_AGAIN[0] && p < WAVE_AGAIN[1]);
      drawResident(ctx, resident, Math.round(at.x), Math.round(at.y), scale * 1.2, {
        moving: p < ON_PATH,
        facing: 'sw',
        walkPhase: waving ? seconds * 1.5 : seconds * 2,
        greeting: false,
        pose: waving ? 'cheer' : undefined,
        duckLove: false,
        event: undefined,
      });
    }

    // The words: eyebrow, the house's own name, who lives there, since when, and hello.
    entering(ctx, p, 0.03, (rise) =>
      write(ctx, founder ? 'A FOUNDING HOUSE' : 'MEET THE NEIGHBORS', LEFT, 21 + rise, {
        size: 8,
        color: GREEN,
        align: 'left',
      }),
    );
    entering(ctx, p, 0.06, (rise) =>
      write(ctx, heading, LEFT, 44 + rise, {
        size: headingSize,
        type: 'serif',
        color: INK,
        align: 'left',
        shadow: alpha('#FFFFFF', 0.5),
      }),
    );
    let y = 67;
    if (resident.name !== DEFAULT_RESIDENT.name) {
      const home = `Home of ${resident.name}`;
      const size = fitted(ctx, home, COLUMN, 11, 8, face('italic'));
      if (size) {
        const lineY = y;
        entering(ctx, p, 0.12, (rise) =>
          write(ctx, home, LEFT, lineY + rise, { size, type: 'italic', color: INK, align: 'left' }),
        );
        y += 16;
      }
    }
    const since = founder
      ? 'One of the houses the town began with.'
      : movedIn
        ? `Moved in ${movedIn}.`
        : '';
    const sinceSize = since ? fitted(ctx, since, COLUMN, 9, 7, face('italic')) : 0;
    if (sinceSize) {
      const lineY = y;
      entering(ctx, p, 0.16, (rise) =>
        write(ctx, since, LEFT, lineY + rise, {
          size: sinceSize,
          type: 'italic',
          color: SOFT,
          align: 'left',
        }),
      );
      y += 14;
    }
    // Their greeting in their own words, when it fits on one line: it lands with the wave.
    const greeting = `“${resident.greeting}”`;
    const greetingSize = fitted(ctx, greeting, COLUMN, 11, 7, face('italic'));
    if (greetingSize) {
      const lineY = y + 10;
      entering(ctx, p, WAVE[0], (rise) =>
        write(ctx, greeting, LEFT, lineY + rise, {
          size: greetingSize,
          type: 'italic',
          color: DEEP,
          align: 'left',
        }),
      );
    }

    // The lower third: who brought this house to town, their handle exactly as they wrote it.
    const band = ease(span(p, BEATS.band, BEATS.band + 0.06));
    if (band > 0) {
      ctx.save();
      const slide = Math.round((1 - easeOut(band)) * (H - BAND));
      box(ctx, 0, BAND + slide, W, H - BAND, DUSK);
      box(ctx, 0, BAND + slide, W, 1, alpha(LINK, 0.5));
      ctx.globalAlpha = band;
      if (lantern && !founder) {
        const size = fitted(ctx, lantern, 110, 7, 5, face('mono'));
        if (size)
          write(ctx, lantern, W - LEFT, BAND + slide + 13, {
            size,
            color: LINK,
            align: 'right',
          });
      }
      if (!founder) {
        write(ctx, 'BROUGHT TO YOU BY', LEFT, BAND + slide + 13, {
          size: 7,
          color: LINK,
          align: 'left',
        });
        const handle = `@${place.creator}`;
        const size = fitted(ctx, handle, W - 40, 12, 7, sans) || 7;
        ctx.font = sans(size);
        ctx.fillStyle = PAPER;
        ctx.textAlign = 'left';
        ctx.fillText(handle, LEFT, BAND + slide + 28);
      } else {
        // A founding house has no byline: its lantern, and when the lanterns come on.
        write(ctx, lantern ?? 'FORKTOWN', LEFT, BAND + slide + 13, {
          size: 7,
          color: LINK,
          align: 'left',
        });
        write(ctx, 'At nightfall the lanterns come on, oldest first.', LEFT, BAND + slide + 27, {
          size: 10,
          type: 'italic',
          color: PAPER,
          align: 'left',
        });
      }
      ctx.restore();
    }
  },
  score: neighborsScore,
  look: { shade: DUSK, ink: PAPER, accent: LINK },
};
