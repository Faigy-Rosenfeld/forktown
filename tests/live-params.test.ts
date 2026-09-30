import { describe, expect, it } from 'vitest';
import { BREAK_CARDS, LIVE_BREAK_ADS } from '../src/lib/break-cards';
import { CINEMA_ADS } from '../src/lib/cinema';
import { readLiveParams } from '../src/lib/live-params';

// The stream box builds these addresses (live-url.mjs) and tests the same table on its side.
const NOW = Date.UTC(2026, 8, 30, 12);

describe('The /live/ address', () => {
  it.each([
    ['', null],
    ['?', null],
    ['?v=0123456789ab', null],
    ['?breaks', 30],
    ['?breaks=', 30],
    ['breaks=', 30],
    ['?breaks=1', 1],
    ['?breaks=3', 3],
    ['?breaks=30', 30],
    ['?breaks=120', 120],
    ['?breaks=007', 7],
    ['?breaks=0', 30],
    ['?breaks=121', 30],
    ['?breaks=-5', 30],
    ['?breaks=1.5', 30],
    ['?breaks=abc', 30],
    ['?breaks=%2030', 30],
    ['?breaks=&v=0123456789ab', 30],
    ['?v=0123456789ab&breaks=3', 3],
    ['?breaks=3&breaks=5', 3],
  ])('reads %j as breaks every %j minutes', (search, minutes) => {
    expect(readLiveParams(search, NOW).breakMinutes).toBe(minutes);
  });

  it('asks for nothing when the address says nothing', () => {
    expect(readLiveParams('', NOW)).toEqual({
      breakMinutes: null,
      forced: null,
      welcome: [],
      welcomeWait: false,
    });
    expect(readLiveParams('?v=abc&utm_source=box&welcomeWait=0', NOW)).toEqual({
      breakMinutes: null,
      forced: null,
      welcome: [],
      welcomeWait: false,
    });
  });

  it('forces any live-break ad or card, and nothing it doesn’t know', () => {
    for (const ad of LIVE_BREAK_ADS)
      expect(readLiveParams(`?break=ad:${ad.artwork}`, NOW).forced).toEqual({ kind: 'ad', ad });
    for (const card of Object.values(BREAK_CARDS))
      expect(readLiveParams(`?break=card:${card.card}`, NOW).forced).toEqual({
        kind: 'card',
        card,
      });
    const cinemaOnly = CINEMA_ADS.filter((ad) => !LIVE_BREAK_ADS.includes(ad));
    expect(cinemaOnly.length).toBeGreaterThan(0);
    for (const search of [
      ...cinemaOnly.map((ad) => `?break=ad:${ad.artwork}`),
      '?break=ad:',
      '?break=card:',
      '?break=card:toString',
      '?break=card:constructor',
      '?break=ad:unknown',
      '?break=card:intermission',
      '?break=realty',
      '?break=film:tuesday',
      '?break',
    ])
      expect(readLiveParams(search, NOW).forced, search).toBeNull();
  });

  it.each([
    ['?welcome=funky-fun', ['funky-fun']],
    ['?welcome=funky-fun,arts', ['funky-fun', 'arts']],
    ['?welcome=a,b,c,d', ['a', 'b', 'c']],
    ['?welcome=arts,arts,moss-nook', ['arts', 'moss-nook']],
    ['?welcome=Arts,-bad,bad-,a--b,ok,../x,%20spaced%20', ['ok', 'spaced']],
    ['?welcome=', []],
    ['?welcome', []],
    [`?welcome=arts&welcomeSince=${NOW - 600_000}`, ['arts']],
    [`?welcome=arts&welcomeSince=${NOW - 600_001}`, []],
    [`?welcome=arts&welcomeSince=${NOW + 5000}`, ['arts']],
    ['?welcome=arts&welcomeSince=', []],
    ['?welcome=arts&welcomeSince=yesterday', []],
  ])('reads %j as a welcome for %j', (search, ids) => {
    expect(readLiveParams(search, NOW).welcome).toEqual(ids);
  });

  it('waits for the stream box only when asked to', () => {
    expect(readLiveParams('?welcome=arts&welcomeWait=1', NOW).welcomeWait).toBe(true);
    for (const search of ['?welcomeWait', '?welcomeWait=', '?welcomeWait=true', '?welcomeWait=0'])
      expect(readLiveParams(search, NOW).welcomeWait, search).toBe(false);
  });

  it('reads a whole deploy reload from the stream box', () => {
    const search = `?breaks=&v=0123456789ab&welcome=funky-fun,arts&welcomeWait=1&welcomeSince=${NOW - 20_000}`;
    expect(readLiveParams(search, NOW)).toEqual({
      breakMinutes: 30,
      forced: null,
      welcome: ['funky-fun', 'arts'],
      welcomeWait: true,
    });
  });
});
