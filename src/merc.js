/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

import yargs from 'yargs';
import {getRepoRoot, getSubtree, moveSubtree, update} from './hgUtils';
import {dumpSubtree} from './debug';
import getFileDependencies from './getFileDependencies';
import {initShadowRepo} from './repoUtils';
import {compact} from 'nuclide-commons/observable';

yargs
  .usage('$0 <cmd> [args]')
  .command('break', 'Start managing current branch with merc', argv => {
    console.log('Breaking stuff');
    compact(getRepoRoot(process.cwd()))
      .switchMap(repoRoot => {
        console.log('Repo root is: ', repoRoot);

        return getSubtree(repoRoot).switchMap(subTree => {
          const baseFiles = getFileDependencies(subTree);
          console.log('The base files are: ', baseFiles);

          return update(repoRoot, subTree.hash)
            .concat(initShadowRepo(repoRoot, baseFiles))
            .switchMap(shadowRepoRoot => {
              return moveSubtree({
                sourceRepoRoot: repoRoot,
                sourceRoot: subTree,
                destRepoRoot: shadowRepoRoot,
              });
            });
        });
      })
      .subscribe(
        () => {},
        err => console.error(err),
        () => {
          console.log('Done!');
        },
      );
  })
  .command('debug', 'Options: getSubtree', ({argv}) => {
    if (argv._[1] === 'getSubtree') {
      getSubtree(process.cwd()).subscribe(res => dumpSubtree(res));
    }
  })
  .help().argv;
