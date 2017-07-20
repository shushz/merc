/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

import debugLog from './debugLog';
import {Client} from 'fb-watchman';
import {Observable} from 'rxjs';
import {resolve, relative} from 'path';
import fsPromise from 'nuclide-commons/fsPromise';

const client = new Client();

type WatchmanClockResponse = {|
  clock: string,
|};

// type FileStat = {|
//   new: boolean,
//   exists: boolean,
//   name: string,
// |};

// type WatchmanSinceReponse = {|
//   is_fresh_instance: boolean,
//   clock: string,
//   files: Array<FileStat>,
// |};

export type WatchmanResult = {|
  clock: string,
  overflown: boolean,

  // Note that filesAdded can in fact contain files that were just modified from `hg` point of view
  // this is because should a file be deleted and then recreated Watchman will report it as new
  filesAdded: Set<string>,
  filesDeleted: Set<string>,
  filesModified: Set<string>,
|};

export function getClock(repoRoot: string): Observable<string> {
  // Start watching the project, if it isn't already.
  return runCommand(['watch-project', repoRoot])
    .switchMap(response => runCommand(['clock', response.watch]))
    .map(response => ((response: any): WatchmanClockResponse).clock);
}

export function getClockVerify(
  repoRoot: string,
  shadowRepo: string,
): Observable<string> {
  const fileName = '__some__very__arbitrary__file__name__';
  const testFile = resolve(shadowRepo, fileName);
  return runCommand(['watch-project', shadowRepo]).switchMap(response => {
    return subscribe(response.watch, fileName)
      .switchMap(obs =>
        // $FlowIgnore
        Observable.merge(
          obs,
          Observable.defer(() =>
            fsPromise.writeFile(testFile, ''),
          ).ignoreElements(),
        ),
      )
      .filter(res => {
        const testedFile = res.files.find(file => file.name === fileName);
        if (testedFile != null && testedFile.exists) {
          fsPromise.unlink(testFile);
        }
        return testedFile != null && testedFile.exists === false;
      })
      .switchMap(() => getClock(repoRoot))
      .take(1)
      .switchMap(clock => {
        return runCommand([
          'unsubscribe',
          response.watch,
          'verifySubscription',
        ]).mapTo(clock);
      });
  });
}

function subscribe(
  watch: string,
  fileName: string,
): Observable<Observable<WatchmanResult>> {
  const sub = {
    expression: ['name', fileName],
    fields: ['exists', 'name', 'oclock'],
  };

  return runCommand(['subscribe', watch, 'verifySubscription', sub]).map(() => {
    return Observable.fromEventPattern(
      handler => {
        client.on('subscription', handler);
      },
      handler => {},
    );
  });
}

export function getChanges(
  path: string,
  sinceClock: string,
): Observable<WatchmanResult> {
  return runCommand(['watch-project', path])
    .map(response => response.watch)
    .switchMap(watchDir =>
      runCommand([
        'query',
        watchDir,
        {
          since: sinceClock,
          expression: ['type', 'f'],
          fields: ['new', 'exists', 'name'],
          empty_on_fresh_instance: true,
        },
      ]).map(response => {
        const clock = response.clock;
        const overflown = response.is_fresh_instance;

        const filesAdded = new Set();
        const filesDeleted = new Set();
        const filesModified = new Set();

        response.files.forEach(file => {
          const absolutePath = resolve(watchDir, file.name);

          if (!absolutePath.startsWith(path)) {
            return;
          }

          const name = relative(path, absolutePath);
          if (file.new) {
            if (file.exists) {
              filesAdded.add(name);
            }
          } else if (file.exists) {
            filesModified.add(name);
          } else {
            filesDeleted.add(name);
          }
        });

        return {clock, overflown, filesAdded, filesDeleted, filesModified};
      }),
    );
}

export function endWatchman(): void {
  client.end();
}

function runCommand(args: Array<mixed>): Observable<Object> {
  return Observable.create(observer => {
    debugLog('watchman', args);
    client.command(args, (err, response) => {
      if (err != null) {
        observer.error(err);
        return;
      }
      observer.next(response);
      observer.complete();
    });
  });
}
