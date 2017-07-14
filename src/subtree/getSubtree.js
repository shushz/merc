/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

import type {RawCommitNode, Subtree} from '../types';

import invariant from 'assert';
import {Observable} from 'rxjs';
import {log} from '../HgUtils';

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

export default function getSubtree(
  repoRoot: string,
  hash: string = '.',
): Observable<Subtree> {
  return getSubtreeCommitList(repoRoot, hash)
    .map(parseSubtreeCommitList)
    .map(buildTree);
}

function getSubtreeCommitList(
  repoRoot: string,
  hash: string = '.',
): Observable<string> {
  return log(
    repoRoot,
    `descendants(not public() and children(last(public() and ancestors(${hash})))) or last(public() and ancestors(${hash}))`,
    '----node\n{node}\n----p1node\n{p1node}\n----current\n{ifcontains(rev, revset("."), "1\n")}----phase\n{phase}\n----file_adds\n{file_adds % "{file}\n"}----file_copies\n{file_copies % "{source}\n{name}\n"}----file_dels\n{file_dels % "{file}\n"}----file_mods\n{file_mods % "{file}\n"}',
  );
}

/**
 * Parse the `getSubtreeCommitList` into a Map of raw nodes.
 */
function parseSubtreeCommitList(subtreeCommits: string): Set<RawCommitNode> {
  const lines = subtreeCommits.trim().split('\n');
  let currentSection = null;
  let nextSectionIndex = 0;
  let currentNode: ?RawCommitNode = null;
  const nodes: Set<RawCommitNode> = new Set();
  let foundCurrentRevision = false;

  const closeNode = node => {
    if (node != null) {
      nodes.add(node);
      currentNode = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
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

function buildTree(rawNodes: Set<RawCommitNode>): Subtree {
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
  // However, whatever files it added are the tree's initial files, which we'll need later.
  const initialFiles = root.addedFiles;
  root.addedFiles = new Set();
  root.copiedFiles = new Set();
  root.modifiedFiles = new Set();
  root.deletedFiles = new Set();

  return {root, initialFiles};
}

// Exported for testing.
export const _getSubtreeCommitList = getSubtreeCommitList;
export const _parseSubtreeCommitList = parseSubtreeCommitList;
export const _buildTree = buildTree;
