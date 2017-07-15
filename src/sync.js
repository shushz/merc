/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

import type {WatchmanResult} from './watchman';
import type {Subtree, SerializableAppState} from './types';

import {Observable} from 'rxjs';
import {getChanges} from './watchman';
import {resolve, relative} from 'path';
import debugLog from './debugLog';
import {MERC_PREFIX, hgIgnores, getShadowRepoRoot} from './RepoUtils';
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

import {setUnion, setDifference} from 'nuclide-commons/collection';
import fsPromise from 'nuclide-commons/fsPromise';

type GrouppedChanges = {
  sourceWorkspaceChanged: Set<string>,
  sourceWorkspaceDeleted: Set<string>,
  sourceHg: Set<string>,
  targetWorkspace: Set<string>,
  targetHg: Set<string>,
};

type ChangeSummary = {
  newFilesForBase: Set<string>,
  changes: Set<string>,
  deletions: Set<string>,
};

const MERC_HG_PREFIX = resolve(MERC_PREFIX, '.hg');

export function sync(
  sourceRepo: string,
  shadowSubtree: Subtree,
  sourceHash: string,
  isTargetDirty: boolean,
  clock: string,
): Observable<SerializableAppState> {
  const shadowRepoPath = getShadowRepoRoot(sourceRepo);
  return makeChangeSummary(
    sourceRepo,
    shadowSubtree.initialFiles,
    clock,
  ).switchMap(changeSummary => {
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

    const syncFiles = makeSyncFiles(sourceRepo, shadowRepoPath, changeSummary);

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

function makeChangeSummary(
  sourceRepo: string,
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

      return {
        newFilesForBase,
        changes: grouppedChanges.sourceWorkspaceChanged,
        deletions: grouppedChanges.sourceWorkspaceDeleted,
      };
    })
    .switchMap(changeSummary => {
      return hgIgnores(
        sourceRepo,
        pathSetOfFiles(changeSummary.newFilesForBase),
      )
        .map(hgIgnoreFiles => setDifference(hgIgnoreFiles, rootFiles))
        .map(newHgIgnores => {
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

  if (grouppedChanges.targetHg.size !== 0) {
    // May signal a problem! In the mean time, while we don't have a complete wrapping, we'll just
    // print
    debugLog(
      'Detected unexpected changes in target .hg!' +
        Array.from(grouppedChanges.targetHg).join(', '),
    );
  }

  if (grouppedChanges.targetWorkspace.size !== 0) {
    // May signal a problem! In the mean time, while we don't have a complete wrapping, we'll just
    // print
    debugLog(
      'Detected unexpected changes in target workspace' +
        Array.from(grouppedChanges.targetWorkspace).join(', '),
    );
  }
}

function groupAllChanges(watchmanResult: WatchmanResult): GrouppedChanges {
  const sourceWorkspaceChanged = new Set();
  const sourceWorkspaceDeleted = new Set();
  const sourceHg = new Set();
  const targetWorkspace = new Set();
  const targetHg = new Set();

  const classifyAndSet = (fileName, wasDeleted) => {
    if (fileName.startsWith(MERC_HG_PREFIX)) {
      targetHg.add(fileName);
    } else if (fileName.startsWith(MERC_PREFIX)) {
      targetWorkspace.add(fileName);
    } else if (fileName.startsWith('.hg')) {
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
    targetWorkspace,
    targetHg,
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
  childrenCopy.reverse();

  const importNewFiles = copyByCat(
    sourceRepo,
    sourceHash,
    relative(sourceRepo, shadowRepoPath),
    changeSummary.newFilesForBase,
  )
    .concat(add(shadowRepoPath, '.'))
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
      importNewFiles,
      updateBackToCurrent,
    ),
    shadowRootHash,
  };
}

function makeSyncFiles(
  sourceRepo: string,
  shadowRepoPath: string,
  changeSummary: ChangeSummary,
): Observable<empty> {
  const copy = Observable.from(changeSummary.changes)
    .mergeMap(name => {
      return fsPromise.copy(
        resolve(sourceRepo, name),
        resolve(shadowRepoPath, name),
      );
    })
    .ignoreElements();

  const unlink = Observable.from(changeSummary.deletions)
    .mergeMap(name => {
      return fsPromise.unlink(resolve(shadowRepoPath, name));
    })
    .ignoreElements();

  return Observable.merge(copy, unlink);
}
