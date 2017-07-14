/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

import {dirname} from 'path';

export function pathSetOfFiles(files: Set<string>): Set<string> {
  const combined = new Set(['.']);

  files.forEach(fileName => {
    let dir = dirname(fileName);
    while (!combined.has(dir)) {
      combined.add(dir);
      dir = dirname(dir);
    }
  });

  return combined;
}
