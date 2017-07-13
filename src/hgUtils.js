/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

import type {ObserveProcessOptions} from 'nuclide-commons/process.js';
import type {CommitPhase, CommitNode, RawCommitNode} from './types';

import invariant from 'assert';
import {runCommand, ProcessExitError} from 'nuclide-commons/process.js';
import {Observable} from 'rxjs';

export class NotARepositoryError extends Error {
  constructor() {
    super('Command was run outside of an hg repository');
    this.name = this.constructor.name;
  }
}

function hg(
  subcommand: string,
  args: Array<string>,
  options: ObserveProcessOptions = {},
): Observable<string> {
  return runCommand('hg', [subcommand, ...args], {
    ...options,
    env: {...process.env, ...options.env, HGPLAIN: '1'},
  }).catch(err => {
    if (err instanceof ProcessExitError && err.exitCode === 255) {
      throw new NotARepositoryError();
    }
    throw err;
  });
}

export function getRepoRoot(dir: string): Observable<?string> {
  return hg('root', [], {cwd: dir}).map(out => out.trim()).catch(err => {
    if (err instanceof NotARepositoryError) {
      return Observable.of(null);
    }
    throw err;
  });
}

export function getCurrentRevisionHash(repoRoot: string): Observable<string> {
  return hg('id', ['-i', '--debug'], {cwd: repoRoot}).map(out => out.trim());
}

export function getMergeBaseHash(
  repoRoot: string,
  hash: string = '.',
): Observable<string> {
  return hg(
    'log',
    ['-r', `last(public() and ancestors(${hash}))`, '--template', '{node}'],
    {cwd: repoRoot},
  ).map(out => out.trim());
}

export function _getSubtreeCommitList(
  repoRoot: string,
  hash: string = '.',
): Observable<string> {
  return hg(
    'log',
    [
      '-r',
      `descendants(not public() and children(last(public() and ancestors(${hash})))) or last(public() and ancestors(${hash}))`,
      '--template',
      '----node\n{node}\n----p1node\n{p1node}\n----current\n{ifcontains(rev, revset("."), "1\n")}----phase\n{phase}\n----file_adds\n{file_adds % "{file}\n"}----file_copies\n{file_copies % "{source}\n{name}\n"}----file_dels\n{file_dels % "{file}\n"}----file_mods\n{file_mods % "{file}\n"}',
    ],
    {cwd: repoRoot},
  );
}

const NODE = 'node';
const P1_NODE = 'p1node';
const CURRENT = 'current';
const PHASE = 'phase';
const FILE_ADDS = 'file_adds';
const FILE_COPIES = 'file_copies';
const FILE_DELS = 'file_dels';
const FILE_MODS = 'file_mods';

// The sections, in the order that they appear in the log output.
const SUBTREE_COMMIT_LIST_SECTIONS = [
  NODE,
  P1_NODE,
  CURRENT,
  PHASE,
  FILE_ADDS,
  FILE_COPIES,
  FILE_DELS,
  FILE_MODS,
];

/**
 * Parse the `_getSubtreeCommitList` into a Map of raw nodes.
 */
export function _parseSubtreeCommitList(
  subtreeCommits: string,
): Set<RawCommitNode> {
  const lines = subtreeCommits.trim().split('\n');
  let currentSection = null;
  let nextSectionIndex = 0;
  let currentNode: ?RawCommitNode = null;
  let nodes: Set<RawCommitNode> = new Set();
  let foundCurrentRevision = false;

  const closeNode = node => {
    if (node != null) {
      nodes.add(node);
      currentNode = null;
    }
  };

  for (var i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Identify section markers.
    const section = SUBTREE_COMMIT_LIST_SECTIONS[nextSectionIndex];
    const nextSectionMarker = `----${section}`;
    if (line === nextSectionMarker) {
      // At the next node? Close the previous one.
      if (section === NODE) {
        closeNode(currentNode);
      }
      currentSection = section;
      nextSectionIndex =
        (nextSectionIndex + 1) % SUBTREE_COMMIT_LIST_SECTIONS.length;
      continue;
    }

    switch (currentSection) {
      case NODE:
        // We've got the hash! Create a new node.
        currentNode = {
          hash: line,
          parentHash: null,
          phase: 'draft',
          isCurrentRevision: false,
          addedFiles: new Set(),
          copiedFiles: new Set(),
          modifiedFiles: new Set(),
          deletedFiles: new Set(),
        };
        break;
      case P1_NODE:
        // We've got the parent hash!
        invariant(currentNode != null);
        currentNode.parentHash = line;
        break;
      case CURRENT:
        // If there's a line for this, it's the current node.
        invariant(currentNode != null);
        invariant(
          !foundCurrentRevision,
          'Multiple revisions were marked current.',
        );
        currentNode.isCurrentRevision = true;
        foundCurrentRevision = true;
        break;
      case PHASE:
        invariant(currentNode != null);
        invariant(line === 'draft' || line === 'public');
        currentNode.phase = line;
        break;
      case FILE_ADDS:
        invariant(currentNode != null);
        currentNode.addedFiles.add(line);
        break;
      case FILE_COPIES:
        invariant(currentNode != null);
        // Grap the dest from the next line and advance our pointer.
        const source = line;
        const dest = lines[i + 1];
        i++;

        currentNode.copiedFiles.add({source, dest});
        break;
      case FILE_MODS:
        invariant(currentNode != null);
        currentNode.modifiedFiles.add(line);
        break;
      case FILE_DELS:
        invariant(currentNode != null);
        currentNode.deletedFiles.add(line);
        break;
    }
  }

  // Close the last node.
  closeNode(currentNode);

  return nodes;
}

export function _buildTree(rawNodes: Set<RawCommitNode>): CommitNode {
  // Create a map of hashes to nodes. Later we'll mutate these nodes to set their parent and
  // children.
  const nodes = new Map();
  rawNodes.forEach(rawNode => {
    nodes.set(rawNode.hash, {
      ...rawNode,
      parent: null,
      children: [],
    });
  });

  // Set the parent and child of each node, and find the root.
  let root;
  nodes.forEach(node => {
    const {parentHash} = node;
    const parent = parentHash == null ? null : nodes.get(parentHash);
    if (parent == null) {
      invariant(root == null, 'Found multiple roots in tree');
      root = node;
      return;
    }
    node.parent = parent;
    parent.children.push(node);
  });

  invariant(root != null);

  // We don't actually care about the root's changes since we're looking at it in isolation.
  root.addedFiles = new Set();
  root.copiedFiles = new Set();
  root.modifiedFiles = new Set();
  root.deletedFiles = new Set();

  return root;
}

export function getSubtree(
  repoRoot: string,
  hash: string = '.',
): Observable<CommitNode> {
  return _getSubtreeCommitList(repoRoot, hash)
    .map(_parseSubtreeCommitList)
    .map(_buildTree);
}

export function initRepo(root: string): Observable<void> {
  return hg('init', [root]).ignoreElements();
}

export function commit(repoRoot: string, message: string): Observable<void> {
  return hg('commit', ['-m', message], {cwd: repoRoot}).ignoreElements();
}

export function setPhase(
  repoRoot: string,
  phase: CommitPhase,
  hash: string,
): Observable<void> {
  return hg('phase', [`--${phase}`, hash], {cwd: repoRoot}).ignoreElements();
}
