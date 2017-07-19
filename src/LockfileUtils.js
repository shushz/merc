/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

import {homedir} from 'os';
import {resolve} from 'path';
import {Observable} from 'rxjs';
import LockFile from 'lockfile';
import fsPromise from 'nuclide-commons/fsPromise';

const MERC_DIR = resolve(homedir(), '.merc');
const LOCKFILE_NAME = resolve(MERC_DIR, 'lockfile');
const MAX_WAIT_TIME_MS = 60000;

export function lock(): Observable<empty> {
  return Observable.defer(() => fsPromise.mkdirp(MERC_DIR))
    .ignoreElements()
    .concat(
      Observable.create(observer => {
        LockFile.lock(LOCKFILE_NAME, {wait: MAX_WAIT_TIME_MS}, err => {
          if (err != null) {
            observer.error(err);
            return;
          }

          observer.complete();
        });
      }),
    );
}

export function unlock(): Observable<empty> {
  return Observable.create(observer => {
    LockFile.unlock(LOCKFILE_NAME, err => {
      if (err != null) {
        observer.error(err);
        return;
      }

      observer.complete();
    });
  });
}
