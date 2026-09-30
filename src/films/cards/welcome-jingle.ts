import type { CardModule } from '../types';
import { composeCard } from '../score-kit';

// Draw-free, like every card jingle: the audio worker bundles this file and nothing it draws.
// A new neighbor just moved in, 10 s: a bright little tune while the house lands, the doorbell
// as the door opens, footsteps down the path, and a hush at dusk until the lantern lights.

/** Card seconds of each sound; welcome.ts times its pictures to the same moments (BEATS). */
export const WELCOME_CUES = { land: 1.6, door: 3, walk: [3.6, 5.2], light: 7.2 } as const;

export const welcomeScore: CardModule['score'] = (card) =>
  composeCard(card, (s) => {
    const at = (second: number) => (second - 0.1) / s.story;
    s.section({
      from: 0,
      to: at(6.2),
      bpm: 104,
      root: 60,
      chords: [0, 5, 7, 0],
      groove: 'tick',
      melody: [7, null, 4, 7, 12, null, 11, 12, 9, null, 7, 5, 4, null, 2, null],
      step: 0.5,
      voice: 'pluck',
      gain: 0.8,
      level: 0.55,
      fade: 0.6,
    });
    // Evening: the band stops, the chords hold, and the lantern lights over them.
    s.section({
      from: at(6),
      to: at(9.7),
      bpm: 72,
      root: 60,
      chords: [5, 0],
      groove: 'none',
      level: 0.5,
      fade: 0.8,
    });
    s.fx('thud', at(WELCOME_CUES.land), 0.35, 0.22, 0);
    // The doorbell: ding, dong.
    s.noteAt(WELCOME_CUES.door, 76, 0.7, 'bell', 0.09, -0.2);
    s.noteAt(WELCOME_CUES.door + 0.38, 72, 1.1, 'bell', 0.09, -0.2);
    const [from, to] = WELCOME_CUES.walk;
    for (let i = 0, t = from; t < to - 0.1; i++, t += 0.4)
      s.fx('step', at(t), 0.15, 0.1, i % 2 ? -0.3 : -0.1);
    s.fx('sparkle', at(WELCOME_CUES.light), 1.2, 0.08, -0.35);
    [72, 76, 79, 84].forEach((pitch, i) =>
      s.noteAt(WELCOME_CUES.light + 0.1 + i * 0.14, pitch, 2.2 - i * 0.14, 'bell', 0.06, -0.35),
    );
  });
