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

export type CommitPhase = 'draft' | 'public';

export type MercBranch = {
  mainRev: ?string,
  mainParent: ?MercBranch,
  shadowRev: ?string,
  shadowParent: ?string,
  addedFiles: Set<string>,
  copiedFiles: Set<string>,
  modifiedFiles: Set<string>,
  deletedFiles: Set<string>,
  children: Array<MercBranch>,
};

export type AppState = {
  mainRepoPath: ?string,
  wClock: ?string,
  mainRepoState: ?RepoState,
  shadowRepoState: ?RepoState,
  branches: Array<MercBranch>,
};

export type RawNode = {|
  hash: string,
  parentHash: ?string,
  isCurrentRevision: boolean,
  phase: CommitPhase,
  addedFiles: Set<string>,
  copiedFiles: Set<string>,
  modifiedFiles: Set<string>,
  deletedFiles: Set<string>,
|};

export type Node = {|
  hash: string,
  parentHash: ?string,
  isCurrentRevision: boolean,
  phase: CommitPhase,
  addedFiles: Set<string>,
  copiedFiles: Set<string>,
  modifiedFiles: Set<string>,
  deletedFiles: Set<string>,
  parent: ?Node,
  children: Array<Node>,
|};
