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

import type {CommitNode} from './types';

function decircleNode(node: CommitNode): Object {
  const children = node.children.map(child => _decircleNode(child));
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
  const decircled = _decircleNode(node);
  console.log(JSON.stringify(decircled, null, 4));
}
