import { describe, expect, it } from 'vitest';
import {
  ARRIVE,
  ASK,
  COPY,
  CUTS,
  END_CARD,
  FLOOR_DOWN,
  FLOOR_UP,
  GULP,
  HUG,
  LANTERNS,
  MOVE_IN,
  NOPE,
  openPlotRealtyAd,
  openPlotRealtyAdScore,
  PIGGY,
  PLOT_COUNT,
  POCKET,
  RABBIT,
  RETURN,
  STAMP,
  ORDER,
  STYLE_AT,
  STYLES,
} from '../src/films/ads/open-plot-realty';
import { slateSeconds } from '../src/films/kit';
import { CINEMA_ADS } from '../src/lib/cinema';
import { HOUSE_PLOTS } from '../src/lib/events';
import { BUILDING_TYPES, TYPE_LABELS } from '../src/lib/schema';
import { recordingContext } from './recording-context';

const ad = CINEMA_ADS.find((spot) => spot.artwork === 'realty')!;
const text = (seconds: number) => {
  const recording = recordingContext(320, 180);
  openPlotRealtyAd.draw(recording.ctx, seconds / ad.duration, seconds);
  return recording.calls
    .filter((call) => call.name === 'fillText')
    .map((call) => String(call.args[0]));
};
const beats = [
  ARRIVE,
  RABBIT,
  ...STYLE_AT,
  RETURN,
  FLOOR_UP,
  FLOOR_DOWN,
  ASK,
  GULP,
  PIGGY,
  NOPE,
  POCKET,
  STAMP,
  MOVE_IN,
  HUG,
  ...LANTERNS,
];

describe('Open Plot Realty', () => {
  it('quotes the town’s real numbers and styles', () => {
    expect(PLOT_COUNT).toBe(HOUSE_PLOTS.length);
    expect(COPY.plots).toBe(`${HOUSE_PLOTS.length} plots.`);
    expect(Object.keys(STYLES)).toEqual([...BUILDING_TYPES]);
    expect(ORDER).toEqual([...BUILDING_TYPES]);
    for (const type of BUILDING_TYPES) expect(STYLES[type].label).toBe(TYPE_LABELS[type]);
    expect(STYLE_AT).toHaveLength(BUILDING_TYPES.length);
    expect(text(ad.duration * 0.14)).toContain(COPY.plots);
    expect(text(ad.duration * 0.26)).toContain(COPY.styles);
    expect(text(ad.duration * 0.34)).toContain(COPY.floors);
  });

  it('tells its story in order, and finishes before the sponsor slate', () => {
    const slate = 1 - slateSeconds(ad) / ad.duration;
    expect([...beats].sort((a, b) => a - b)).toEqual(beats);
    expect(CUTS[1]).toBeLessThan(STYLE_AT[0]);
    expect(CUTS[2]).toBeGreaterThan(FLOOR_DOWN);
    expect(CUTS[3]).toBeGreaterThan(HUG);
    for (const beat of beats) expect(beat).toBeLessThan(slate);
  });

  it('pays off the joke, then keeps the address and the button up until the slate', () => {
    expect(text(STAMP * ad.duration + 0.5)).toContain(COPY.joke);
    const slateAt = ad.duration - slateSeconds(ad);
    for (let seconds = END_CARD * ad.duration + 0.3; seconds < slateAt; seconds += 0.5)
      expect(text(seconds)).toEqual(expect.arrayContaining([COPY.address, COPY.pick, COPY.button]));
  });

  it('never writes the tagline into the story', () => {
    for (let seconds = 0; seconds < ad.duration; seconds += 0.5)
      expect(text(seconds)).not.toContain(ad.tagline);
  });

  it('keeps its copy in the town’s voice', () => {
    for (const line of Object.values(COPY)) {
      expect(line).not.toMatch(/!|\b(repo|commit|branch|SHA|merged?)\b/i);
      expect(line).not.toContain("'");
    }
    expect(COPY.eyebrow).toMatch(/^[A-Z0-9 ·/’&–-]+$/);
  });

  it('lands its sound effects on the picture’s beats', () => {
    const cues = openPlotRealtyAdScore(ad);
    const near = (kind: string, p: number) =>
      cues.some((cue) => cue.kind === kind && Math.abs(cue.at - p * ad.duration) < 0.05);
    for (const at of STYLE_AT) expect(near('pop', at), `pop at ${at}`).toBe(true);
    expect(near('boing', FLOOR_UP)).toBe(true);
    expect(near('boing', FLOOR_DOWN)).toBe(true);
    expect(near('gasp', GULP)).toBe(true);
    expect(near('thud', PIGGY)).toBe(true);
    expect(near('thud', STAMP)).toBe(true);
    expect(near('pop', MOVE_IN)).toBe(true);
    for (const at of LANTERNS) expect(near('chime', at), `lantern at ${at}`).toBe(true);
  });
});
