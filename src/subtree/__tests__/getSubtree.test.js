/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

/* eslint-env jest */

import fsPromise from 'nuclide-commons/fsPromise';
import path from 'path';
import {
  default as getSubtree,
  _buildTree,
  _getSubtreeCommitList,
  _parseSubtreeCommitList,
} from '../getSubtree';

describe('_getSubtreeCommitList', () => {
  test('it returns a list of commits with metadata', async () => {
    const repoRoot = path.resolve(__dirname, '../../__tests__/fixtures/repo2');
    const list = await _getSubtreeCommitList(repoRoot).toPromise();
    expect(list).toMatchSnapshot();
  });
});

describe('_parseSubtreeCommitList', () => {
  test('it returns a set of commits', async () => {
    const listPath = path.resolve(
      __dirname,
      '../../__tests__/fixtures/subtree-list.txt',
    );
    const list = (await fsPromise.readFile(listPath)).toString();
    expect(_parseSubtreeCommitList(list)).toMatchSnapshot();
  });
});

test('_buildTree', () => {
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
  expect(root.hash).toBe('c42dae43c973a141cf0f15d9bcb6f32093e1c1d2');
  expect(root.parent).toBe(null);
  expect(root.children.length).toBe(1);
  expect(root.children[0].parent).toBe(root);
  expect(root.children[0].children.length).toBe(2);
  expect(root.children[0].children.map(child => child.hash)).toEqual([
    '6cc8d78c03a1ec393229a4d93fd013ca68baf2d7',
    '19e0c8a7e1c0ff0099e0c642ea99cdba36e36923',
  ]);
  expect(root.children[0].children.map(child => child.parent)).toEqual([
    root.children[0],
    root.children[0],
  ]);
});

test('getSubtree', async () => {
  const repoRoot = path.resolve(__dirname, '../../__tests__/fixtures/repo2');
  const subtree = await getSubtree(repoRoot).toPromise();
  expect(subtree.root).toMatchSnapshot();
});
