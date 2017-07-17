/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

import type {CommitNode, Subtree} from '../types';
import invariant from 'assert';

export type SubtreePath = Array<number>;

export function getPathToCurrent(subtree: Subtree): SubtreePath {
  return getPathToCurrentFromNode(subtree.currentCommit);
}

export function getPathToCurrentFromNode(node: CommitNode): SubtreePath {
  let current = node;
  const subtreePath = [];
  while (current.parent != null) {
    invariant(current);
    const myIndex = current.parent.children.indexOf(current);
    subtreePath.push(myIndex);

    current = current.parent;
  }

  subtreePath.reverse();
  return subtreePath;
}

export function getByPath(
  subtree: Subtree,
  subtreePath: SubtreePath,
): CommitNode {
  return getByPathFromRootNode(subtree.root, subtreePath);
}

export function getByPathFromRootNode(
  root: CommitNode,
  subtreePath: SubtreePath,
): CommitNode {
  let current = root;

  subtreePath.forEach(index => {
    current = current.children[index];
  });

  return current;
}
