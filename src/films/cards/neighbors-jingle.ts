import type { CardModule } from '../types';
import { composeCard } from '../score-kit';

// Draw-free, like every card jingle: the audio worker bundles this file and nothing it draws.
// Meet the neighbors, 12 s: a warm doorstep tune. The door creaks open, a few steps down the
// path, a wave, the door clicks shut, and the lower third slides up with the byline.

/** Story times of the card's little scene. The card draws from these too. */
export const BEATS = {
  doorOpen: 0.13,
  stepOut: 0.16,
  onPath: 0.3,
  wave: [0.32, 0.46],
  doorShut: 0.34,
  band: 0.38,
  waveAgain: [0.8, 0.9],
} as const;

export const neighborsScore: CardModule['score'] = (card) =>
  composeCard(card, (s) => {
    s.section({
      from: 0,
      to: 1,
      bpm: 92,
      root: 62,
      chords: [0, 7, 5, 0, 0, 5, 7, 0],
      groove: 'pulse',
      melody: [0, 2, 4, 7, 4, 2, 4, null, 7, 9, 7, 4, 2, null, 0, null],
      voice: 'keys',
      gain: 0.6,
      level: 0.75,
      fade: 0.8,
    });
    s.fx('creak', BEATS.doorOpen, 0.6, 0.08, 0.4);
    for (let at = BEATS.stepOut + 0.01; at < BEATS.onPath; at += 0.03)
      s.fx('step', at, 0.12, 0.07, 0.3);
    s.fx('tweet', BEATS.wave[0] + 0.01, 0.8, 0.06, -0.5);
    s.note(BEATS.wave[0] + 0.02, 74, 0.6, 'bell', 0.07, 0.3);
    s.note(BEATS.wave[0] + 0.05, 78, 0.9, 'bell', 0.06, 0.3);
    s.fx('knock', BEATS.doorShut, 0.15, 0.06, 0.4);
    s.fx('swish', BEATS.band, 0.4, 0.07);
    s.note(BEATS.waveAgain[0] + 0.02, 74, 0.6, 'bell', 0.05, 0.3);
    s.chord(0.82, [50, 57, 62, 66], 1.8, 'pad', 0.045);
  });
