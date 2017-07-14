/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @flow
 * @format
 */

import type {CommitNode, ShadowCommitNode} from '../types';

import debugLog from '../debugLog';
import {getCurrentRevisionHash, transplant, update} from '../HgUtils';
import {dfs} from '../TreeUtils';
import {Observable} from 'rxjs';

type MoveSubtreeOptions = {|
  sourceRepoRoot: string,
  sourceRoot: CommitNode,
  destRepoRoot: string,
  destParentHash: string,
|};

export function moveSubtree(
  options: MoveSubtreeOptions,
): Observable<ShadowCommitNode> {
  const {sourceRepoRoot, sourceRoot, destRepoRoot, destParentHash} = options;
  return Observable.defer(() => {
    const sourceNodesToShadowNodes: Map<
      CommitNode,
      ShadowCommitNode,
    > = new Map();
    let shadowRoot;
    let currentShadowNode;

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
            if (newShadowNode.isCurrentRevision) {
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
      Observable.from(sourceRoot.children).concatMap(
        node =>
          Observable.defer(() => {
            debugLog('Running strip ', node.hash);
            return Observable.empty();
          }),
        // strip(sourceRepoRoot, node.hash),
      ),
    )
      .ignoreElements()
      .concat(Observable.of(shadowRoot)),
  );
}

function createShadowCommitNode(
  sourceRepoRoot: string,
  sourceNode: CommitNode,
  destRepoRoot: string,
  destParentHash: string,
): Observable<ShadowCommitNode> {
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
          isCurrentRevision: sourceNode.isCurrentRevision,
          phase: sourceNode.phase,
          addedFiles: sourceNode.addedFiles,
          copiedFiles: sourceNode.copiedFiles,
          modifiedFiles: sourceNode.modifiedFiles,
          deletedFiles: sourceNode.deletedFiles,
          hash,
          parent: null,
          sourceHash: sourceNode.hash,
          children: [],
        };
      })
  );
}
