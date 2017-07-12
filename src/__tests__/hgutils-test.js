/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

/* eslint-env jest */

import path from 'path';
import {getRepoRoot} from '../hgutils';

test('has test', async () => {
  const repoRoot = path.resolve(__dirname, './fixtures/repo1');
  const dir = path.join(repoRoot, 'a/b');
  const actual = await getRepoRoot(dir).toPromise();
  expect(actual).toBe(repoRoot);
});
