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
  _buildTree,
  getRepoRoot,
  getCurrentRevisionHash,
  getMergeBaseHash,
  getSubtree,
  _getSubtreeCommitList,
  _parseSubtreeCommitList,
} from '../HgUtils';

describe('getRepoRoot', () => {
  test('it reports the root', async () => {
    const repoRoot = path.resolve(__dirname, './fixtures/repo1');
    const dir = path.join(repoRoot, 'a/b');
    const actual = await getRepoRoot(dir).toPromise();
    expect(actual).toBe(repoRoot);
  });

  test("it returns null when there's no repo", async () => {
    const dir = path.resolve(__dirname, './fixtures/not-a-repo/a/b');
    const actual = await getRepoRoot(dir).toPromise();
    expect(actual).toBe(null);
  });
});

describe('getCurrentRevisionHash', () => {
  test('it returns the current revision hash', async () => {
    const repoRoot = path.resolve(__dirname, './fixtures/repo2');
    const hash = await getCurrentRevisionHash(repoRoot).toPromise();
    expect(hash).toMatchSnapshot();
  });
});

describe('getMergeBaseHash', () => {
  test('it returns the current revision hash', async () => {
    const repoRoot = path.resolve(__dirname, './fixtures/repo2');
    const hash = await getMergeBaseHash(repoRoot).toPromise();
    expect(hash).toMatchSnapshot();
  });
});

describe('_getSubtreeCommitList', () => {
  test('it returns a list of commits with metadata', async () => {
    const repoRoot = path.resolve(__dirname, './fixtures/repo2');
    const list = await _getSubtreeCommitList(repoRoot).toPromise();
    expect(list).toMatchSnapshot();
  });
});

describe('_parseSubtreeCommitList', () => {
  test('it returns a set of commits', async () => {
    const listPath = path.resolve(__dirname, './fixtures/subtree-list.txt');
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
  const root = _buildTree(rawNodes);
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
  const repoRoot = path.resolve(__dirname, './fixtures/repo2');
  const subtree = await getSubtree(repoRoot).toPromise();
  expect(subtree).toMatchSnapshot();
});
