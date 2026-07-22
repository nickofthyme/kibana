/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { z } from '@kbn/zod/v4';

const MAX_PASSES = 10;

interface Deletion {
  path: Array<string | number>;
  keys: string[];
}

function isUnknownOnlyBranch(issues: z.core.$ZodIssue[]): boolean {
  return issues.every((issue) => {
    if (issue.code === 'unrecognized_keys') return true;
    if (issue.code === 'invalid_union') {
      return issue.errors.filter(isUnknownOnlyBranch).length === 1;
    }
    return false;
  });
}

function collectDeletions(
  issues: z.core.$ZodIssue[],
  prefix: Array<string | number> = []
): Deletion[] {
  const deletions: Deletion[] = [];
  for (const issue of issues) {
    if (issue.code === 'unrecognized_keys') {
      deletions.push({
        path: [...prefix, ...(issue.path as Array<string | number>)],
        keys: issue.keys,
      });
    } else if (issue.code === 'invalid_union') {
      const eligible = issue.errors.filter(isUnknownOnlyBranch);
      if (eligible.length === 1) {
        // Branch issue paths are relative to the union's position — prepend union's path.
        const unionPath = [...prefix, ...(issue.path as Array<string | number>)];
        deletions.push(...collectDeletions(eligible[0], unionPath));
      }
    }
  }
  return deletions;
}

function applyDeletions(root: Record<string, unknown>, deletions: Deletion[]): boolean {
  let anyDeleted = false;
  for (const { path, keys } of deletions) {
    let node: unknown = root;
    for (const segment of path) {
      if (node === null || typeof node !== 'object' || !Object.hasOwn(node, segment)) {
        node = undefined;
        break;
      }
      node = (node as Record<string | number, unknown>)[segment];
    }
    if (node !== null && typeof node === 'object' && !Array.isArray(node)) {
      for (const key of keys) {
        if (Object.hasOwn(node, key)) {
          delete (node as Record<string, unknown>)[key];
          anyDeleted = true;
        }
      }
    }
  }
  return anyDeleted;
}

/**
 * Parses `value` against `schema`, iteratively stripping unknown keys until
 * the parse succeeds or no further stripping is possible.
 *
 * Each pass calls `schema.safeParse`. On success the parsed output is returned.
 * On failure, `unrecognized_keys` issues are collected from the error tree and
 * the offending keys are deleted from a working copy of the input; then the
 * next pass runs. This repeats until either the parse succeeds or there are no
 * more unknown-key issues to strip (at which point the error is thrown).
 *
 * Supports: strict objects, arrays of strict objects, discriminated unions,
 * and plain `z.union` schemas when exactly one branch's complete error tree
 * consists only of attributable unknown-key issues (unambiguous branch).
 *
 * Capped at 10 passes total; throws if the schema has not converged by then.
 * Most schemas converge in 1–2 passes. Multiple passes arise only when
 * stripping union-branch keys shifts which branch matches, exposing new
 * unknown keys in the newly-active branch. 10 is an arbitrary safety cap
 * with generous headroom over any realistic schema depth.
 *
 * The caller's input is never mutated; stripping is applied to a lazy clone
 * created only on the first strip pass.
 */
export function parseWithStrippedUnknownKeys<T extends z.ZodType>(
  schema: T,
  value: unknown
): z.output<T> {
  let current = value;
  let cloned = false;

  for (let pass = 1; pass <= MAX_PASSES; pass++) {
    const result = schema.safeParse(current);
    if (result.success) return result.data;

    const deletions = collectDeletions(result.error.issues);
    if (deletions.length === 0 || pass === MAX_PASSES) {
      throw result.error;
    }

    if (!cloned) {
      current = structuredClone(value);
      cloned = true;
    }

    const deleted = applyDeletions(current as Record<string, unknown>, deletions);
    if (!deleted) {
      throw result.error;
    }
  }

  // unreachable — loop always returns or throws within the bound
  throw new Error('parseWithStrippedUnknownKeys: exceeded MAX_PASSES without result');
}
