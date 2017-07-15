/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

import type {CommitNode, Subtree} from './types';

function prepareNode(node: CommitNode): Object {
  const prepared = {
    ...node,
    children: node.children.map(child => prepareNode(child)),
    addedFiles: Array.from(node.addedFiles),
    copiedFiles: Array.from(node.copiedFiles),
    modifiedFiles: Array.from(node.modifiedFiles),
    deletedFiles: Array.from(node.deletedFiles),
  };
  delete prepared.parent;
  return prepared;
}

export function dumpSubtree(tree: Subtree): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(prepareNode(tree.root), null, 2));
}
