/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

import {Client} from 'fb-watchman';
import {Observable, ReplaySubject} from 'rxjs';

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
    .switchMap(() => runCommand(['clock', repoRoot]))
    .map(response => ((response: any): WatchmanClockResponse).clock);
}

export function getChanges(
  path: string,
  sinceClock: string,
): Observable<WatchmanResult> {
  return runCommand([
    'query',
    path,
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
      if (file.new) {
        if (file.exists) {
          filesAdded.add(file.name);
        }
      } else if (file.exists) {
        filesModified.add(file.name);
      } else {
        filesDeleted.add(file.name);
      }
    });

    return {clock, overflown, filesAdded, filesDeleted, filesModified};
  });
}

export function endWatchman(): void {
  client.end();
}

function runCommand(args: Array<mixed>): Observable<Object> {
  return Observable.create(observer => {
    client.command(args, (err, response) => {
      if (err != null) {
        observer.error(err);
        return;
      }
      observer.next(response);
      observer.complete();
    });
  }).multicast(() => new ReplaySubject(1));
}
