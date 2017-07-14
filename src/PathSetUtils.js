/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
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
