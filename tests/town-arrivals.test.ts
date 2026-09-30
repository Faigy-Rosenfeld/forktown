import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { arrivalDates, readArrivalOrder, readArrivals } from '../scripts/town-arrivals';
import { SUBPROCESS_TEST } from './subprocess-timeout';

const folders: string[] = [];
const temporary = () => {
  const folder = mkdtempSync(join(tmpdir(), 'forktown-arrivals-'));
  folders.push(folder);
  return folder;
};
afterEach(() => {
  for (const folder of folders.splice(0)) {
    if (
      dirname(resolve(folder)) !== resolve(tmpdir()) ||
      !basename(folder).startsWith('forktown-arrivals-')
    )
      throw new Error('Unexpected temporary path');
    rmSync(folder, { recursive: true });
  }
});
function repository() {
  const root = temporary();
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  git('init');
  git('config', 'user.name', 'Test Neighbor');
  git('config', 'user.email', 'neighbor@example.test');
  git('config', 'commit.gpgsign', 'false');
  mkdirSync(join(root, 'places'));
  const save = (name: string, value: string) => {
    writeFileSync(join(root, 'places', `${name}.json`), value);
    git('add', '.');
    git('commit', '-m', name);
  };
  return { root, save, git };
}

it('uses join order, not alphabetical order or later edits to older homes', SUBPROCESS_TEST, () => {
  const { root, save, git } = repository();
  save('alpha', '{}');
  save('zebra', '{}');
  save('alpha', '{"edited":true}');
  expect(readArrivalOrder(root)).toEqual(['zebra', 'alpha']);
  git('rm', 'places/zebra.json');
  git('commit', '-m', 'Remove a place');
  expect(readArrivalOrder(root)).toEqual(['zebra', 'alpha']);
});

it('does not invent arrivals from the boundary of a shallow checkout', SUBPROCESS_TEST, () => {
  const { root, save } = repository();
  save('alpha', '{}');
  save('zebra', '{}');
  const shallow = temporary();
  execFileSync('git', ['clone', '--depth', '1', pathToFileURL(root).href, shallow], {
    stdio: 'pipe',
  });
  expect(readArrivalOrder(shallow)).toEqual([]);
});

it('supports downloaded source without Git history', () => {
  expect(readArrivalOrder(temporary())).toEqual([]);
});

it('dates each arrival by its newest move-in, newest first', SUBPROCESS_TEST, () => {
  const { root, git } = repository();
  // Committer dates, pinned, so the order and the times don't depend on how fast the test runs.
  const commit = (message: string, date: string) =>
    execFileSync('git', ['commit', '-m', message], {
      cwd: root,
      stdio: 'pipe',
      env: { ...process.env, GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date },
    });
  const add = (name: string, date: string, value = '{}') => {
    writeFileSync(join(root, 'places', `${name}.json`), value);
    git('add', '.');
    commit(name, date);
  };
  add('alpha', '2026-09-20T10:00:00Z');
  add('zebra', '2026-09-21T10:00:00+03:00');
  add('alpha', '2026-09-22T10:00:00Z', '{"edited":true}');
  git('rm', 'places/zebra.json');
  commit('Remove a place', '2026-09-23T10:00:00Z');
  add('moss-nook', '2026-09-24T10:00:00Z');
  add('zebra', '2026-09-29T18:29:00+03:00');
  const arrivals = readArrivals(root);
  expect(arrivals).toEqual([
    { id: 'zebra', at: '2026-09-29T18:29:00+03:00' },
    { id: 'moss-nook', at: '2026-09-24T10:00:00Z' },
    { id: 'alpha', at: '2026-09-20T10:00:00Z' },
  ]);
  expect(arrivals.map((arrival) => arrival.id)).toEqual(readArrivalOrder(root));
  expect(arrivalDates(arrivals)).toEqual({
    zebra: '2026-09-29T18:29:00+03:00',
    'moss-nook': '2026-09-24T10:00:00Z',
    alpha: '2026-09-20T10:00:00Z',
  });
});

it('dates nothing from a shallow checkout or without Git', SUBPROCESS_TEST, () => {
  const { root, save } = repository();
  save('alpha', '{}');
  save('zebra', '{}');
  const shallow = temporary();
  execFileSync('git', ['clone', '--depth', '1', pathToFileURL(root).href, shallow], {
    stdio: 'pipe',
  });
  expect(readArrivals(shallow)).toEqual([]);
  expect(readArrivals(temporary())).toEqual([]);
  expect(arrivalDates([])).toEqual({});
});
