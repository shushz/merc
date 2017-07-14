/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

import {Observable} from 'rxjs';
import {resolve} from 'path';
import fsPromise from 'nuclide-commons/fsPromise';
import {pathSetOfFiles} from './PathSetUtils';
import {
  add,
  commit,
  getCurrentRevisionHash,
  initRepo,
  setPhase,
} from './HgUtils';

export function getShadowRepoRoot(repoRoot: string): string {
  return resolve(repoRoot, '.hg', 'merc');
}

export function initShadowRepo(
  repoPath: string,
  baseFiles: Set<string>,
): Observable<string> {
  const shadowRoot = getShadowRepoRoot(repoPath);
  const paths = pathSetOfFiles(baseFiles);

  return initRepo(shadowRoot)
    .concat(copyIfExists(repoPath, shadowRoot, resolve('.hg', 'hgrc')))
    .concat(mkDirs(shadowRoot, paths))
    .concat(copyHgIgnores(repoPath, shadowRoot, paths))
    .concat(makePublicCommit(shadowRoot, 'Initial commit'))
    .concat(copyBaseFiles(repoPath, shadowRoot, baseFiles))
    .concat(makePublicCommit(shadowRoot, 'MergeBase commit'))
    .ignoreElements()
    .concat(Observable.of(shadowRoot));
}

function copyIfExists(
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

function copyHgIgnores(
  sourceRepo: string,
  targetRepo: string,
  paths: Set<string>,
): Observable<empty> {
  return hgIgnores(sourceRepo, paths)
    .switchMap(ignores => {
      if (ignores.size === 0) {
        return fsPromise.writeFile(resolve(targetRepo, '.hgignore'), '');
      }

      return Observable.from(ignores).mergeMap(name =>
        copyIfExists(sourceRepo, targetRepo, name),
      );
    })
    .ignoreElements();
}

function hgIgnores(root: string, paths: Set<string>): Observable<Set<string>> {
  return Observable.from(paths)
    .mergeMap(async path => {
      const name = resolve(path, '.hgignore');
      const exists = await fsPromise.exists(resolve(root, name));
      return {name, exists};
    })
    .filter(entry => entry.exists)
    .map(entry => entry.name)
    .reduce((set, name) => new Set([...set, name]), new Set());
}

function mkDirs(root: string, paths: Set<string>): Observable<empty> {
  return Observable.from(paths)
    .concatMap(path => {
      const pathToCreate = resolve(root, path);
      return fsPromise.mkdirp(pathToCreate);
    })
    .ignoreElements();
}

function makePublicCommit(root: string, message: string): Observable<empty> {
  return add(root, '.')
    .concat(commit(root, message))
    .ignoreElements()
    .concat(getCurrentRevisionHash(root))
    .switchMap(hash => setPhase(root, 'public', hash))
    .ignoreElements();
}

function copyBaseFiles(
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
    .mergeMap(name => copyIfExists(sourceRepo, targetRepo, name))
    .ignoreElements();
}
