import { describe, expect, it } from 'vitest';
import {
  ARRIVE,
  carryInMoversAd,
  carryInMoversAdScore,
  carryX,
  CHECKS,
  CUT,
  DOOR,
  END,
  FOOTNOTE,
  LANTERN,
  MOVED_IN,
  NOTE,
  ORDER,
  PLANT,
  SET_DOWN,
} from '../src/films/ads/carry-in-movers';
import { slateSeconds } from '../src/films/kit';
import { CINEMA_ADS } from '../src/lib/cinema';
import { recordingContext } from './recording-context';

const ad = CINEMA_ADS.find((spot) => spot.artwork === 'movers')!;
const text = (seconds: number) => {
  const recording = recordingContext(320, 180);
  carryInMoversAd.draw(recording.ctx, seconds / ad.duration, seconds);
  return recording.calls
    .filter((call) => call.name === 'fillText')
    .map((call) => String(call.args[0]));
};
const slateAt = 1 - slateSeconds(ad) / ad.duration;

describe('Carry-In Movers', () => {
  it('tells the whole story before the sponsor slate', () => {
    const beats = [...CHECKS, NOTE, CUT, ARRIVE, SET_DOWN, PLANT, DOOR, LANTERN, END];
    expect([...beats].sort((a, b) => a - b)).toEqual(beats);
    expect(END).toBeLessThan(slateAt - 0.03);
  });

  it('shows the moving order, then the punchline once every box is ticked', () => {
    expect(ORDER).toHaveLength(CHECKS.length);
    expect(text(0.2)).toEqual(expect.arrayContaining([...ORDER]));
    expect(text(NOTE * ad.duration - 0.05)).not.toContain(FOOTNOTE);
    expect(text((NOTE + 0.03) * ad.duration)).toContain(FOOTNOTE);
    expect(text((CUT + 0.03) * ad.duration)).not.toContain(ORDER[0]);
  });

  it('carries the house down the lane and sets it down on its plot', () => {
    expect(carryX(CUT)).toBeLessThan(carryX((CUT + ARRIVE) / 2));
    expect(carryX((CUT + ARRIVE) / 2)).toBeLessThan(carryX(ARRIVE));
    expect(carryX(ARRIVE)).toBe(carryX(1));
    expect(text((LANTERN + 0.02) * ad.duration)).toContain(MOVED_IN);
    expect(text(ARRIVE * ad.duration)).not.toContain(MOVED_IN);
  });

  it('keeps to the town voice, and saves the tagline for the slate', () => {
    expect(MOVED_IN).toContain('moved in');
    for (let seconds = 0; seconds < slateAt * ad.duration; seconds += 0.25)
      for (const line of text(seconds)) {
        expect(line).not.toContain('!');
        expect(line).not.toMatch(/merge|commit|repo|branch|\bSHA\b/i);
        expect(line).not.toContain(ad.tagline);
      }
  });

  it('lands each sound on its picture beat', () => {
    const cues = carryInMoversAdScore(ad);
    const near = (kind: string, p: number) =>
      cues.some((cue) => cue.kind === kind && Math.abs(cue.at - p * ad.duration) < 0.03);
    for (const check of CHECKS) expect(near('scribble', check)).toBe(true);
    expect(near('thud', SET_DOWN)).toBe(true);
    expect(near('pop', PLANT)).toBe(true);
    expect(near('creak', DOOR)).toBe(true);
    expect(near('chime', LANTERN)).toBe(true);
  });
});
