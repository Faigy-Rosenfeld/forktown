import type { CardModule } from '../types';
import { composeCard } from '../score-kit';

// Draw-free, like every card jingle: the audio worker bundles this file and nothing it draws.
// We’ll be right back, 12 s: a music-box lullaby over a soft test tone, while Miso snores. It
// is four bars of 3/4 at 60 bpm, exactly the card’s 12 s, and it rests at both ends, so the
// reel can play it back to back for as long as the gap lasts.

const G = 79; // G5: a music box's register.
/** [second, degree above G5, seconds held]: one phrase that settles home on the fourth bar. */
const TUNE: readonly (readonly [number, number, number])[] = [
  [0.25, 4, 1],
  [1.25, 7, 0.5],
  [1.75, 12, 0.5],
  [2.25, 7, 1],
  [3.25, 9, 1],
  [4.25, 5, 0.5],
  [4.75, 0, 0.5],
  [5.25, 5, 1],
  [6.25, 2, 1],
  [7.25, 11, 0.5],
  [7.75, 7, 0.5],
  [8.25, 5, 1],
  [9.25, 4, 0.5],
  [9.75, 2, 0.5],
  [10.25, 0, 1.3],
];
/** One soft chord a bar, G, C, D, G, low under the tune; the last one lets go early. */
const BARS: readonly (readonly [number, readonly number[], number])[] = [
  [0.2, [55, 67, 71, 74], 2.9],
  [3.2, [48, 67, 72, 76], 2.9],
  [6.2, [50, 66, 69, 74], 2.9],
  [9.2, [43, 67, 71, 74], 2.2],
];
/** Miso snores on the in-breath, as each rising z sets off (see right-back.ts). */
export const SNORES = [3.2, 9.2];

export const rightBackScore: CardModule['score'] = (card) =>
  composeCard(card, (s) => {
    const at = (second: number) => (second - 0.1) / s.story;
    for (const [second, degree, held] of TUNE)
      s.noteAt(second, G + degree, held, 'bell', 0.075, (degree / 12 - 0.5) * 0.5);
    for (const [second, chord, held] of BARS)
      chord.forEach((pitch, i) =>
        s.noteAt(
          second,
          pitch,
          held,
          i === 0 ? 'bass' : 'pad',
          i === 0 ? 0.05 : 0.018,
          i === 0 ? 0 : (i - 2) * 0.35,
        ),
      );
    // The test tone: a quiet sine on C6 that holds under the second bar.
    s.fx('beep', at(3.3), 2.6, 0.016, 0);
    for (const second of SNORES) s.fx('snore', at(second), 1.1, 0.16, -0.25);
  });
