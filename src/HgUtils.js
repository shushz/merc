/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

import type {ObserveProcessOptions} from 'nuclide-commons/process';
import type {CommitPhase} from './types';

import debugLog from './debugLog';
import {runCommand} from 'nuclide-commons/process';
import {Observable} from 'rxjs';
import {sep} from 'path';

export class NotARepositoryError extends Error {
  constructor() {
    super('Command was run outside of an hg repository');
    this.name = this.constructor.name;
  }
}

function hg(
  subcommand: string,
  args: Array<string>,
  options: ObserveProcessOptions = {},
): Observable<string> {
  return Observable.defer(() => {
    debugLog('hg', subcommand, args, 'in dir', options.cwd);
    return runCommand('hg', [subcommand, ...args], {
      ...options,
      env: {...process.env, ...options.env, HGPLAIN: '1'},
    }).catch(err => {
      if (
        err.exitCode === 255 &&
        typeof err.stderr === 'string' &&
        err.stderr.startsWith('abort: no repository found in')
      ) {
        throw new NotARepositoryError();
      }
      throw err;
    });
  });
}

export function getRepoRoot(dir_?: string): Observable<string> {
  const dir = dir_ || process.cwd();
  return hg('root', [], {cwd: dir}).map(out => out.trim());
}

export function getCurrentRevisionHash(repoRoot: string): Observable<string> {
  return log(repoRoot, '.', '{node}').map(out => out.trim());
}

export function getMergeBaseHash(
  repoRoot: string,
  hash: string = '.',
): Observable<string> {
  return log(
    repoRoot,
    `last(public() and ancestors(${hash}))`,
    '{node}',
  ).map(out => out.trim());
}

export function initRepo(root: string): Observable<empty> {
  return hg('init', [root]).ignoreElements();
}

export function add(
  repoRoot: string,
  ...files: Array<string>
): Observable<empty> {
  return hg('add', files, {cwd: repoRoot}).ignoreElements();
}

export function log(
  repoRoot: string,
  revision: string,
  template: string,
): Observable<string> {
  return hg('log', ['-r', revision, '--template', template], {cwd: repoRoot});
}

export function commit(repoRoot: string, message: string): Observable<empty> {
  return hg('commit', ['-m', message], {cwd: repoRoot}).ignoreElements();
}

export function amend(repoRoot: string): Observable<empty> {
  return hg('amend', [], {cwd: repoRoot}).ignoreElements();
}

export function update(repoRoot: string, hash: string): Observable<empty> {
  return hg('update', [hash], {cwd: repoRoot}).ignoreElements();
}

export function setPhase(
  repoRoot: string,
  phase: CommitPhase,
  hash: string,
): Observable<empty> {
  return hg('phase', [`--${phase}`, '-f', hash], {
    cwd: repoRoot,
  }).ignoreElements();
}

export function isDirty(repoRoot: string): Observable<boolean> {
  return hg('status', ['-mard'], {cwd: repoRoot}).map(
    stdout => stdout.trim() !== '',
  );
}

export function transplant(
  sourceRepoRoot: string,
  sourceHash: string,
  destRepoRoot: string,
): Observable<empty> {
  return hg('export', ['-r', sourceHash], {
    cwd: sourceRepoRoot,
  })
    .concatMap(patch => hg('import', ['-'], {input: patch, cwd: destRepoRoot}))
    .ignoreElements();
}

export function transplantBulk(
  sourceRepoRoot: string,
  sourceHashes: Array<string>,
  destRepoRoot: string,
): Observable<empty> {
  return hg('export', ['-r', sourceHashes.join(' + ')], {
    cwd: sourceRepoRoot,
  })
    .concatMap(patch => hg('import', ['-'], {input: patch, cwd: destRepoRoot}))
    .ignoreElements();
}

export function strip(repoRoot: string, hash: string): Observable<empty> {
  // Fake for now so we don't accidentally mess things up.
  return Observable.defer(() => {
    debugLog('PRETEND: hg strip', hash, 'in', repoRoot);
    return Observable.empty();
  });
  // return hg('strip', [hash], {cwd: repoRoot}).ignoreElements();
}

export function shelve(repoRoot: string): Observable<empty> {
  return hg('shelve', [], {cwd: repoRoot}).ignoreElements();
}

export function unshelve(repoRoot: string): Observable<empty> {
  return hg('unshelve', [], {cwd: repoRoot}).ignoreElements();
}

export function copyByCat(
  repoRoot: string,
  hash: string,
  targetPrefix: string,
  files: Set<string>,
): Observable<empty> {
  return hg(
    'cat',
    ['-r', hash, '--output', `${targetPrefix}${sep}%p`, ...Array.from(files)],
    {
      cwd: repoRoot,
      isExitError: msg => msg.exitCode !== 0 && msg.exitCode !== 1,
    },
  ).ignoreElements();
}

export function rebase(
  repoRoot: string,
  sourceHash: string,
  targetHash: string,
): Observable<empty> {
  return hg('rebase', ['-s', sourceHash, '-d', targetHash], {
    cwd: repoRoot,
  }).ignoreElements();
}

export function revertAll(repoRoot: string): Observable<empty> {
  return hg('revert', ['--all'], {cwd: repoRoot}).ignoreElements();
}

export function purge(repoRoot: string): Observable<empty> {
  return hg('purge', ['.'], {cwd: repoRoot}).ignoreElements();
}

export function revertFiles(
  repoRoot: string,
  files: Set<string>,
): Observable<empty> {
  return hg('revert', Array.from(files), {cwd: repoRoot}).ignoreElements();
}

export function purgeFiles(
  repoRoot: string,
  files: Set<string>,
): Observable<empty> {
  return hg('purge', Array.from(files), {cwd: repoRoot}).ignoreElements();
}
