/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

/* eslint-env jest */

import {getPathToCurrent, getByPath} from '../SubtreePath';
import {_buildTree} from '../getSubtree';

describe('getPathToCurrent', () => {
  test('it returns the expected path', () => {
    const testSubtree = buildTestSubtree();

    const path = getPathToCurrent(testSubtree);
    expect(path).toEqual([0, 1]);
  });

  test('it returns an empty array for root current node', () => {
    const testSubtree = buildTestSubtree();
    testSubtree.currentCommit = testSubtree.root;

    const path = getPathToCurrent(testSubtree);
    expect(path).toEqual([]);
  });
});

describe('getByPath', () => {
  test('it locates the proper child', () => {
    const testSubtree = buildTestSubtree();

    const current = getByPath(testSubtree, [0, 1]);
    expect(current).toEqual(testSubtree.currentCommit);
  });

  test('it returns root on an empty path', () => {
    const testSubtree = buildTestSubtree();

    const current = getByPath(testSubtree, []);
    expect(current).toEqual(testSubtree.root);
  });
});

function buildTestSubtree(): Subtree {
  const rawNodes = new Set([
    {
      addedFiles: new Set(),
      copiedFiles: new Set(),
      deletedFiles: new Set(),
      hash: '47b65c76f24ae1897b7f54dca6a2d210caf78ec5',
      isCurrentRevision: false,
      modifiedFiles: new Set(['files/file.txt']),
      parentHash: 'c42dae43c973a141cf0f15d9bcb6f32093e1c1d2',
      phase: 'draft',
    },
    {
      addedFiles: new Set(),
      copiedFiles: new Set(),
      deletedFiles: new Set(),
      hash: '6cc8d78c03a1ec393229a4d93fd013ca68baf2d7',
      isCurrentRevision: false,
      modifiedFiles: new Set(['files/file.txt']),
      parentHash: '47b65c76f24ae1897b7f54dca6a2d210caf78ec5',
      phase: 'draft',
    },
    {
      addedFiles: new Set(),
      copiedFiles: new Set(),
      deletedFiles: new Set(),
      hash: '19e0c8a7e1c0ff0099e0c642ea99cdba36e36923',
      isCurrentRevision: true,
      modifiedFiles: new Set(['files/file.txt']),
      parentHash: '47b65c76f24ae1897b7f54dca6a2d210caf78ec5',
      phase: 'draft',
    },
    {
      addedFiles: new Set(),
      copiedFiles: new Set(),
      deletedFiles: new Set(),
      hash: '260b695f01aa8d351bcda32830c174d8550cbfa1',
      isCurrentRevision: false,
      modifiedFiles: new Set(['files/file.txt']),
      parentHash: '19e0c8a7e1c0ff0099e0c642ea99cdba36e36923',
      phase: 'draft',
    },
    {
      addedFiles: new Set(['files/file.txt']),
      copiedFiles: new Set(),
      deletedFiles: new Set(),
      hash: 'c42dae43c973a141cf0f15d9bcb6f32093e1c1d2',
      isCurrentRevision: false,
      modifiedFiles: new Set(),
      parentHash: 'bf2cf6e87a72ec7062e38e695bfb1151a4f63a9e',
      phase: 'public',
    },
  ]);
  const root = _buildTree(rawNodes).root;

  const currentCommit = root.children[0].children[1];

  return {
    root,
    initialFiles: new Set(),
    currentCommit,
  };
}
