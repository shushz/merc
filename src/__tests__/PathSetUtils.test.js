/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

/* eslint-env jest */

import {pathSetOfFiles} from '../PathSetUtils';

describe('pathSetOfFiles', () => {
  test('it produces the union of parent paths', () => {
    const fileNames = new Set([
      'aaa/bbb/ccc/ddd/file1.txt',
      'aaa/file2.txt',
      'eee/fff/ggg/file3.txt',
    ]);

    const pathSet = pathSetOfFiles(fileNames);
    const expected = new Set([
      '.',
      'aaa',
      'aaa/bbb',
      'aaa/bbb/ccc',
      'aaa/bbb/ccc/ddd',
      'eee',
      'eee/fff',
      'eee/fff/ggg',
    ]);

    expect(pathSet.size).toBe(expected.size);

    pathSet.forEach(path => {
      expect(expected.has(path)).toBe(true);
    });
  });
});
