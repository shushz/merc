/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

import type {CommitNode} from './types';

export default function getFileDependencies(tree: CommitNode): Set<string> {
  if (tree.children.length === 0) {
    return getImmediateDependencies(tree);
  }
  const childDeps = new Set();
  tree.children.forEach(child => {
    getFileDependencies(child).forEach(dep => {
      childDeps.add(dep);
    });
  });
  return resolve(tree, childDeps);
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

  return new Set([...getImmediateDependencies(parent), ...resolved]);
}
