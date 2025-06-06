/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { schema } from '@kbn/config-schema';

export const unsnoozeParamsSchema = schema.object({
  ruleId: schema.string({ meta: { description: 'The identifier for the rule.' } }),
  scheduleId: schema.string({
    meta: { description: 'The identifier for the snooze schedule.' },
  }),
});
