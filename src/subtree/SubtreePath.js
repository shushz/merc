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
  const subtreePath = [];
  let current = subtree.currentCommit;

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
  let current = subtree.root;

  subtreePath.forEach(index => {
    current = current.children[index];
  });

  return current;
}
