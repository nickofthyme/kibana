/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { z } from '@kbn/zod';
import { DEFAULT_RANGE_SLIDER_STATE } from '@kbn/controls-constants';
import { dataControlEsqlVariantProps, dataControlFieldVariantProps } from './control_schema';

export const rangeValueSchema = z.array(z.string()).length(2).meta({
  description:
    'The selected range as a two-element array of strings representing the lower and upper bound values, for example `["10", "50"]`.',
});

const rangeSliderExtras = {
  value: rangeValueSchema.optional(),
  step: z.number().min(0).default(DEFAULT_RANGE_SLIDER_STATE.step).meta({
    description: 'The step size between selectable range values.',
  }),
};

export const rangeSliderControlSchema = z.discriminatedUnion('values_source', [
  z
    .object({ ...dataControlEsqlVariantProps, ...rangeSliderExtras })
    .strict()
    .meta({
      id: 'kbn-controls-schemas-range-slider-control-schema-esql',
      title: 'EsqlRangeSliderControl',
      description: "A range slider control whose values come from an ES|QL query's results.",
    }),
  z
    .object({ ...dataControlFieldVariantProps, ...rangeSliderExtras })
    .strict()
    .meta({
      id: 'kbn-controls-schemas-range-slider-control-schema-field',
      title: 'FieldRangeSliderControl',
      description: 'A range slider control whose values come from a numeric data view field.',
    }),
]);
