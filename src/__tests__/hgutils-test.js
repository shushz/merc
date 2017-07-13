/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

/* eslint-env jest */

import path from 'path';
import {
  getRepoRoot,
  getCurrentRevisionHash,
  getMergeBaseHash,
  _getSubtreeCommitList,
} from '../hgutils';

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
    expect(hash).toBe('19e0c8a7e1c0ff0099e0c642ea99cdba36e36923');
  });
});

describe('getMergeBaseHash', () => {
  test('it returns the current revision hash', async () => {
    const repoRoot = path.resolve(__dirname, './fixtures/repo2');
    const hash = await getMergeBaseHash(repoRoot).toPromise();
    expect(hash).toBe('c42dae43c973a141cf0f15d9bcb6f32093e1c1d2');
  });
});

describe('_getSubtreeCommitList', () => {
  test('it returns a list of commits with metadata', async () => {
    const repoRoot = path.resolve(__dirname, './fixtures/repo2');
    const list = await _getSubtreeCommitList(repoRoot).toPromise();
    expect(list).toMatchSnapshot();
  });
});
