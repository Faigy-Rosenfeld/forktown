import type { Playable } from '../lib/break-cards';
import { AD_SCORES, CARD_SCORES, REEL_SCORES } from '../films/scores';
import type { Voice } from './score';

export type FilmEffect =
  | 'pop'
  | 'bounce'
  | 'rustle'
  | 'chime'
  | 'meow'
  | 'quack'
  | 'flutter'
  | 'water'
  | 'engine'
  | 'beep'
  | 'sweep'
  | 'crowd'
  | 'step'
  | 'swish'
  | 'clash'
  | 'wind'
  | 'hum'
  | 'beam'
  | 'gasp'
  | 'warp'
  | 'rain'
  | 'drip'
  | 'bubble'
  | 'whale'
  | 'chug'
  | 'whistle'
  | 'thunder'
  | 'wave'
  | 'crunch'
  | 'boing'
  | 'creak'
  | 'rumble'
  | 'whir'
  | 'splash'
  | 'knock'
  | 'clatter'
  | 'woo'
  | 'sneeze'
  | 'tweet'
  | 'bark'
  | 'click'
  | 'scribble'
  | 'sparkle'
  | 'crackle'
  | 'thud'
  | 'squeak'
  | 'applause'
  | 'toll'
  | 'foghorn'
  | 'snore'
  | 'tick'
  | 'yawn'
  | 'croak'
  | 'gull'
  | 'giggle';
export type FilmCue = { at: number; duration: number; gain: number; pan: number } & (
  { kind: 'note'; voice: Voice; pitch: number } | { kind: FilmEffect }
);

/** A film's, ad's or break card's complete cue list, composed by its own module in `src/films/`. */
export function cinemaScore(screening: Playable): FilmCue[] {
  // A type-only import keeps the town's world code out of the audio worker's bundle.
  if ('card' in screening) return CARD_SCORES[screening.card](screening);
  return 'sponsor' in screening
    ? AD_SCORES[screening.artwork](screening)
    : REEL_SCORES[screening.artwork](screening);
}
