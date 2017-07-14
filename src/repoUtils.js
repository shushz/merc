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

import {Observable} from 'rxjs';
import {resolve} from 'path';
import fsPromise from 'nuclide-commons/fsPromise';
import {pathSetOfFiles} from './pathSetUtils';
import {
  add,
  commit,
  getCurrentRevisionHash,
  initRepo,
  setPhase,
} from './hgUtils';

export function initShadowRepo(
  repoPath: string,
  baseFiles: Set<string>,
): Observable<string> {
  const shadowRoot = resolve(repoPath, '.hg', 'merc');
  const paths = pathSetOfFiles(baseFiles);

  return initRepo(shadowRoot)
    .concat(_copyIfExists(repoPath, shadowRoot, resolve('.hg', 'hgrc')))
    .concat(_mkDirs(shadowRoot, paths))
    .concat(_copyHgIgnores(repoPath, shadowRoot, paths))
    .concat(_makePublicCommit(shadowRoot, 'Initial commit'))
    .concat(_copyBaseFiles(repoPath, shadowRoot, baseFiles))
    .concat(_makePublicCommit(shadowRoot, 'MergeBase commit'))
    .ignoreElements()
    .concat(Observable.of(shadowRoot));
}

function _copyIfExists(
  sourceRepo: string,
  targetRepo: string,
  name: string,
): Observable<empty> {
  const sourceFileName = resolve(sourceRepo, name);
  const destFileName = resolve(targetRepo, name);
  return Observable.defer(() => fsPromise.exists(sourceFileName))
    .switchMap(exists => {
      if (exists) {
        return fsPromise.copy(sourceFileName, destFileName);
      }
      return Observable.empty();
    })
    .ignoreElements();
}

function _copyHgIgnores(
  sourceRepo: string,
  targetRepo: string,
  paths: Set<string>,
): Observable<empty> {
  return _hgIgnores(sourceRepo, paths)
    .switchMap(hgIgnores => {
      if (hgIgnores.size === 0) {
        return fsPromise.writeFile(resolve(targetRepo, '.hgignore'), '');
      }

      return Observable.from(hgIgnores).mergeMap(name =>
        _copyIfExists(sourceRepo, targetRepo, name),
      );
    })
    .ignoreElements();
}

function _hgIgnores(root: string, paths: Set<string>): Observable<Set<string>> {
  return Observable.from(paths)
    .mergeMap(async path => {
      const name = resolve(path, '.hgignore');
      const exists = await fsPromise.exists(resolve(root, name));
      return {name, exists};
    })
    .filter(entry => entry.exists)
    .map(entry => entry.name)
    .reduce((set, name) => {
      const copy = new Set(set);
      copy.add(name);
      return copy;
    }, new Set());
}

function _mkDirs(root: string, paths: Set<string>): Observable<empty> {
  return Observable.from(paths)
    .concatMap(path => {
      const pathToCreate = resolve(root, path);
      return fsPromise.mkdirp(pathToCreate);
    })
    .ignoreElements();
}

function _makePublicCommit(root: string, message: string): Observable<empty> {
  return add(root, '.')
    .concat(commit(root, message))
    .concat(
      getCurrentRevisionHash(root).switchMap(hash =>
        setPhase(root, 'public', hash),
      ),
    )
    .ignoreElements();
}

function _copyBaseFiles(
  sourceRepo: string,
  targetRepo: string,
  baseFiles: Set<string>,
): Observable<empty> {
  const files = new Set(baseFiles);
  // In case we are in an empty branch, default to at least one files that's likely to exist
  if (files.size === 0) {
    files.add('.arcconfig');
  }

  return Observable.from(files)
    .mergeMap(name => _copyIfExists(sourceRepo, targetRepo, name))
    .ignoreElements();
}
