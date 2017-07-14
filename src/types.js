/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

export type FileStatus = 'modified' | 'added' | 'deleted';

export type CommitPhase = 'draft' | 'public';

export type Copy = {source: string, dest: string};

export type UninitializedAppState = {|
  // `break` hasn't been run yet. There's no shadow repo.
  initialized: false,

  wClock: null,

  sourceRepoRoot: string,

  shadowRepoRoot: string,
  shadowSubtree: null,

  shadowRootSources: null,
|};

export type InitializedAppState = {|
  // `break` has been run for this repo.
  initialized: true,

  wClock: string,

  sourceRepoRoot: string,

  // Info about the current shadow root.
  shadowRepoRoot: string,
  shadowSubtree: Subtree,
  shadowIsDirty: boolean,

  // A map from the hashes of all shadow roots to their source commits.
  shadowRootSources: Map<string, string>,
|};

export type AppState = UninitializedAppState | InitializedAppState;

export type SerializedAppState = {|
  wClock: string,
  shadowRootSources: Array<[string, string]>,
|};

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
  phase: CommitPhase,
  addedFiles: Set<string>,
  copiedFiles: Set<Copy>,
  modifiedFiles: Set<string>,
  deletedFiles: Set<string>,

  parent: ?CommitNode,
  children: Array<CommitNode>,
|};

export type Subtree = {|
  root: CommitNode,
  initialFiles: Set<string>,
  currentCommit: CommitNode,
|};
