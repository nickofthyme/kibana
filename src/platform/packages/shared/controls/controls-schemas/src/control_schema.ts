/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { z } from '@kbn/zod';
import { ControlValuesSource, DEFAULT_DATA_CONTROL_STATE } from '@kbn/controls-constants';

export const controlTitleSchema = z
  .object({
    title: z.string().optional().meta({ description: 'A human-readable title for the control.' }),
  })
  .strict();

const sharedDataControlProps = z
  .object({
    ...controlTitleSchema.shape,
    use_global_filters: z.boolean().default(DEFAULT_DATA_CONTROL_STATE.use_global_filters).meta({
      description:
        "When `true`, the control's available options are narrowed by the page's active filters. Defaults to `true`.",
    }),
    ignore_validations: z
      .boolean()
      .default(DEFAULT_DATA_CONTROL_STATE.ignore_validations)
      .meta({
        description:
          'When `true`, the control skips selection validation and does not report which selections are responsible for returning zero results. Defaults to `false`.',
      }),
  })
  .strict();

/**
 * This uses a union with only one option so we can provide a default value for backwards compat.
 */
export const dataControlFieldValuesSourceSchema = z
  .literal(ControlValuesSource.FIELD)
  .default(ControlValuesSource.FIELD)
  .meta({
    description:
      'The source of the field options for this control. Defaults to `field` for legacy controls.',
  });

export const dataControlFieldVariantProps = {
  ...sharedDataControlProps.shape,
  values_source: dataControlFieldValuesSourceSchema,
  data_view_id: z.string().min(1).meta({
    description: 'The ID of the data view that provides field options for this control.',
  }),
  field_name: z.string().min(1).meta({
    description: 'The name of the field in the data view that this control filters on.',
  }),
};

export const dataControlEsqlVariantProps = {
  ...sharedDataControlProps.shape,
  values_source: z.literal(ControlValuesSource.ESQL),
  esql_query: z.string().min(1).meta({
    description: 'The ES|QL query that provides field options for this control',
  }),
};

export const dataControlSchema = z
  .discriminatedUnion('values_source', [
    z.object(dataControlEsqlVariantProps).strict(),
    z.object(dataControlFieldVariantProps).strict(),
  ])
  .meta({
    description:
      'The source of the field options for this control, either `field` for all possible values of a field, or `esql` for the results of an ES|QL query. Defaults to `field`',
  });
