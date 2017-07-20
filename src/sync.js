/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

import type {WatchmanResult} from './watchman';
import type {Subtree, SerializableAppState} from './types';

import {Observable} from 'rxjs';
import {getChanges, getClock} from './watchman';
import {dirname, resolve, relative} from 'path';
import debugLog from './debugLog';
import {hgIgnores, getShadowRepoRoot} from './RepoUtils';
import {pathSetOfFiles} from './PathSetUtils';
import {
  add,
  amend,
  copyByCat,
  getCurrentRevisionHash,
  setPhase,
  shelve,
  unshelve,
  update,
  rebase,
} from './HgUtils';
import {getPathToCurrent, getByPath} from './subtree/SubtreePath';
import getSubtree from './subtree/getSubtree';
import {spawn} from 'nuclide-commons/process';

import {
  concatIterators,
  filterIterable,
  setUnion,
  setDifference,
} from 'nuclide-commons/collection';
import fsPromise from 'nuclide-commons/fsPromise';

export type TrackedSyncState = {
  clock: string,
};

type GrouppedChanges = {
  sourceWorkspaceChanged: Set<string>,
  sourceWorkspaceDeleted: Set<string>,
  sourceHg: Set<string>,
};

type ChangeSummary = {
  newFilesForBase: Set<string>,
  changes: Set<string>,
  deletions: Set<string>,
};

export function startTrackingChangesForSync(
  repoRoot: string,
  state: TrackedSyncState,
): Observable<empty> {
  return getClock(repoRoot).do(clock => (state.clock = clock)).ignoreElements();
}

export function syncTracked(
  sourceRepo: string,
  targetRepo: string,
  state: TrackedSyncState,
): Observable<empty> {
  return Observable.defer(() =>
    makeTrackedSyncSummary(sourceRepo, state.clock),
  ).switchMap(({changes, deletions, toTouchIfPresent}) => {
    debugLog(
      'Will sync back changes:',
      changes,
      'deletions:',
      deletions,
      'touches',
      toTouchIfPresent,
    );
    return makeSyncFiles(
      sourceRepo,
      targetRepo,
      changes,
      deletions,
      toTouchIfPresent,
    );
  });
}

export function sync(
  sourceRepo: string,
  shadowSubtree: Subtree,
  sourceHash: string,
  isTargetDirty: boolean,
  clock: string,
): Observable<SerializableAppState> {
  const shadowRepoPath = getShadowRepoRoot(sourceRepo);
  return extendedLocalRoots(sourceRepo, shadowSubtree.initialFiles)
    .switchMap(rootFiles =>
      makeChangeSummary(sourceRepo, shadowRepoPath, rootFiles, clock),
    )
    .switchMap(changeSummary => {
      const {preAdd, postAdd} = manageTargetState(
        shadowRepoPath,
        changeSummary,
        isTargetDirty,
      );
      const {addFiles, shadowRootHash} = makeAddFiles(
        sourceRepo,
        shadowRepoPath,
        changeSummary,
        sourceHash,
        shadowSubtree,
      );

      const syncFiles = makeSyncFiles(
        sourceRepo,
        shadowRepoPath,
        changeSummary.changes,
        changeSummary.deletions,
        new Set(),
      );

      return Observable.concat(
        preAdd,
        addFiles,
        postAdd,
        syncFiles,
        shadowRootHash,
      ).map(shadowHash => {
        const shadowRootSources = new Map();
        shadowRootSources.set(shadowHash, sourceHash);
        return {
          sourceRepoRoot: sourceRepo,
          shadowRepoRoot: shadowRepoPath,
          shadowRootSources,
        };
      });
    });
}

function extendedLocalRoots(
  sourceRepo: string,
  initialFiles: Set<string>,
): Observable<Set<string>> {
  return hgIgnores(
    sourceRepo,
    pathSetOfFiles(initialFiles),
  ).map(hgignoreFiles => setUnion(initialFiles, hgignoreFiles));
}

function makeChangeSummary(
  sourceRepo: string,
  shadowRepoPath: string,
  rootFiles: Set<string>,
  clock: string,
): Observable<ChangeSummary> {
  return getChanges(sourceRepo, clock)
    .map(watchmanResult => {
      const grouppedChanges = groupAllChanges(watchmanResult);
      checkForInvariantViolations(watchmanResult.overflown, grouppedChanges);

      const newFilesForBase = setDifference(
        grouppedChanges.sourceWorkspaceChanged,
        rootFiles,
      );

      if (newFilesForBase.size !== 0) {
        debugLog('Detected new files for base:', newFilesForBase);
      }

      return {
        newFilesForBase,
        changes: grouppedChanges.sourceWorkspaceChanged,
        deletions: grouppedChanges.sourceWorkspaceDeleted,
      };
    })
    .switchMap(changeSummary => {
      // $FlowIgnore - flow does not understand that .mapping to a set is not .mapping to its elements
      return retainOnlyNonExisting(
        shadowRepoPath,
        changeSummary.newFilesForBase,
      ).map(newFilesForBase => {
        return {
          newFilesForBase,
          changes: changeSummary.changes,
          deletions: changeSummary.deletions,
        };
      });
    })
    .switchMap(changeSummary => {
      return hgIgnores(
        sourceRepo,
        pathSetOfFiles(changeSummary.newFilesForBase),
      )
        .map(hgIgnoreFiles => setDifference(hgIgnoreFiles, rootFiles))
        .map(newHgIgnores => {
          if (newHgIgnores.size !== 0) {
            debugLog('Detected new .hgignore files for base:', newHgIgnores);
          }

          return {
            ...changeSummary,
            newFilesForBase: setUnion(
              changeSummary.newFilesForBase,
              newHgIgnores,
            ),
          };
        });
    });
}

function retainOnlyNonExisting(
  shadowRepoPath: string,
  files: Set<string>,
): Observable<string> {
  const arrFiles = Array.from(files);
  return Observable.defer(() =>
    Promise.all(arrFiles.map(fsPromise.exists)),
  ).map(arrExists => {
    const filesThatDoNotExist: Set<string> = new Set();

    arrExists.forEach((exists, index) => {
      if (!exists) {
        filesThatDoNotExist.add(arrFiles[index]);
      }
    });

    // $FlowIgnore - flow does not understand that .mapping to a set is not .mapping to its elements
    return filesThatDoNotExist;
  });
}

function makeTrackedSyncSummary(
  sourceRepo: string,
  clock: string,
): Observable<{
  changes: Set<string>,
  deletions: Set<string>,
  toTouchIfPresent: Set<string>,
}> {
  return getChanges(sourceRepo, clock).map(watchmanResult => {
    const filterOutHg = iterable =>
      filterIterable(iterable, name => !name.startsWith('.hg'));
    const filterToHg = iterable =>
      filterIterable(iterable, name => name.startsWith('.hg'));
    const changes = new Set(
      concatIterators(
        filterOutHg(watchmanResult.filesAdded),
        filterOutHg(watchmanResult.filesModified),
      ),
    );

    const toTouchIfPresent = new Set(
      concatIterators(
        filterToHg(watchmanResult.filesAdded),
        filterToHg(watchmanResult.filesModified),
      ),
    );

    const deletions = new Set(filterOutHg(watchmanResult.filesDeleted));
    return {changes, deletions, toTouchIfPresent};
  });
}

function checkForInvariantViolations(
  overflown: boolean,
  grouppedChanges: GrouppedChanges,
): void {
  if (overflown) {
    // Watchman has lost track of the changes we need to fall back to `hg status` in this case
    // but at the moment we'll just error out

    throw new Error('Watchman has overflown - bets are off');
  }

  if (grouppedChanges.sourceHg.size !== 0) {
    // May signal a problem! In the mean time, while we don't have a complete wrapping, we'll just
    // print
    debugLog(
      'Detected unexpected changes in source .hg!' +
        Array.from(grouppedChanges.sourceHg).join(', '),
    );
  }
}

function groupAllChanges(watchmanResult: WatchmanResult): GrouppedChanges {
  const sourceWorkspaceChanged = new Set();
  const sourceWorkspaceDeleted = new Set();
  const sourceHg = new Set();

  const classifyAndSet = (fileName, wasDeleted) => {
    if (fileName.startsWith('.hg')) {
      sourceHg.add(fileName);
    } else {
      sourceWorkspaceChanged.add(fileName);
      if (wasDeleted) {
        sourceWorkspaceDeleted.add(fileName);
      }
    }
  };

  watchmanResult.filesAdded.forEach(f => classifyAndSet(f, false));
  watchmanResult.filesDeleted.forEach(f => classifyAndSet(f, true));
  watchmanResult.filesModified.forEach(f => classifyAndSet(f, false));

  return {
    sourceWorkspaceChanged,
    sourceWorkspaceDeleted,
    sourceHg,
  };
}

function manageTargetState(
  targetRepo: string,
  changeSummary: ChangeSummary,
  isTargetDirty: boolean,
): {preAdd: Observable<empty>, postAdd: Observable<empty>} {
  if (!isTargetDirty || changeSummary.newFilesForBase.size === 0) {
    return {preAdd: Observable.empty(), postAdd: Observable.empty()};
  }

  return {preAdd: shelve(targetRepo), postAdd: unshelve(targetRepo)};
}

function makeAddFiles(
  sourceRepo: string,
  shadowRepoPath: string,
  changeSummary: ChangeSummary,
  sourceHash: string,
  shadowSubtree: Subtree,
): {addFiles: Observable<empty>, shadowRootHash: Observable<string>} {
  let newShadowRootHash = shadowSubtree.root.hash;
  const shadowRootHash = Observable.defer(() =>
    Observable.of(newShadowRootHash),
  );

  if (changeSummary.newFilesForBase.size === 0) {
    return {addFiles: Observable.empty(), shadowRootHash};
  }

  let updateToShadowRoot = Observable.empty();
  let updateBackToCurrent = Observable.empty();
  if (shadowSubtree.currentCommit !== shadowSubtree.root) {
    const currentSubtreePath = getPathToCurrent(shadowSubtree);
    updateToShadowRoot = update(shadowRepoPath, shadowSubtree.root.hash);
    updateBackToCurrent = getSubtree(shadowRepoPath).switchMap(newSubtree => {
      const restoredCurrent = getByPath(newSubtree, currentSubtreePath);

      return update(shadowRepoPath, restoredCurrent.hash);
    });
  }

  const childrenCopy = shadowSubtree.root.children.slice();

  const dirnames = new Set();
  changeSummary.newFilesForBase.forEach(fileName =>
    dirnames.add(resolve(shadowRepoPath, dirname(fileName))),
  );

  debugLog('Will create directories:', dirnames);

  const makeDirsForNewFiles = Observable.from(dirnames)
    .switchMap(fsPromise.mkdirp)
    .ignoreElements();

  const importNewFiles = copyByCat(
    sourceRepo,
    sourceHash,
    relative(sourceRepo, shadowRepoPath),
    changeSummary.newFilesForBase,
  )
    .concat(add(shadowRepoPath, '.'))
    .concat(setPhase(shadowRepoPath, 'draft', '.'))
    .concat(amend(shadowRepoPath))
    .concat(setPhase(shadowRepoPath, 'public', '.'))
    .concat(
      getCurrentRevisionHash(shadowRepoPath)
        .do(hash => (newShadowRootHash = hash))
        .ignoreElements(),
    )
    .concat(
      Observable.from(childrenCopy).concatMap(commit =>
        rebase(shadowRepoPath, commit.hash, newShadowRootHash),
      ),
    );

  return {
    addFiles: Observable.concat(
      updateToShadowRoot,
      makeDirsForNewFiles,
      importNewFiles,
      updateBackToCurrent,
    ),
    shadowRootHash,
  };
}

function makeSyncFiles(
  sourceRepo: string,
  targetRepo: string,
  changes: Set<string>,
  deletions: Set<string>,
  toTouchIfPresent: Set<string>,
): Observable<empty> {
  const copy = Observable.from(changes)
    .mergeMap(async name => {
      const exists = await fsPromise.exists(resolve(sourceRepo, name));
      if (exists) {
        return fsPromise.copy(
          resolve(sourceRepo, name),
          resolve(targetRepo, name),
        );
      }
    })
    .ignoreElements();

  const unlink = Observable.from(deletions)
    .mergeMap(async name => {
      const exists = await fsPromise.exists(resolve(targetRepo, name));
      if (exists) {
        return fsPromise.unlink(resolve(targetRepo, name));
      }
    })
    .ignoreElements();

  const touch = Observable.from(toTouchIfPresent)
    .mergeMap(async name => {
      const exists = await fsPromise.exists(resolve(targetRepo, name));
      if (exists) {
        return spawn('touch', [resolve(targetRepo, name)], {
          stdio: 'inherit',
          cwd: targetRepo,
        }).toPromise();
      }
    })
    .ignoreElements();

  return Observable.merge(copy, unlink, touch);
}
