import { describe, expect, it } from 'vitest';
import {
  BLOW,
  clockText,
  DOZE,
  GAG,
  LAMPS,
  LANTERNS,
  lanternForkElectricAd,
  lanternForkElectricAdScore,
  NEWEST,
  NIGHTFALL,
  OUT,
  SHRUG,
  SIT,
  WAVE,
} from '../src/films/ads/lantern-fork-electric';
import { slateSeconds } from '../src/films/kit';
import { CINEMA_ADS } from '../src/lib/cinema';
import { FOUNDER_SLOTS, LANTERN_HOUR } from '../src/lib/lanterns';
import { recordingContext } from './recording-context';

const ad = CINEMA_ADS.find((spot) => spot.artwork === 'lanterns')!;
const text = (seconds: number) => {
  const recording = recordingContext(320, 180);
  lanternForkElectricAd.draw(recording.ctx, seconds / ad.duration, seconds);
  return recording.calls.filter((call) => call.name === 'fillText').map((call) => call.args[0]);
};

describe('The Lantern Fork Electric ad', () => {
  it('tells the whole story before the sponsor slate', () => {
    const beats = [NIGHTFALL, ...GAG, LANTERNS[NEWEST].at, SHRUG, BLOW, OUT, SIT, WAVE, DOZE];
    expect([...beats].sort((a, b) => a - b)).toEqual(beats);
    const slate = 1 - slateSeconds(ad) / ad.duration;
    expect(Math.max(...LAMPS.map((lamp) => lamp.at))).toBeLessThanOrEqual(DOZE);
    expect(DOZE + 0.04).toBeLessThan(slate);
    // The picture never writes the tagline: only the slate does.
    for (let seconds = 0; seconds < ad.duration; seconds += 0.5)
      expect(text(seconds)).not.toContain(ad.tagline);
  });

  it('lights the Fork at nightfall, oldest first, then the lamps outward', () => {
    const minutes = (label: string) => Number(label.slice(0, 2)) * 60 + Number(label.slice(3));
    expect(minutes(clockText(0))).toBe(LANTERN_HOUR.start - 1);
    expect(minutes(clockText(NIGHTFALL))).toBe(LANTERN_HOUR.start);
    expect(text(0.5)).toContain(clockText(0));
    expect(text(2)).toContain(clockText(NIGHTFALL));
    expect(LANTERNS[0].at).toBeGreaterThan(NIGHTFALL);
    for (let i = 1; i < LANTERNS.length; i++)
      expect(LANTERNS[i].at).toBeGreaterThan(LANTERNS[i - 1].at);
    expect(LANTERNS.filter((lantern) => lantern.founder)).toHaveLength(FOUNDER_SLOTS);
    expect(LANTERNS.slice(0, FOUNDER_SLOTS).every((lantern) => lantern.founder)).toBe(true);
    expect(GAG.map((_, i) => LANTERNS[i].at)).toEqual([...GAG]);
    // Every lamp after the last lantern, and a farther lamp never before a nearer one.
    const reach = (x: number) => Math.abs(x - 160);
    for (const a of LAMPS) {
      expect(a.at).toBeGreaterThan(LANTERNS[NEWEST].at);
      for (const b of LAMPS) if (reach(a.x) < reach(b.x)) expect(a.at).toBeLessThan(b.at);
    }
  });

  it('lands its sound on the picture', () => {
    const cues = lanternForkElectricAdScore(ad);
    const near = (kind: string, beat: number, slack = 0.02) =>
      cues.some((cue) => cue.kind === kind && Math.abs(cue.at - beat * ad.duration) < slack);
    expect(near('toll', NIGHTFALL)).toBe(true);
    expect(near('gasp', GAG[0], 0.06)).toBe(true);
    expect(near('sparkle', LANTERNS[NEWEST].at)).toBe(true);
    expect(near('wind', BLOW)).toBe(true);
    expect(near('thud', SIT)).toBe(true);
    expect(near('snore', DOZE)).toBe(true);
    for (const lantern of LANTERNS) expect(near('note', lantern.at)).toBe(true);
    for (const lamp of LAMPS) expect(near('click', lamp.at)).toBe(true);
  });
});
