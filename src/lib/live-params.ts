import { BREAK_CARDS, LIVE_BREAK_ADS, type CardArtwork } from './break-cards';
import { DEFAULT_BREAK_MINUTES, type BreakItem } from './live-breaks';

/** What the /live/ address asks for: scheduled breaks, a forced item, and a welcome. */
export type LiveParams = {
  /** Minutes between scheduled breaks, or null when breaks are off. */
  breakMinutes: number | null;
  forced: BreakItem | null;
  welcome: string[];
  welcomeWait: boolean;
};

const MAX_BREAK_MINUTES = 120;
const WELCOME_MAX = 3;
/** A welcome older than this is a reload after a crash, not the deploy that asked for it. */
const WELCOME_FRESH_MS = 600_000;
const HOUSE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function breakMinutes(params: URLSearchParams): number | null {
  if (!params.has('breaks')) return null;
  const value = params.get('breaks')!;
  const minutes = /^\d+$/.test(value) ? Number(value) : NaN;
  // Asking for breaks always turns them on: anything but a whole 1–120 means the usual half hour.
  return minutes >= 1 && minutes <= MAX_BREAK_MINUTES ? minutes : DEFAULT_BREAK_MINUTES;
}

function forcedItem(value: string | null): BreakItem | null {
  const match = /^(ad|card):(.+)$/.exec(value ?? '');
  if (!match) return null;
  const [, kind, name] = match;
  if (kind === 'ad') {
    const ad = LIVE_BREAK_ADS.find((candidate) => candidate.artwork === name);
    return ad ? { kind: 'ad', ad } : null;
  }
  return Object.hasOwn(BREAK_CARDS, name)
    ? { kind: 'card', card: BREAK_CARDS[name as CardArtwork] }
    : null;
}

function welcomeIds(params: URLSearchParams, now: number): string[] {
  if (params.has('welcomeSince')) {
    const since = params.get('welcomeSince')!;
    if (!/^\d+$/.test(since) || now - Number(since) > WELCOME_FRESH_MS) return [];
  }
  const ids = (params.get('welcome') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => HOUSE_ID.test(id));
  return [...new Set(ids)].slice(0, WELCOME_MAX);
}

/**
 * Reads the /live/ query string. `breaks` absent → off; bare, empty or not a whole number from
 * 1 to 120 → 30; `break=ad:<artwork>|card:<card>`; `welcome=<id>,<id>` (at most 3, dropped once
 * `welcomeSince` is over ten minutes old); `welcomeWait=1`. Anything else (like `v=`) is ignored.
 */
export function readLiveParams(search: string, now: number): LiveParams {
  const params = new URLSearchParams(search);
  return {
    breakMinutes: breakMinutes(params),
    forced: forcedItem(params.get('break')),
    welcome: welcomeIds(params, now),
    welcomeWait: params.get('welcomeWait') === '1',
  };
}
