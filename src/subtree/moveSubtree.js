/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

import type {CommitNode} from '../types';

import debugLog from '../debugLog';
import {
  getCurrentRevisionHash,
  strip,
  transplant,
  transplantBulk,
  update,
} from '../HgUtils';
import {dfs} from '../TreeUtils';
import {Observable} from 'rxjs';
import {getPathToCurrentFromNode, getByPathFromRootNode} from './SubtreePath';
import getSubtree from './getSubtree';

type MoveSubtreeOptions = {|
  sourceRepoRoot: string,
  sourceRoot: CommitNode,
  currentHash: string,
  destRepoRoot: string,
  destParentHash: string,
|};

export function moveSubtree(
  options: MoveSubtreeOptions,
): Observable<CommitNode> {
  const {
    sourceRepoRoot,
    sourceRoot,
    currentHash,
    destRepoRoot,
    destParentHash,
  } = options;
  return Observable.defer(() => {
    const sourceNodesToShadowNodes: Map<CommitNode, CommitNode> = new Map();
    let shadowRoot;
    let currentShadowNode;

    debugLog('Moving subtree');

    return Observable.from(dfs(sourceRoot))
      .concatMap(sourceNode => {
        const shadowParent = sourceNode.parent == null
          ? null
          : sourceNodesToShadowNodes.get(sourceNode.parent);
        const parentHash = shadowParent == null
          ? destParentHash
          : shadowParent.hash;
        return createShadowCommitNode(
          sourceRepoRoot,
          sourceNode,
          destRepoRoot,
          parentHash,
        )
          .do(newShadowNode => {
            // Keep track of which node in the source tree this one corresponds to.
            sourceNodesToShadowNodes.set(sourceNode, newShadowNode);

            if (shadowParent == null) {
              shadowRoot = newShadowNode;
            } else {
              newShadowNode.parent = shadowParent;
              shadowParent.children.push(newShadowNode);
            }
            if (sourceNode.hash === currentHash) {
              currentShadowNode = newShadowNode;
            }
          })
          .ignoreElements();
      })
      .concat(
        Observable.defer(() => Observable.of({shadowRoot, currentShadowNode})),
      );
  }).switchMap(({shadowRoot, currentShadowNode}) =>
    Observable.merge(
      // Move to the current node in the shadow tree.
      update(destRepoRoot, currentShadowNode.hash),
      // Strip the non-public nodes from the source tree.
      Observable.from(sourceRoot.children).concatMap(node =>
        strip(sourceRepoRoot, node.hash),
      ),
    )
      .ignoreElements()
      .concat(Observable.of(shadowRoot)),
  );
}

export function bulkMoveSubtree(
  options: MoveSubtreeOptions,
): Observable<CommitNode> {
  const {sourceRepoRoot, sourceRoot, currentHash, destRepoRoot} = options;

  const sourceHashesToMove = [];
  let currentSourceNode = sourceRoot;
  for (const node of dfs(sourceRoot)) {
    if (node.phase !== 'public') {
      sourceHashesToMove.push(node.hash);
    }

    if (node.hash === currentHash) {
      currentSourceNode = node;
    }
  }
  const pathToCurrentNode = getPathToCurrentFromNode(currentSourceNode);

  return Observable.defer(() => {
    debugLog('Bulk-moving subtree');

    return transplantBulk(sourceRepoRoot, sourceHashesToMove, destRepoRoot)
      .concat(getSubtree(destRepoRoot))
      .switchMap(shadowSubtree => {
        const newCurrent = getByPathFromRootNode(
          shadowSubtree.root,
          pathToCurrentNode,
        );

        return update(destRepoRoot, newCurrent.hash).concat(
          Observable.of(shadowSubtree.root),
        );
      });
  });
}

function createShadowCommitNode(
  sourceRepoRoot: string,
  sourceNode: CommitNode,
  destRepoRoot: string,
  destParentHash: string,
): Observable<CommitNode> {
  return (
    update(destRepoRoot, destParentHash)
      // Import the source commit (unless it's public).
      .concat(
        sourceNode.phase === 'public'
          ? Observable.empty()
          : transplant(sourceRepoRoot, sourceNode.hash, destRepoRoot),
      )
      .ignoreElements()
      .concat(getCurrentRevisionHash(destRepoRoot))
      .map(hash => {
        return {
          phase: sourceNode.phase,
          addedFiles: sourceNode.addedFiles,
          copiedFiles: sourceNode.copiedFiles,
          modifiedFiles: sourceNode.modifiedFiles,
          deletedFiles: sourceNode.deletedFiles,
          hash,
          parent: null,
          children: [],
        };
      })
  );
}
