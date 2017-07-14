/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

import yargs from 'yargs';
import {getRepoRoot, update} from './HgUtils';
import {dumpSubtree} from './debug';
import debugLog from './debugLog';
import getFileDependencies from './subtree/getFileDependencies';
import getSubtree from './subtree/getSubtree';
import {moveSubtree} from './subtree/moveSubtree';
import {initShadowRepo} from './RepoUtils';

yargs
  .usage('$0 <cmd> [args]')
  .command('break', 'Start managing current branch with merc', argv => {
    debugLog('Breaking stuff');
    getRepoRoot(process.cwd())
      .switchMap(repoRoot => {
        debugLog('Repo root is: ', repoRoot);

        return getSubtree(repoRoot).switchMap(subtree => {
          const subtreeRoot = subtree.root;
          const baseFiles = getFileDependencies(subtreeRoot);
          debugLog('The base files are: ', baseFiles);

          return update(repoRoot, subtreeRoot.hash)
            .concat(initShadowRepo(repoRoot, baseFiles))
            .switchMap(shadowRepoRoot => {
              return moveSubtree({
                sourceRepoRoot: repoRoot,
                sourceRoot: subtreeRoot,
                currentHash: subtree.currentCommit.hash,
                destRepoRoot: shadowRepoRoot,
                destParentHash: '.',
              });
            });
        });
      })
      .subscribe(
        () => {},
        // eslint-disable-next-line no-console
        err => console.error(err),
        () => {
          // eslint-disable-next-line no-console
          debugLog('Done!');
        },
      );
  })
  .command('debug', 'Options: getSubtree', ({argv}) => {
    if (argv._[1] === 'getSubtree') {
      getSubtree(process.cwd()).subscribe(res => dumpSubtree(res));
    }
  })
  .help().argv;
