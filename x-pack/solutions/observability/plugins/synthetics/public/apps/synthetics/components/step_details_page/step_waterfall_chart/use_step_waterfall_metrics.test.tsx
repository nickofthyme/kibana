/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { renderHook } from '@testing-library/react';
import {
  BROWSER_TRACE_NAME,
  BROWSER_TRACE_START,
  BROWSER_TRACE_TYPE,
  useStepWaterfallMetrics,
} from './use_step_waterfall_metrics';
import * as searchHooks from '@kbn/observability-shared-plugin/public/hooks/use_es_search';
import { SYNTHETICS_INDEX_PATTERN } from '../../../../../../common/constants';

describe('useStepWaterfallMetrics', () => {
  it('returns result as expected', () => {
    const searchHook = jest.spyOn(searchHooks, 'useEsSearch').mockReturnValue({
      loading: false,
      data: {
        hits: {
          total: { value: 2, relation: 'eq' },
          hits: [
            {
              fields: {
                [BROWSER_TRACE_TYPE]: ['mark'],
                [BROWSER_TRACE_NAME]: ['navigationStart'],
                [BROWSER_TRACE_START]: [3456789],
              },
            },
            {
              fields: {
                [BROWSER_TRACE_TYPE]: ['mark'],
                [BROWSER_TRACE_NAME]: ['domContentLoaded'],
                [BROWSER_TRACE_START]: [4456789],
              },
            },
          ],
        },
      } as any,
    });

    const { result } = renderHook(
      (props) =>
        useStepWaterfallMetrics({
          checkGroup: '44D-444FFF-444-FFF-3333',
          hasNavigationRequest: true,
          stepIndex: 1,
        }),
      {}
    );

    expect(searchHook).toHaveBeenCalledWith(
      {
        _source: false,
        fields: ['browser.*'],
        query: {
          bool: {
            filter: [
              {
                term: {
                  'synthetics.step.index': 1,
                },
              },
              {
                term: {
                  'monitor.check_group': '44D-444FFF-444-FFF-3333',
                },
              },
              {
                term: {
                  'synthetics.type': 'step/metrics',
                },
              },
            ],
          },
        },
        size: 1000,
        index: SYNTHETICS_INDEX_PATTERN,
      },
      ['44D-444FFF-444-FFF-3333', true],
      { name: 'getWaterfallStepMetrics' }
    );
    expect(result.current).toEqual({
      loading: false,
      metrics: [
        {
          id: 'domContentLoaded',
          offset: 1000,
        },
      ],
    });
  });
});
