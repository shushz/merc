/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

type Node = {
  children: Array<self>,
};

export function* dfs<T: Node>(tree: T): Generator<T, void, void> {
  yield tree;
  for (const child of tree.children) {
    yield* dfs(child);
  }
}
