// The stream box's handle on the /live/ page: which build is on air, whether the next few seconds
// are free of protected moments, and the one switch it may flip, the welcome for a new neighbor.
// The small pure helpers below are the page's welcome and warm-up bookkeeping, kept here so they
// can be tested without a browser.

import { BREAK_CARDS, type Playable } from './break-cards';
import {
  BREAK_MOUNT_GRACE_MS,
  nextBreakAfter,
  type BreakItem,
  type WelcomeStep,
} from './live-breaks';
import type { Place } from './schema';

/** This build's identity, from the __FORKTOWN_BUILD__ define (also written to live/build.json). */
export const forktownBuild: { sha: string | null; builtAt: string } =
  typeof __FORKTOWN_BUILD__ === 'undefined' ? { sha: null, builtAt: '' } : __FORKTOWN_BUILD__;

export type FilmsState = 'loading' | 'ready' | 'missing';
export type WelcomePhase = 'none' | 'armed' | 'scheduled' | 'showing' | 'done';

export type ForktownLive = {
  version: 1;
  build: { sha: string | null; builtAt: string };
  /** No protected moment and no welcome step in the next N seconds. */
  quietFor(seconds: number): boolean;
  /** The only side-effecting method; idempotent; false if there is nothing to start. */
  startWelcome(): boolean;
  state(): {
    shot: string;
    label: string;
    break: { key: string; item: string; endsAt: number } | null;
    welcome: WelcomePhase;
    films: FilmsState;
    build: { sha: string | null; builtAt: string };
  };
};

declare global {
  interface Window {
    forktownLive?: ForktownLive;
  }
}

/**
 * Puts `window.forktownLive` on the page. Every call reaches through `get`, so the page can hand
 * over fresh values each render. The cleanup removes it only while it is still this one, which
 * keeps StrictMode's mount, unmount and mount from deleting the second install.
 */
export function installLiveHarness(get: () => ForktownLive): () => void {
  if (typeof window === 'undefined') return () => {};
  const api: ForktownLive = {
    version: 1,
    get build() {
      return get().build;
    },
    quietFor: (seconds) => get().quietFor(seconds),
    startWelcome: () => get().startWelcome(),
    state: () => get().state(),
  };
  window.forktownLive = api;
  return () => {
    if (window.forktownLive === api) delete window.forktownLive;
  };
}

/** A welcome starts this long after the page mounts, unless it waits for startWelcome(). */
export const WELCOME_DELAY_MS = 2_000;
/** A waiting welcome starts on its own this long after the page mounts. */
export const WELCOME_WAIT_MS = 30_000;
/** How long a welcome waits for the films (cards and fonts) before it goes ahead regardless. */
export const WELCOME_FILMS_WAIT_MS = 10_000;
/** A forced item waits this long after the page mounts, and half a second after the films. */
export const FORCED_DELAY_MS = 2_000;
const AFTER_FILMS_MS = 500;
/** Sound for a break or welcome card is rendered this far ahead, so its first note is on time. */
export const PREPARE_AHEAD_MS = 15_000;

/** When the welcome goes off on its own: two seconds after mount, or thirty when it waits. */
export const welcomeFallback = (mountedAt: number, wait: boolean) =>
  mountedAt + (wait ? WELCOME_WAIT_MS : WELCOME_DELAY_MS);

/**
 * The first moment the welcome may be placed from, or null while it still waits: for its trigger
 * (the fallback, or startWelcome()), then for the films to settle, for at most ten seconds.
 * Once a number it stays the same number, as long as `settledAt` is only ever set once.
 */
export function welcomeEarliest(
  trigger: number,
  settledAt: number | null,
  ms: number,
): number | null {
  if (ms < trigger) return null;
  const deadline = trigger + WELCOME_FILMS_WAIT_MS;
  if (settledAt !== null && settledAt <= deadline)
    return Math.max(trigger, settledAt + AFTER_FILMS_MS);
  return ms >= deadline ? deadline : null;
}

/** Where the welcome stands at `ms`, as the harness reports it. */
export function welcomePhase(
  requested: boolean,
  earliest: number | null,
  steps: readonly WelcomeStep[],
  ms: number,
): WelcomePhase {
  if (!requested) return 'none';
  if (earliest === null) return 'armed';
  if (steps.some((step) => ms >= step.start && ms < step.end)) return 'showing';
  return steps.some((step) => step.start > ms) ? 'scheduled' : 'done';
}

/** When a forced `break=` item starts: two seconds in, and half a second after the films. */
export function forcedStart(mountedAt: number, readyAt: number | null): number | null {
  return readyAt === null ? null : Math.max(mountedAt + FORCED_DELAY_MS, readyAt + AFTER_FILMS_MS);
}

/** What an item plays: the ad, or the card. */
export const playableOf = (item: BreakItem): Playable => (item.kind === 'ad' ? item.ad : item.card);

/**
 * The next break or welcome card to start within `ahead` ms of `ms`, whose sound is worth
 * rendering now. Scheduled breaks count only when they are on and would really air.
 */
export function upcomingPlayable(o: {
  ms: number;
  places: Place[];
  minutes: number | null;
  forced: { item: BreakItem; start: number } | null;
  welcome: readonly WelcomeStep[];
  mountedAt: number;
  /** A welcome was asked for but isn't placed yet: its first card will start the moment it is. */
  welcomeArmed?: boolean;
  ahead?: number;
}): Playable | null {
  const { ms, ahead = PREPARE_AHEAD_MS } = o;
  const soon = (start: number) => start > ms && start - ms <= ahead;
  const next: { start: number; film: Playable }[] = [];
  if (o.forced && soon(o.forced.start))
    next.push({ start: o.forced.start, film: playableOf(o.forced.item) });
  const card = o.welcome.find((step) => step.kind === 'card' && soon(step.start));
  if (card) next.push({ start: card.start, film: BREAK_CARDS.welcome });
  if (o.minutes !== null) {
    const found = nextBreakAfter(ms, o.places, o.minutes);
    if (found && soon(found.start) && found.start >= o.mountedAt + BREAK_MOUNT_GRACE_MS)
      next.push({ start: found.start, film: playableOf(found.item) });
  }
  next.sort((a, b) => a.start - b.start);
  return next[0]?.film ?? (o.welcomeArmed ? BREAK_CARDS.welcome : null);
}
