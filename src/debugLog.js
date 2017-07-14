/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

export default function debugLog(...args: Array<any>): void {
  if (process.env.DEBUG) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
}
