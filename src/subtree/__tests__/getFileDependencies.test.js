/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

/* eslint-env jest */

import path from 'path';
import getFileDependencies from '../getFileDependencies';
import getSubtree from '../getSubtree';

test('getFileDependencies', async () => {
  const repoRoot = path.resolve(__dirname, '../../__tests__/fixtures/repo3');
  const tree = await getSubtree(repoRoot).toPromise();
  expect(Array.from(getFileDependencies(tree))).toEqual([
    'files/file.txt',
    'files/file2.txt',
    'files/file3.txt',
  ]);
});
