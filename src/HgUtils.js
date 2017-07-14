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
    debugLog('Running hg ', subcommand, args, ' at ', options.cwd);

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

export function getRepoRoot(dir?: string): Observable<string> {
  return hg('root', [], {cwd: dir}).map(out => out.trim());
}

export function getCurrentRevisionHash(repoRoot: string): Observable<string> {
  return hg('id', ['-i', '--debug'], {cwd: repoRoot}).map(out => out.trim());
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

export function update(repoRoot: string, hash: string): Observable<empty> {
  return hg('update', [hash], {cwd: repoRoot}).ignoreElements();
}

export function setPhase(
  repoRoot: string,
  phase: CommitPhase,
  hash: string,
): Observable<empty> {
  return hg('phase', [`--${phase}`, hash], {cwd: repoRoot}).ignoreElements();
}

export function isDirty(repoRoot: string): Observable<boolean> {
  return hg('status', [], {cwd: repoRoot}).map(stdout => stdout.trim() !== '');
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

export function strip(repoRoot: string, hash: string): Observable<empty> {
  return hg('strip', [hash], {cwd: repoRoot}).ignoreElements();
}

export function shelve(repoRoot: string): Observable<empty> {
  return hg('shelve', [], {cwd: repoRoot}).ignoreElements();
}

export function unshelve(repoRoot: string): Observable<empty> {
  return hg('unshelve', [], {cwd: repoRoot}).ignoreElements();
}
