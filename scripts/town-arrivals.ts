import { execFileSync } from 'node:child_process';

/** Most recently added first, following the town's merge history rather than file edits. */
export function readArrivalOrder(root: string): string[] {
  try {
    const git = (args: string[]) =>
      execFileSync('git', args, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10000,
      }).trim();
    // A shallow checkout presents every old file as newly added. Prefer no claim to a false one.
    if (git(['rev-parse', '--is-shallow-repository']) === 'true') return [];
    const history = git([
      'log',
      '--first-parent',
      '--diff-filter=A',
      '--format=',
      '--name-only',
      '--',
      'places/',
    ]);
    return [
      ...new Set(
        history.split(/\r?\n/).flatMap((path) => {
          const match = /^places\/([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/.exec(path);
          return match ? [match[1]] : [];
        }),
      ),
    ];
  } catch {
    // Downloaded source archives may not have Git metadata.
    return [];
  }
}

export type Arrival = { id: string; at: string };

/**
 * Every house that moved in, newest first, with the time it last did (the committer date of its
 * newest add, ISO 8601). A house that left and came back counts from its return. The same history
 * rules as readArrivalOrder: nothing on a shallow checkout or without Git.
 */
export function readArrivals(root: string): Arrival[] {
  try {
    const git = (args: string[]) =>
      execFileSync('git', args, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10000,
      }).trim();
    if (git(['rev-parse', '--is-shallow-repository']) === 'true') return [];
    // One record per commit: a separator, the date, then the files it added.
    const history = git([
      'log',
      '--first-parent',
      '--diff-filter=A',
      '--format=%x1e%cI',
      '--name-only',
      '--',
      'places/',
    ]);
    const arrivals = new Map<string, string>();
    for (const record of history.split('\x1e').slice(1)) {
      const [at, ...paths] = record.split(/\r?\n/).map((line) => line.trim());
      for (const path of paths) {
        const match = /^places\/([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/.exec(path);
        // Newest first, so the first add seen is the one that counts.
        if (match && !arrivals.has(match[1])) arrivals.set(match[1], at);
      }
    }
    return [...arrivals].map(([id, at]) => ({ id, at }));
  } catch {
    return [];
  }
}

/** When each house last moved in, by id: the shape the page's __TOWN_ARRIVAL_DATES__ takes. */
export const arrivalDates = (arrivals: readonly Arrival[]): Record<string, string> =>
  Object.fromEntries(arrivals.map(({ id, at }) => [id, at]));
