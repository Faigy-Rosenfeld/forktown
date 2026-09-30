import { describe, expect, it } from 'vitest';
import {
  COUNTS,
  DASH,
  duckCrossingAuthorityAd,
  duckCrossingAuthorityAdScore,
  FIVE,
  HEART,
  HOME,
  OFF,
  SPOT,
  STARTLE,
  STOP,
  TURN,
  WALK_IN,
} from '../src/films/ads/duck-crossing-authority';
import { slateSeconds } from '../src/films/kit';
import { CINEMA_ADS } from '../src/lib/cinema';
import { DUCK_COUNT, DUCK_WALK_END, DUCK_WALK_START } from '../src/lib/ducks';
import { timeLabel } from '../src/lib/simulation';
import { recordingContext } from './recording-context';

const ad = CINEMA_ADS.find((spot) => spot.artwork === 'ducks')!;
const text = (seconds: number) => {
  const recording = recordingContext(320, 180);
  duckCrossingAuthorityAd.draw(recording.ctx, seconds / ad.duration, seconds);
  return recording.calls
    .filter((call) => call.name === 'fillText')
    .map((call) => String(call.args[0]));
};
const slateAt = 1 - slateSeconds(ad) / ad.duration;

describe('Duck Crossing Authority', () => {
  it('tells the whole story before the sponsor slate', () => {
    const beats = [WALK_IN, STOP, TURN, HEART, ...COUNTS, SPOT, STARTLE, DASH, FIVE, HOME, OFF];
    expect([...beats].sort((a, b) => a - b)).toEqual(beats);
    expect(OFF).toBeLessThan(slateAt - 0.05);
  });

  it('shows the town’s real walk: five ducklings, from 08:00 to 12:30', () => {
    expect(COUNTS).toHaveLength(DUCK_COUNT - 2);
    expect(ad.tagline).toContain(timeLabel(DUCK_WALK_START));
    expect(ad.tagline).toContain(timeLabel(DUCK_WALK_END));
    expect(text(2)).toContain(timeLabel(DUCK_WALK_START));
  });

  it('counts four ducklings, waits, and only then counts the fifth', () => {
    const counted = (p: number) =>
      text(p * ad.duration)
        .filter((word) => /^[1-9]$/.test(word))
        .map(Number);
    expect(counted(COUNTS[0] - 0.01)).toEqual([]);
    expect(counted(SPOT)).toEqual([1, 2, 3, 4]);
    expect(counted(FIVE - 0.01)).toEqual([1, 2, 3, 4]);
    expect(counted(FIVE + 0.03)).toEqual([1, 2, 3, 4, DUCK_COUNT - 1]);
    expect(counted(slateAt - 0.01)).toEqual([1, 2, 3, 4, 5]);
  });

  it('ticks off the neighbor’s three rules while the family goes by', () => {
    const rules = ['STOP', 'TURN TOWARD THEM', 'SHOW A HEART'];
    expect(text(HEART * ad.duration)).toEqual(expect.arrayContaining(rules));
    expect(text(0.5)).not.toContain('STOP');
    expect(text(DASH * ad.duration)).not.toContain('STOP');
  });

  it('keeps to the town voice, and saves the tagline for the slate', () => {
    for (let seconds = 0; seconds < slateAt * ad.duration; seconds += 0.25)
      for (const line of text(seconds)) {
        expect(line).not.toContain('!');
        expect(line).not.toContain(ad.tagline);
      }
  });

  it('lands each sound on its picture beat', () => {
    const cues = duckCrossingAuthorityAdScore(ad);
    const near = (kind: string, p: number) =>
      cues.some((cue) => cue.kind === kind && Math.abs(cue.at - p * ad.duration) < 0.03);
    expect(near('click', STOP)).toBe(true);
    expect(near('click', TURN)).toBe(true);
    expect(near('pop', HEART)).toBe(true);
    for (const at of COUNTS) expect(near('squeak', at)).toBe(true);
    expect(near('boing', STARTLE)).toBe(true);
    expect(near('pop', DASH)).toBe(true);
    expect(near('sparkle', FIVE)).toBe(true);
    expect(near('quack', HOME)).toBe(true);
  });
});
