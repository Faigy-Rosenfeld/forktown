import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Plugin } from 'vite';
import { validatePlaces, type Place } from '../src/lib/schema.ts';
import { readPlaceFiles } from './place-files.ts';

// live/build.json: which build is published and who lives in it, for the stream box. It polls the
// file to notice a deploy, reloads its camera, and welcomes whoever moved in. Node-side only, so
// it reads houses the way share-preview.ts does and never imports places.ts or arrivals.ts.

export type BuildInfo = { sha: string | null; builtAt: string };
export type BuildManifest = {
  version: 1;
  sha: string | null;
  builtAt: string;
  houses: { id: string; name: string; creator: string; founder: boolean }[];
  /** Houses in this build, newest arrival first. */
  arrivals: string[];
  latestArrival: { id: string; name: string; creator: string } | null;
};

const FOUNDER = 'forktown';

/** This build's identity: GITHUB_SHA in CI, else the checkout's HEAD, else null. */
export function readBuildInfo(
  root: string,
  env: NodeJS.ProcessEnv = process.env,
  now = new Date(),
): BuildInfo {
  let sha = env.GITHUB_SHA || null;
  if (!sha)
    try {
      sha =
        execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd: root,
          env,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 10000,
        }).trim() || null;
    } catch {
      // A source archive or a scratch copy has no history to name.
      sha = null;
    }
  return { sha, builtAt: now.toISOString() };
}

/** The manifest itself, from the build's houses and arrival order (newest first). */
export function buildManifestData(
  places: readonly Pick<Place, 'id' | 'name' | 'creator'>[],
  arrivals: readonly string[],
  sha: string | null,
  builtAt: string,
): BuildManifest {
  const byId = new Map(places.map((place) => [place.id, place]));
  const ordered = [...new Set(arrivals)].filter((id) => byId.has(id));
  // The same newest neighbor as places.ts latestArrival: founders never count as arrivals.
  const latest = ordered.map((id) => byId.get(id)!).find((place) => place.creator !== FOUNDER);
  return {
    version: 1,
    sha,
    builtAt,
    houses: [...places]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map(({ id, name, creator }) => ({ id, name, creator, founder: creator === FOUNDER })),
    arrivals: ordered,
    latestArrival: latest ? { id: latest.id, name: latest.name, creator: latest.creator } : null,
  };
}

/** Emits live/build.json with every production build. */
export function buildManifest(build: BuildInfo, arrivals: readonly string[]): Plugin {
  let root = process.cwd();
  return {
    name: 'forktown-build-manifest',
    apply: 'build',
    configResolved(config) {
      root = config.root ?? root;
    },
    async generateBundle() {
      const { entries, errors: fileErrors } = await readPlaceFiles(
        pathToFileURL(join(root, 'places', '/')),
      );
      const { places, errors } = validatePlaces(entries);
      if (fileErrors.length || errors.length)
        throw new Error(
          `live/build.json could not be built:\n${[...fileErrors, ...errors].join('\n')}`,
        );
      const data = buildManifestData(places, arrivals, build.sha, build.builtAt);
      this.emitFile({
        type: 'asset',
        fileName: 'live/build.json',
        source: `${JSON.stringify(data, null, 2)}\n`,
      });
    },
  };
}
