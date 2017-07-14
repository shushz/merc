/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

import type {CommitNode} from '../types';

const flatten = arr => [].concat(...arr);

/**
 * Determine all of the files required by the operations of a subtree.
 */
export default function getFileDependencies(tree: CommitNode): Set<string> {
  const childDeps = new Set(
    flatten(tree.children.map(getFileDependencies).map(x => Array.from(x))),
  );
  return new Set([
    ...getImmediateDependencies(tree),
    ...resolve(tree, childDeps),
  ]);
}

function getImmediateDependencies(node: CommitNode): Set<string> {
  return new Set([
    ...node.modifiedFiles,
    ...node.deletedFiles,
    ...Array.from(node.copiedFiles).map(copy => copy.source),
  ]);
}

function resolve(parent: CommitNode, files: Set<string>): Set<string> {
  const resolved = new Set(files);

  // If files were added by the parent, they aren't a dependency of that parent.
  parent.addedFiles.forEach(file => {
    resolved.delete(file);
  });

  // If a file was copied in the parent, the source is a dependency, not where it was copied to.
  parent.copiedFiles.forEach(({source, dest}) => {
    resolved.delete(dest);
    resolved.add(source);
  });

  return resolved;
}
