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
} from '../HgUtils';

describe('getRepoRoot', () => {
  test('it reports the root', async () => {
    const repoRoot = path.resolve(__dirname, './fixtures/repo1');
    const dir = path.join(repoRoot, 'a/b');
    const actual = await getRepoRoot(dir).toPromise();
    expect(actual).toBe(repoRoot);
  });

  test("it throws when there's no repo", async () => {
    expect.assertions(1);
    const dir = path.resolve(__dirname, './fixtures/not-a-repo/a/b');
    try {
      await getRepoRoot(dir).toPromise();
    } catch (err) {
      expect(err.constructor.name).toBe('NotARepositoryError');
    }
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
