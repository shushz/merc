/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

import type {SerializableAppState} from './types';

import invariant from 'assert';
import yargs from 'yargs';
import {purgeFiles, revertFiles, update} from './HgUtils';
import {dumpSubtree} from './debug';
import debugLog from './debugLog';
import getFileDependencies from './subtree/getFileDependencies';
import getSubtree from './subtree/getSubtree';
import {bulkMoveSubtree} from './subtree/moveSubtree';
import {
  getInitializedAppState,
  getUninitializedAppState,
  saveState,
} from './AppStateUtils';
import {initShadowRepo, getShadowRepoRoot} from './RepoUtils';
import {Observable} from 'rxjs';
import {startTrackingChangesForSync, sync, syncTracked} from './sync';
import {endWatchman} from './watchman';
import {spawn} from 'nuclide-commons/process';
import {dfs} from './TreeUtils';

let commandWasHandled = false;

const trackedSyncState = {
  clock: '',
};

yargs
  .usage('$0 <cmd> [args]')
  .command('break', 'Start managing current branch with merc', argv => {
    debugLog('Breaking stuff');
    run(
      getUninitializedAppState()
        .switchMap(appState => {
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
                .switchMap(shadowRepoRoot => {
                  return startTrackingChangesForSync(
                    shadowRepoRoot,
                    trackedSyncState,
                  )
                    .concat(
                      bulkMoveSubtree({
                        sourceRepoRoot,
                        sourceRoot,
                        currentHash: sourceSubtree.currentCommit.hash,
                        destRepoRoot: shadowRepoRoot,
                        destParentHash: '.',
                      }),
                    )
                    .switchMap(shadowRoot => {
                      return syncTracked(
                        shadowRepoRoot,
                        sourceRepoRoot,
                        trackedSyncState,
                      ).concat(Observable.of(shadowRoot));
                    });
                })
                .map(shadowRoot => ({shadowRoot, sourceRoot}));
            })
            .map(({shadowRoot, sourceRoot}) => {
              return {
                ...appState,
                initialized: true,
                shadowRootSources: new Map([
                  [shadowRoot.hash, sourceRoot.hash],
                ]),
              };
            });
        })
        .finally(() => debugLog('Finished running the command')),
    );
  })
  .command(
    'unbreak',
    'Stop managing current branch with merc and reattach it to the main repository',
    argv => {
      debugLog('Unbreaking stuff');
      run(
        getInitializedAppState().switchMap(appState => {
          const {sourceRepoRoot} = appState;
          debugLog('Repo root is: ', sourceRepoRoot);
          const shadowRoot = appState.shadowSubtree.root;
          const allFiles = new Set();
          for (const node of dfs(appState.shadowSubtree.root)) {
            if (node.phase !== 'public') {
              node.addedFiles.forEach(f => allFiles.add(f));
              node.deletedFiles.forEach(f => allFiles.add(f));
              node.modifiedFiles.forEach(f => allFiles.add(f));
              node.copiedFiles.forEach(c => {
                allFiles.add(c.source);
                allFiles.add(c.dest);
              });
            }
          }
          const shadowRootHash = shadowRoot.hash;
          const mainRootHash = appState.shadowRootSources.get(shadowRootHash);
          invariant(mainRootHash != null);

          // Move the shadow repo back to the main one.
          return Observable.concat(
            revertFiles(appState.sourceRepoRoot, allFiles),
            purgeFiles(appState.sourceRepoRoot, allFiles),
            bulkMoveSubtree({
              sourceRepoRoot: appState.shadowRepoRoot,
              sourceRoot: appState.shadowSubtree.root,
              currentHash: appState.shadowSubtree.currentCommit.hash,
              destRepoRoot: appState.sourceRepoRoot,
              destParentHash: mainRootHash,
            }),
          ).map(() => {
            // Now that the shadow root is gone, we no longer need to remember where it came from.
            const shadowRootSources = new Map(appState.shadowRootSources);
            shadowRootSources.delete(shadowRootHash);
            return {
              sourceRepoRoot: appState.sourceRepoRoot,
              shadowRepoRoot: appState.shadowRepoRoot,
              shadowRootSources,
            };
          });
        }),
      );
    },
  )
  .command(
    'sync',
    'Sync the changes in the main repo to the shadow one',
    argv => {
      debugLog('Syncing stuff');
      run(
        getInitializedAppState().switchMap(appState => {
          const sourceHash = appState.shadowRootSources.get(
            appState.shadowSubtree.root.hash,
          );
          invariant(sourceHash);

          return sync(
            appState.sourceRepoRoot,
            appState.shadowSubtree,
            sourceHash,
            appState.shadowIsDirty,
            appState.wClock,
          );
        }),
      );
    },
  )
  .command('debug', 'Options: getSubtree', ({argv}) => {
    if (argv._[1] === 'getSubtree') {
      getSubtree(process.cwd()).subscribe(res => dumpSubtree(res));
    }
  })
  .help().argv;

// If the command wasn't handled by us, we need to forward it to hg.
if (!commandWasHandled) {
  run(
    getInitializedAppState().switchMap(appState => {
      const sourceHash = appState.shadowRootSources.get(
        appState.shadowSubtree.root.hash,
      );
      invariant(sourceHash);

      const shadowRepoRoot = getShadowRepoRoot(appState.sourceRepoRoot);

      return sync(
        appState.sourceRepoRoot,
        appState.shadowSubtree,
        sourceHash,
        appState.shadowIsDirty,
        appState.wClock,
      ).switchMap(newState => {
        const args = process.argv.slice(2);
        debugLog(`Forwarding hg command: ${args.join(' ')}`);
        return startTrackingChangesForSync(shadowRepoRoot, trackedSyncState)
          .concat(
            spawn('hg', args, {
              stdio: 'inherit',
              cwd: appState.shadowRepoRoot,
            }),
          )
          .do({complete: () => debugLog('1')})
          .switchMap(proc =>
            Observable.fromEvent(proc, 'close')
              .do(exitCode => {
                if (exitCode !== 0) {
                  throw new ForwardedCommandError(exitCode, proc);
                }
              })
              .take(1),
          )
          .do({complete: () => debugLog('2')})
          .ignoreElements()
          .concat(
            syncTracked(
              shadowRepoRoot,
              appState.sourceRepoRoot,
              trackedSyncState,
            ).do({complete: () => debugLog('3')}),
            Observable.of(newState),
          );
      });
    }),
  );
}

/**
 * Subscribe to the provided observable, and serialize the end state to the disk.
 */
function run(command: Observable<SerializableAppState>): void {
  commandWasHandled = true;
  command.switchMap(saveState).finally(() => endWatchman()).subscribe(
    () => {},
    // eslint-disable-next-line no-console
    err => console.error(err),
    () => {
      debugLog('Done!');
    },
  );
}

export class ForwardedCommandError extends Error {
  process: child_process$ChildProcess;
  exitCode: number;
  constructor(exitCode: number, proc: child_process$ChildProcess) {
    super(`Forwarded command failed: ${(proc: any).spawnargs}`);
    this.process = proc;
    this.exitCode = exitCode;
    this.name = this.constructor.name;
  }
}
