/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ElasticsearchClient } from '@kbn/core/server';
import type {
  Filter,
  SortFieldOrUndefined,
  SortOrderOrUndefined,
} from '@kbn/securitysolution-io-ts-list-types';
import { MappingRuntimeFields } from '@elastic/elasticsearch/lib/api/types';

import { Scroll } from '../lists/types';

import { getQueryFilter } from './get_query_filter';
import { getSortWithTieBreaker } from './get_sort_with_tie_breaker';
import { getSourceWithTieBreaker } from './get_source_with_tie_breaker';
import { TieBreaker, getSearchAfterWithTieBreaker } from './get_search_after_with_tie_breaker';

interface GetSearchAfterOptions {
  esClient: ElasticsearchClient;
  filter: Filter;
  hops: number;
  hopSize: number;
  searchAfter: string[] | undefined;
  index: string;
  sortField: SortFieldOrUndefined;
  sortOrder: SortOrderOrUndefined;
  runtimeMappings: MappingRuntimeFields | undefined;
}

export const getSearchAfterScroll = async <T>({
  esClient,
  filter,
  hopSize,
  hops,
  searchAfter,
  sortField,
  sortOrder,
  index,
  runtimeMappings,
}: GetSearchAfterOptions): Promise<Scroll> => {
  const query = getQueryFilter({ filter });
  let newSearchAfter = searchAfter;
  for (let i = 0; i < hops; ++i) {
    const response = await esClient.search<TieBreaker<T>>({
      _source: getSourceWithTieBreaker({ sortField }),
      ignore_unavailable: true,
      index,
      query,
      runtime_mappings: runtimeMappings,
      search_after: newSearchAfter,
      size: hopSize,
      sort: getSortWithTieBreaker({ sortField, sortOrder }),
    });
    if (response.hits.hits.length > 0) {
      newSearchAfter = getSearchAfterWithTieBreaker({ response, sortField });
    } else {
      return {
        searchAfter: undefined,
        validSearchAfterFound: false,
      };
    }
  }
  return {
    searchAfter: newSearchAfter,
    validSearchAfterFound: true,
  };
};
