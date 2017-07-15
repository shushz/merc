/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

import type {SerializableAppState} from './types';

import yargs from 'yargs';
import {update} from './HgUtils';
import {dumpSubtree} from './debug';
import debugLog from './debugLog';
import getFileDependencies from './subtree/getFileDependencies';
import getSubtree from './subtree/getSubtree';
import {moveSubtree} from './subtree/moveSubtree';
import {getInitialAppState, saveState} from './AppStateUtils';
import {initShadowRepo} from './RepoUtils';
import {Observable} from 'rxjs';

yargs
  .usage('$0 <cmd> [args]')
  .command('break', 'Start managing current branch with merc', argv => {
    debugLog('Breaking stuff');
    run(
      getInitialAppState(false).switchMap(appState => {
        const {sourceRepoRoot} = appState;
        debugLog('Repo root is: ', sourceRepoRoot);

        return getSubtree(sourceRepoRoot)
          .switchMap(sourceSubtree => {
            const sourceRoot = sourceSubtree.root;
            const baseFiles = getFileDependencies(sourceRoot);
            debugLog('The base files are: ', baseFiles);
            debugLog(sourceRepoRoot, sourceRoot.hash);
            return update(sourceRepoRoot, sourceRoot.hash)
              .concat(initShadowRepo(sourceRepoRoot, baseFiles))
              .switchMap(shadowRepoRoot =>
                moveSubtree({
                  sourceRepoRoot,
                  sourceRoot,
                  currentHash: sourceSubtree.currentCommit.hash,
                  destRepoRoot: shadowRepoRoot,
                  destParentHash: '.',
                }),
              )
              .map(shadowRoot => ({shadowRoot, sourceRoot}));
          })
          .map(({shadowRoot, sourceRoot}) => {
            return {
              ...appState,
              initialized: true,
              shadowRootSources: new Map([[shadowRoot.hash, sourceRoot.hash]]),
            };
          });
      }),
    );
  })
  .command('debug', 'Options: getSubtree', ({argv}) => {
    if (argv._[1] === 'getSubtree') {
      getSubtree(process.cwd()).subscribe(res => dumpSubtree(res));
    }
  })
  .help().argv;

/**
 * Subscribe to the provided observable, and serialize the end state to the disk.
 */
function run(command: Observable<SerializableAppState>): void {
  command.switchMap(saveState).subscribe(
    () => {},
    // eslint-disable-next-line no-console
    err => console.error(err),
    () => {
      debugLog('Done!');
    },
  );
}
