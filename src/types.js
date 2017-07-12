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

export type RepoState = {
  currentRev: string,
  isDirty: ?boolean,
};

export type FileStatus = 'modified' | 'added' | 'deleted';

export type MercBranch = {
  mainRev: ?string,
  mainParent: ?string,
  shadowRev: ?string,
  shadowParent: ?string,
  files: Map<string, FileStatus>,
};

export type AppState = {
  mainRepoPath: ?string,
  wClock: ?string,
  mainRepoState: ?RepoState,
  shadowRepoState: ?RepoState,
  branches: Array<MercBranch>,
};
