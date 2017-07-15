/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

let lastMessage = 0;

export default function debugLog(...args: Array<any>): void {
  if (process.env.DEBUG) {
    const now = Date.now();
    const time = now - lastMessage;
    lastMessage = now;

    // eslint-disable-next-line no-console
    console.log(`(${time})`, ...args);
  }
}
