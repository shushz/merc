/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

import type {ObserveProcessOptions} from 'nuclide-commons/process.js';

import {runCommand, ProcessExitError} from 'nuclide-commons/process.js';
import {Observable} from 'rxjs';

function hg(
  subcommand: string,
  args: Array<string>,
  options: ObserveProcessOptions = {},
): Observable<string> {
  return runCommand('hg', [subcommand, ...args], {
    ...options,
    env: {...process.env, ...options.env, HGRCPATH: '', HGPLAIN: '1'},
  });
}

export function getRepoRoot(dir: string): Observable<string> {
  return hg('root', [], {cwd: dir}).map(out => out.trim()).catch(err => {
    if (err instanceof ProcessExitError && err.exitCode === 255) {
      return Observable.of(null);
    }
    throw err;
  })
}
