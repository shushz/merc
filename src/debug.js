/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

import type {CommitNode} from './types';

function decircleNode(node: CommitNode): Object {
  const children = node.children.map(child => decircleNode(child));
  return {
    ...node,
    children,
    addedFiles: Array.from(node.addedFiles),
    copiedFiles: Array.from(node.copiedFiles),
    modifiedFiles: Array.from(node.modifiedFiles),
    deletedFiles: Array.from(node.deletedFiles),
    parent: null,
  };
}

export function dumpSubtree(node: CommitNode): void {
  const decircled = decircleNode(node);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(decircled, null, 4));
}
