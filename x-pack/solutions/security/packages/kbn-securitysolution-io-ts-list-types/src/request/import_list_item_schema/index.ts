/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import * as t from 'io-ts';

import { RequiredKeepUndefined } from '../../common/required_keep_undefined';
import { file } from '../../common/file';

export const importListItemSchema = t.exact(
  t.type({
    file,
  })
);

export type ImportListItemSchema = RequiredKeepUndefined<t.TypeOf<typeof importListItemSchema>>;
export type ImportListItemSchemaEncoded = t.OutputOf<typeof importListItemSchema>;
