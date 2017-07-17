/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

import {Observable} from 'rxjs';
import {basename, join, resolve} from 'path';
import {homedir} from 'os';
import fsPromise from 'nuclide-commons/fsPromise';
import {pathSetOfFiles} from './PathSetUtils';
import {
  add,
  commit,
  getCurrentRevisionHash,
  initRepo,
  setPhase,
} from './HgUtils';
import debugLog from './debugLog';

export function getShadowRepoRoot(repoRoot: string): string {
  return resolve(homedir(), '.merc', basename(repoRoot));
}

export function initShadowRepo(
  repoPath: string,
  baseFiles: Set<string>,
): Observable<string> {
  const shadowRoot = getShadowRepoRoot(repoPath);
  debugLog('The shadow repo path for', repoPath, 'is', shadowRoot);
  const paths = pathSetOfFiles(baseFiles);
  debugLog('The path set of base files is', paths);

  return initRepo(shadowRoot)
    .concat(copyIfExists(repoPath, shadowRoot, join('.hg', 'hgrc')))
    .concat(mkDirs(shadowRoot, paths))
    .concat(writeDefaultFiles(shadowRoot))
    .concat(makePublicCommit(shadowRoot, 'Initial commit'))
    .concat(copyHgIgnores(repoPath, shadowRoot, paths))
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
        debugLog(sourceFileName, 'EXISTS, copying to', destFileName);
        return fsPromise.copy(sourceFileName, destFileName);
      }
      return Observable.empty();
    })
    .ignoreElements();
}

function writeDefaultFiles(targetRepo: string): Observable<empty> {
  return Observable.defer(() =>
    // $FlowIgnore - merge on polymorphic types
    Observable.merge(
      fsPromise.writeFile(resolve(targetRepo, '.hgignore'), ''),
      fsPromise.writeFile(resolve(targetRepo, '.arcconfig'), ''),
    ),
  ).ignoreElements();
}

function copyHgIgnores(
  sourceRepo: string,
  targetRepo: string,
  paths: Set<string>,
): Observable<empty> {
  return hgIgnores(sourceRepo, paths)
    .switchMap(ignores => {
      debugLog('Copying .hgignore files', ignores);
      return Observable.from(ignores).mergeMap(name =>
        copyIfExists(sourceRepo, targetRepo, name),
      );
    })
    .ignoreElements();
}

export function hgIgnores(
  root: string,
  paths: Set<string>,
): Observable<Set<string>> {
  return Observable.from(paths)
    .mergeMap(async path => {
      const name = join(path, '.hgignore');
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
  debugLog('Copying base files:', baseFiles);
  // In case we are in an empty branch, default to at least one files that's likely to exist
  if (files.size === 0) {
    files.add('.arcconfig');
  }

  return Observable.from(files)
    .mergeMap(name => copyIfExists(sourceRepo, targetRepo, name))
    .ignoreElements();
}
