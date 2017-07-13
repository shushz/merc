/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

/* eslint-env jest */

import path from 'path';
import {getRepoRoot, getCurrentRevisionHash} from '../hgutils';

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
    expect(hash).toBe('157d5e0a87bea71b07d2122abee0178585f17648');
  });
});
