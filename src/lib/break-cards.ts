import { CINEMA_ADS, type CinemaAd, type Screening } from './cinema.ts';
import type { Place } from './schema.ts';

// The live stream's break cards and the reel that covers a gap in the picture. Node-safe: this
// file is shared by the page, the audio worker (types only), and the offline reel renderer.

export type CardArtwork = 'right-back' | 'coming-up' | 'neighbors' | 'welcome';
/** A card the live stream can put on air between shots. Each draws itself in `src/films/cards/`. */
export type BreakCard = { id: string; card: CardArtwork; title: string; duration: number };
export const BREAK_CARDS: Record<CardArtwork, BreakCard> = {
  'right-back': {
    id: 'card-right-back',
    card: 'right-back',
    title: 'We’ll be right back.',
    duration: 12,
  },
  'coming-up': {
    id: 'card-coming-up',
    card: 'coming-up',
    title: 'Coming up in Forktown.',
    duration: 12,
  },
  neighbors: {
    id: 'card-neighbors',
    card: 'neighbors',
    title: 'Meet the neighbors.',
    duration: 12,
  },
  welcome: {
    id: 'card-welcome',
    card: 'welcome',
    title: 'A new neighbor just moved in.',
    duration: 10,
  },
};
/** Anything with a picture and a soundtrack: a film, an ad, or a break card. */
export type Playable = Screening | BreakCard;
export const isCard = (p: Playable): p is BreakCard => 'card' in p;
/** Ads that make sense outside the cinema (not "phones off", not the snack bar). */
export const LIVE_BREAK_ADS: readonly CinemaAd[] = CINEMA_ADS.filter(
  (ad) => ad.artwork !== 'phones' && ad.artwork !== 'snacks',
);
/** The pre-rendered gap reel: right-back plus every live-break ad. */
export type ReelSegment = {
  id: string;
  kind: 'card' | 'ad';
  duration: number;
  interruptibleAfter?: number;
};
export const REEL_SEGMENTS: readonly ReelSegment[] = [
  {
    id: 'right-back',
    kind: 'card',
    duration: BREAK_CARDS['right-back'].duration,
    interruptibleAfter: 3,
  },
  ...LIVE_BREAK_ADS.map((ad) => ({
    id: `ad-${ad.artwork}`,
    kind: 'ad' as const,
    duration: ad.duration,
  })),
];
/** One row of the "Coming up" card. `startsAt` is UTC ms. */
export type ComingUpItem = { title: string; place: string; townTime: string; startsAt: number };
export type SpotlightHouse = {
  place: Place;
  /** A founding house: creator === 'forktown'. */
  founder: boolean;
  /** A town date label like "Spring 10, Year 1"; null for founders or when unknown. */
  movedIn: string | null;
  /** The lantern caption label, e.g. "LANTERN No. 12 OF 19"; null when unknown. */
  lantern: string | null;
};
export type BreakCardData = {
  /** UTC ms at the card's start; cards count down as startsAt - (now + seconds * 1000). */
  now: number;
  comingUp?: ComingUpItem[];
  calendar?: { label: string; season: string; moonName: string; moonPhase: number };
  house?: SpotlightHouse;
};

/** Sentence-case a user-provided name: add '.' unless it already ends in . ! ? … */
export function sentence(name: string): string {
  const trimmed = name.trim();
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
