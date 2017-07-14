/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

import type {AppState, InitializedAppState, SerializedAppState} from './types';

import {getRepoRoot, isDirty} from './HgUtils';
import {getShadowRepoRoot} from './RepoUtils';
import invariant from 'assert';
import getSubtree from './subtree/getSubtree';
import fsPromise from 'nuclide-commons/fsPromise';
import path from 'path';
import {Observable} from 'rxjs';

/**
 * Examine the repo and return the current state.
 */
export function getInitialAppState(
  expectInitialized: boolean = true,
): Observable<AppState> {
  return getRepoRoot()
    .switchMap(repoRoot => {
      const shadowRepoRoot = getShadowRepoRoot(repoRoot);
      return loadSerializedState(shadowRepoRoot).map(serialized => ({
        serialized,
        repoRoot,
        shadowRepoRoot,
      }));
    })
    .switchMap(({serialized, repoRoot, shadowRepoRoot}) => {
      if (serialized == null) {
        // The repo hasn't been initialized yet.
        if (expectInitialized) {
          throw new Error("Repo hasn't been initialized yet!");
        }
        return Observable.of({
          initialized: false,
          wClock: null,
          sourceRepoRoot: repoRoot,
          shadowRepoRoot,
          shadowSubtree: null,
          shadowRootSources: null,
        });
      }

      if (!expectInitialized) {
        throw new Error('Repo was already initialized!');
      }

      return Observable.forkJoin(
        getSubtree(shadowRepoRoot),
        isDirty(shadowRepoRoot),
        (shadowSubtree, shadowIsDirty) => ({
          initialized: true,
          wClock: serialized.wClock,
          sourceRepoRoot: repoRoot,
          shadowRepoRoot,
          shadowSubtree,
          shadowIsDirty,
          shadowRootSources: new Map(serialized.shadowRootSources),
        }),
      );
    });
}

function loadSerializedState(
  shadowRepoRoot: string,
): Observable<?SerializedAppState> {
  const serializationPath = getSerializationPath(shadowRepoRoot);
  return Observable.defer(() => fsPromise.readFile(serializationPath))
    .map(buffer => buffer.toString())
    .catch(err => {
      if (err.code === 'ENOENT') {
        return Observable.of(null);
      }
      throw err;
    })
    .map(contents => {
      if (contents == null) {
        return null;
      }
      const serialized = JSON.parse(contents);
      invariant(serialized != null);
      invariant(typeof serialized.wClock === 'string');
      invariant(serialized.shadowRootSources instanceof Map);
      return serialized;
    });
}

export function saveState(state: InitializedAppState): Observable<empty> {
  const {shadowRepoRoot} = state;
  const serializationPath = getSerializationPath(shadowRepoRoot);
  const serialized = serialize(state);
  return Observable.defer(() =>
    fsPromise.writeFile(serializationPath, JSON.stringify(serialized)),
  ).ignoreElements();
}

function serialize(state: InitializedAppState): SerializedAppState {
  return {
    wClock: state.wClock,
    shadowRootSources: [...state.shadowRootSources],
  };
}

function getSerializationPath(shadowRepoRoot: string): string {
  return path.join(shadowRepoRoot, '.mercstate.json');
}
