import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildManifest, buildManifestData, readBuildInfo } from '../scripts/build-manifest';
import { townArrivals, townArrivalDates } from '../src/lib/arrivals';
import { ARTS, BAZPLACE, EVERGREEN, FUNKY_FUN, HELLO_WORLD, JONS_ARCADE } from './fixtures';
import { readPlaces } from './full-town';
import { SUBPROCESS_TEST } from './subprocess-timeout';

// Every input is injected: the sha, the time and the arrival order, so these hold in CI (which
// sets GITHUB_SHA), in a shallow clone and in the full-town copy with no history at all.
const SHA = '0123456789abcdef0123456789abcdef01234567';
const BUILT_AT = '2026-09-30T06:00:00.000Z';

describe('live/build.json', () => {
  it('lists every house, founders marked, and the newest neighbor', () => {
    const places = [HELLO_WORLD, FUNKY_FUN, EVERGREEN, ARTS, JONS_ARCADE];
    const arrivals = ['gone-away', 'evergreen', 'funky-fun', 'arts', 'funky-fun', 'jons-arcade'];
    expect(buildManifestData(places, arrivals, SHA, BUILT_AT)).toEqual({
      version: 1,
      sha: SHA,
      builtAt: BUILT_AT,
      houses: [
        { id: 'arts', name: ARTS.name, creator: ARTS.creator, founder: false },
        { id: 'evergreen', name: EVERGREEN.name, creator: 'forktown', founder: true },
        { id: 'funky-fun', name: FUNKY_FUN.name, creator: FUNKY_FUN.creator, founder: false },
        { id: 'hello-world', name: HELLO_WORLD.name, creator: 'forktown', founder: true },
        { id: 'jons-arcade', name: JONS_ARCADE.name, creator: JONS_ARCADE.creator, founder: false },
      ],
      // Only houses in this build, each once, newest first.
      arrivals: ['evergreen', 'funky-fun', 'arts', 'jons-arcade'],
      // A founder is never the latest arrival, and a house that left can't be either.
      latestArrival: { id: 'funky-fun', name: FUNKY_FUN.name, creator: FUNKY_FUN.creator },
    });
  });

  it('claims no arrival without history, and names no build without a sha', () => {
    const data = buildManifestData([BAZPLACE, EVERGREEN], [], null, BUILT_AT);
    expect(data).toMatchObject({ sha: null, arrivals: [], latestArrival: null });
    expect(data.houses.map((house) => house.id)).toEqual(['bazplace', 'evergreen']);
    expect(buildManifestData([EVERGREEN], ['evergreen'], SHA, BUILT_AT).latestArrival).toBeNull();
    expect(buildManifestData([], ['arts'], SHA, BUILT_AT)).toMatchObject({
      houses: [],
      arrivals: [],
      latestArrival: null,
    });
  });

  it('emits one asset from the town’s house files, with only production builds', async () => {
    const plugin = buildManifest({ sha: SHA, builtAt: BUILT_AT }, ['nobody-here']);
    expect(plugin.apply).toBe('build');
    (plugin.configResolved as unknown as (config: unknown) => void)({ root: process.cwd() });
    const emitted: { type: string; fileName: string; source: string }[] = [];
    await (plugin.generateBundle as unknown as (this: unknown) => Promise<void>).call({
      emitFile: (file: (typeof emitted)[number]) => emitted.push(file),
    });
    expect(emitted.map(({ type, fileName }) => ({ type, fileName }))).toEqual([
      { type: 'asset', fileName: 'live/build.json' },
    ]);
    const places = readPlaces();
    const data = JSON.parse(emitted[0].source);
    expect(emitted[0].source.endsWith('}\n')).toBe(true);
    expect(data).toMatchObject({ version: 1, sha: SHA, builtAt: BUILT_AT, arrivals: [] });
    expect(data.latestArrival).toBeNull();
    expect(data.houses).toHaveLength(places.length);
    expect(data.houses.map((house: { id: string }) => house.id).sort()).toEqual(
      places.map((place) => place.id).sort(),
    );
    for (const house of data.houses)
      expect(house.founder).toBe(
        places.find((place) => place.id === house.id)!.creator === 'forktown',
      );
  });
});

describe('The build’s identity', () => {
  const folders: string[] = [];
  afterEach(() => {
    for (const folder of folders.splice(0)) {
      if (
        dirname(resolve(folder)) !== resolve(tmpdir()) ||
        !basename(folder).startsWith('forktown-build-')
      )
        throw new Error('Unexpected temporary path');
      rmSync(folder, { recursive: true });
    }
  });
  const scratch = () => {
    const folder = mkdtempSync(join(tmpdir(), 'forktown-build-'));
    folders.push(folder);
    return folder;
  };
  const now = new Date(BUILT_AT);

  it('takes CI’s sha first', () => {
    expect(readBuildInfo(scratch(), { GITHUB_SHA: SHA }, now)).toEqual({
      sha: SHA,
      builtAt: BUILT_AT,
    });
  });

  it('names HEAD in a checkout, and nothing without one', SUBPROCESS_TEST, () => {
    const folder = scratch();
    // Nothing above the scratch folder may pass for its repository.
    const env = { ...process.env, GITHUB_SHA: '', GIT_CEILING_DIRECTORIES: dirname(folder) };
    expect(readBuildInfo(folder, env, now)).toEqual({ sha: null, builtAt: BUILT_AT });
    const git = (...args: string[]) => execFileSync('git', args, { cwd: folder, stdio: 'pipe' });
    git('init');
    git('config', 'user.name', 'Test Neighbor');
    git('config', 'user.email', 'neighbor@example.test');
    git('config', 'commit.gpgsign', 'false');
    git('commit', '--allow-empty', '-m', 'Start');
    const head = git('rev-parse', 'HEAD').toString().trim();
    expect(readBuildInfo(folder, env, now)).toEqual({ sha: head, builtAt: BUILT_AT });
  });
});

describe('What the page is told', () => {
  it('knows its own build, as live/build.json names it', () => {
    expect(__FORKTOWN_BUILD__.builtAt).toBe(new Date(__FORKTOWN_BUILD__.builtAt).toISOString());
    expect(__FORKTOWN_BUILD__.sha === null || /^[0-9a-f]{40}$/.test(__FORKTOWN_BUILD__.sha)).toBe(
      true,
    );
  });

  it('dates every arrival it knows, and no others', () => {
    // Empty without history (a shallow clone or the full-town copy), full with it.
    expect(Object.keys(townArrivalDates).sort()).toEqual([...townArrivals].sort());
    for (const at of Object.values(townArrivalDates))
      expect(Number.isFinite(Date.parse(at))).toBe(true);
  });
});
