/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

export type RepoState = {
  currentRev: string,
  isDirty: ?boolean,
};

export type FileStatus = 'modified' | 'added' | 'deleted';

export type CommitPhase = 'draft' | 'public';

export type Copy = {source: string, dest: string};

export type AppState = {
  mainRepoPath: ?string,
  wClock: ?string,
  mainRepoState: ?RepoState,
  shadowRepoState: ?RepoState,
  branches: Array<CommitNode>,
};

export type RawCommitNode = {|
  hash: string,
  parentHash: ?string,
  isCurrentRevision: boolean,
  phase: CommitPhase,
  addedFiles: Set<string>,
  copiedFiles: Set<Copy>,
  modifiedFiles: Set<string>,
  deletedFiles: Set<string>,
|};

export type CommitNode = {|
  hash: string,
  isCurrentRevision: boolean,
  phase: CommitPhase,
  addedFiles: Set<string>,
  copiedFiles: Set<Copy>,
  modifiedFiles: Set<string>,
  deletedFiles: Set<string>,

  parent: ?CommitNode,
  children: Array<CommitNode>,
|};

export type ShadowCommitNode = {|
  hash: string,
  isCurrentRevision: boolean,
  phase: CommitPhase,
  addedFiles: Set<string>,
  copiedFiles: Set<Copy>,
  modifiedFiles: Set<string>,
  deletedFiles: Set<string>,
  parent: ?ShadowCommitNode,
  children: Array<ShadowCommitNode>,

  sourceHash: string,
|};
