import type { CardModule } from '../types';
import { composeCard } from '../score-kit';

// Draw-free, like every card jingle: the audio worker bundles this file and nothing it draws.
// Coming up in Forktown, 12 s: a bright little signature, one bell per listing as it slides
// in, and a soft clock ticking under the countdowns.

/** Story times at which each listing starts to slide in. The card draws from these too. */
export const ROW_AT = [0.05, 0.12, 0.19] as const;
/** When the footer (the date and the moon) fades in, after the last listing. */
export const FOOTER_AT = 0.27;

export const comingUpScore: CardModule['score'] = (card) =>
  composeCard(card, (s) => {
    s.fx('chime', 0.01, 1, 0.1, -0.3);
    s.section({
      from: 0,
      to: 1,
      bpm: 104,
      root: 60,
      chords: [0, 5, 7, 5],
      groove: 'tick',
      melody: [0, 4, 7, null, 9, 7, 4, null, 5, 4, 2, null, 4, null, null, null],
      voice: 'pluck',
      gain: 0.6,
      level: 0.8,
      fade: 0.8,
    });
    for (const [i, at] of ROW_AT.entries()) {
      s.fx('click', at + 0.01, 0.08, 0.08, -0.4);
      s.note(at + 0.02, 72 + [0, 4, 7][i], 0.9, 'bell', 0.07, -0.3 + i * 0.1);
    }
    s.fx('sparkle', FOOTER_AT + 0.02, 1, 0.06, 0.2);
    // A few slow clock ticks while the countdowns run, quiet under the tune.
    for (let at = 0.4; at < 0.9; at += 0.1) s.fx('tick', at, 0.1, 0.05, 0.35);
    s.chord(0.84, [48, 55, 60, 64], 1.6, 'pad', 0.045);
  });
