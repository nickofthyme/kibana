/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import * as t from 'io-ts';
import { Either } from 'fp-ts/Either';
import { createComment, CreateCommentsArray } from '../create_comment';

/**
 * Types the DefaultCreateComments as:
 *   - If null or undefined, then a default array of type entry will be set
 */
export const DefaultCreateCommentsArray = new t.Type<
  CreateCommentsArray,
  CreateCommentsArray,
  unknown
>(
  'DefaultCreateComments',
  t.array(createComment).is,
  (input): Either<t.Errors, CreateCommentsArray> =>
    input == null ? t.success([]) : t.array(createComment).decode(input),
  t.identity
);
