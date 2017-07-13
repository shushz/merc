/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

import type {ObserveProcessOptions} from 'nuclide-commons/process.js';

import {runCommand, ProcessExitError} from 'nuclide-commons/process.js';
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
  return runCommand('hg', [subcommand, ...args], {
    ...options,
    env: {...process.env, ...options.env, HGPLAIN: '1'},
  }).catch(err => {
    if (err instanceof ProcessExitError && err.exitCode === 255) {
      throw new NotARepositoryError();
    }
    throw err;
  });
}

export function getRepoRoot(dir: string): Observable<?string> {
  return hg('root', [], {cwd: dir}).map(out => out.trim()).catch(err => {
    if (err instanceof NotARepositoryError) {
      return Observable.of(null);
    }
    throw err;
  });
}

export function getCurrentRevisionHash(repoRoot: string): Observable<string> {
  return hg('id', ['-i', '--debug'], {cwd: repoRoot}).map(out => out.trim());
}

export function getMergeBaseHash(
  repoRoot: string,
  hash: string = '.',
): Observable<string> {
  return hg(
    'log',
    ['-r', `last(public() and ancestors(${hash}))`, '--template', '{node}'],
    {cwd: repoRoot},
  ).map(out => out.trim());
}

export function _getSubtreeCommitList(
  repoRoot: string,
  hash: string = '.',
): Observable<string> {
  return hg(
    'log',
    [
      '-r',
      `descendants(not public() and children(last(public() and ancestors(${hash})))) or last(public() and ancestors(${hash}))`,
      '--template',
      '----node\n{node}\n----p1node\n{p1node}\n----current\n{ifcontains(rev, revset("."), "1\n")}----phase\n{phase}\n----file_adds\n{file_adds % "{file}\n"}----file_copies\n{file_copies % "{file}\n"}----file_dels\n{file_dels % "{file}\n"}----file_mods\n{file_mods % "{file}\n"}',
    ],
    {cwd: repoRoot},
  );
}
