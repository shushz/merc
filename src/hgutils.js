/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

import type {Observable} from 'rxjs';
import type {ObserveProcessOptions} from 'nuclide-commons/process.js';

import {runCommand} from 'nuclide-commons/process.js';

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
  return hg('root', [], {cwd: dir}).map(out => out.trim());
}
