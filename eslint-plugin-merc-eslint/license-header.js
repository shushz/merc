/*
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 * @noflow
 */

'use strict';

/* NON-TRANSPILED FILE */
/* eslint-disable comma-dangle */

const FAKE_DISABLE_RE = /\s*eslint-disable\s+merc-eslint\/license-header\s*/;

// http://stackoverflow.com/a/2593661/396304.
function quote(str) {
  return str.replace(/[.?*+^$[\]\\(){}|-]/g, '\\$&');
}

const LICENSE_WITH_FLOW = new RegExp(
  '^(?:' +
    quote('#!') +
    '\\S+\n)?' +
    quote(`\
/*
 * Copyright (c) 201`) +
    '\\d' +
    quote(`-present, Facebook, Inc.
 * All rights reserved.
 * `) +
    '@(?:no)?flow'
);

module.exports = context => {
  // "eslint-disable" disables rules after it. Since the directives have to go
  // first, we can't use that mechanism to disable this check.
  const comments = context.getAllComments();
  for (let i = 0; i < comments.length; i++) {
    if (FAKE_DISABLE_RE.test(comments[i].value)) {
      return {};
    }
  }

  const sourceCode = context.getSourceCode();

  return {
    Program(node) {
      const source = sourceCode.text;

      if (LICENSE_WITH_FLOW.test(source)) {
        return;
      }

      context.report({
        node,
        message: 'Expected a license header',
      });
    },
  };
};

module.exports.schema = [];
