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

console.log('Hello from merc');

import yargs from 'yargs';

yargs
  .usage('$0 <cmd> [args]')
  .command('break', 'Start managing current branch with merc', argv => {
    console.log('Breaking stuff');
  })
  .help().argv;
