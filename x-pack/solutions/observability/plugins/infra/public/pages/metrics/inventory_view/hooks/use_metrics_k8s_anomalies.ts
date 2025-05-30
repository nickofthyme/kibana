/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useState, useCallback, useEffect, useReducer } from 'react';
import type { BehaviorSubject } from 'rxjs';
import { decodeOrThrow } from '@kbn/io-ts-utils';
import { useKibanaContextForPlugin } from '../../../../hooks/use_kibana';
import { isFailure, isPending, useFetcher } from '../../../../hooks/use_fetcher';
import type {
  Sort,
  Pagination,
  PaginationCursor,
  MetricsK8sAnomaly,
  Metric,
} from '../../../../../common/http_api/infra_ml';
import {
  INFA_ML_GET_METRICS_K8S_ANOMALIES_PATH,
  getMetricsK8sAnomaliesSuccessReponsePayloadRT,
  getMetricsK8sAnomaliesRequestPayloadRT,
} from '../../../../../common/http_api/infra_ml';

export type SortOptions = Sort;
export type PaginationOptions = Pick<Pagination, 'pageSize'>;
export type Page = number;
export type FetchNextPage = () => void;
export type FetchPreviousPage = () => void;
export type ChangeSortOptions = (sortOptions: Sort) => void;
export type ChangePaginationOptions = (paginationOptions: PaginationOptions) => void;
export type MetricsK8sAnomalies = MetricsK8sAnomaly[];
interface PaginationCursors {
  previousPageCursor: PaginationCursor;
  nextPageCursor: PaginationCursor;
}

interface ReducerState {
  page: number;
  lastReceivedCursors: PaginationCursors | undefined;
  paginationCursor: Pagination['cursor'] | undefined;
  hasNextPage: boolean;
  paginationOptions: PaginationOptions;
  sortOptions: Sort;
  timeRange: {
    start: number;
    end: number;
  };
  filteredDatasets?: string[];
}

type ReducerStateDefaults = Pick<
  ReducerState,
  'page' | 'lastReceivedCursors' | 'paginationCursor' | 'hasNextPage'
>;

type ReducerAction =
  | { type: 'changePaginationOptions'; payload: { paginationOptions: PaginationOptions } }
  | { type: 'changeSortOptions'; payload: { sortOptions: Sort } }
  | { type: 'fetchNextPage' }
  | { type: 'fetchPreviousPage' }
  | { type: 'changeHasNextPage'; payload: { hasNextPage: boolean } }
  | { type: 'changeLastReceivedCursors'; payload: { lastReceivedCursors: PaginationCursors } }
  | { type: 'changeTimeRange'; payload: { timeRange: { start: number; end: number } } }
  | { type: 'changeFilteredDatasets'; payload: { filteredDatasets?: string[] } };

const stateReducer = (state: ReducerState, action: ReducerAction): ReducerState => {
  const resetPagination = {
    page: 1,
    paginationCursor: undefined,
  };
  switch (action.type) {
    case 'changePaginationOptions':
      return {
        ...state,
        ...resetPagination,
        ...action.payload,
      };
    case 'changeSortOptions':
      return {
        ...state,
        ...resetPagination,
        ...action.payload,
      };
    case 'changeHasNextPage':
      return {
        ...state,
        ...action.payload,
      };
    case 'changeLastReceivedCursors':
      return {
        ...state,
        ...action.payload,
      };
    case 'fetchNextPage':
      return state.lastReceivedCursors
        ? {
            ...state,
            page: state.page + 1,
            paginationCursor: { searchAfter: state.lastReceivedCursors.nextPageCursor },
          }
        : state;
    case 'fetchPreviousPage':
      return state.lastReceivedCursors
        ? {
            ...state,
            page: state.page - 1,
            paginationCursor: { searchBefore: state.lastReceivedCursors.previousPageCursor },
          }
        : state;
    case 'changeTimeRange':
      return {
        ...state,
        ...resetPagination,
        ...action.payload,
      };
    case 'changeFilteredDatasets':
      return {
        ...state,
        ...resetPagination,
        ...action.payload,
      };
    default:
      return state;
  }
};

const STATE_DEFAULTS: ReducerStateDefaults = {
  // NOTE: This piece of state is purely for the client side, it could be extracted out of the hook.
  page: 1,
  // Cursor from the last request
  lastReceivedCursors: undefined,
  // Cursor to use for the next request. For the first request, and therefore not paging, this will be undefined.
  paginationCursor: undefined,
  hasNextPage: false,
};

export const useMetricsK8sAnomaliesResults = (
  {
    endTime,
    startTime,
    sourceId,
    anomalyThreshold,
    defaultSortOptions,
    defaultPaginationOptions,
    filteredDatasets,
    search,
    metric,
  }: {
    endTime: number;
    startTime: number;
    sourceId: string;
    anomalyThreshold: number;
    defaultSortOptions: Sort;
    defaultPaginationOptions: Pick<Pagination, 'pageSize'>;
    filteredDatasets?: string[];
    search?: string;
    metric?: Metric;
  },
  {
    request$,
    active = true,
  }: { request$?: BehaviorSubject<(() => Promise<unknown>) | undefined>; active?: boolean }
) => {
  const {
    services: { application },
  } = useKibanaContextForPlugin();

  const [metricsK8sAnomalies, setMetricsK8sAnomalies] = useState<MetricsK8sAnomalies>([]);
  const initStateReducer = (stateDefaults: ReducerStateDefaults): ReducerState => {
    return {
      ...stateDefaults,
      paginationOptions: defaultPaginationOptions,
      sortOptions: defaultSortOptions,
      filteredDatasets,
      timeRange: {
        start: startTime,
        end: endTime,
      },
    };
  };
  const [reducerState, dispatch] = useReducer(stateReducer, STATE_DEFAULTS, initStateReducer);

  const mlCapabilities = application.capabilities.ml as { canGetJobs: boolean } | undefined;
  const canGetAnomalies = mlCapabilities?.canGetJobs;

  const {
    data: response,
    status,
    refetch,
  } = useFetcher(
    async (callApi) => {
      if (!canGetAnomalies) {
        return;
      }

      const apiResponse = await callApi(INFA_ML_GET_METRICS_K8S_ANOMALIES_PATH, {
        method: 'POST',
        body: JSON.stringify(
          getMetricsK8sAnomaliesRequestPayloadRT.encode({
            data: {
              sourceId,
              anomalyThreshold,
              timeRange: {
                startTime: reducerState.timeRange.start,
                endTime: reducerState.timeRange.end,
              },
              metric,
              query: search,
              sort: reducerState.sortOptions,
              pagination: {
                ...reducerState.paginationOptions,
                cursor: reducerState.paginationCursor,
              },
            },
          })
        ),
      });

      return decodeOrThrow(getMetricsK8sAnomaliesSuccessReponsePayloadRT)(apiResponse);
    },
    [
      anomalyThreshold,
      metric,
      reducerState.paginationCursor,
      reducerState.paginationOptions,
      reducerState.sortOptions,
      reducerState.timeRange.end,
      reducerState.timeRange.start,
      search,
      sourceId,
      canGetAnomalies,
    ],
    {
      requestObservable$: request$,
      autoFetch: active,
    }
  );

  const { data } = response ?? {};

  useEffect(() => {
    if (isPending(status) || !data) {
      return;
    }

    const { anomalies, paginationCursors: requestCursors, hasMoreEntries } = data;
    if (requestCursors) {
      dispatch({
        type: 'changeLastReceivedCursors',
        payload: { lastReceivedCursors: requestCursors },
      });
    }
    // Check if we have more "next" entries. "Page" covers the "previous" scenario,
    // since we need to know the page we're on anyway.
    if (
      !reducerState.paginationCursor ||
      (reducerState.paginationCursor && 'searchAfter' in reducerState.paginationCursor)
    ) {
      dispatch({ type: 'changeHasNextPage', payload: { hasNextPage: hasMoreEntries } });
    } else if (reducerState.paginationCursor && 'searchBefore' in reducerState.paginationCursor) {
      // We've requested a previous page, therefore there is a next page.
      dispatch({ type: 'changeHasNextPage', payload: { hasNextPage: true } });
    }
    setMetricsK8sAnomalies(anomalies);
  }, [reducerState.paginationCursor, data, status]);

  const changeSortOptions = useCallback(
    (nextSortOptions: Sort) => {
      dispatch({ type: 'changeSortOptions', payload: { sortOptions: nextSortOptions } });
    },
    [dispatch]
  );

  const changePaginationOptions = useCallback(
    (nextPaginationOptions: PaginationOptions) => {
      dispatch({
        type: 'changePaginationOptions',
        payload: { paginationOptions: nextPaginationOptions },
      });
    },
    [dispatch]
  );

  // Time range has changed
  useEffect(() => {
    dispatch({
      type: 'changeTimeRange',
      payload: { timeRange: { start: startTime, end: endTime } },
    });
  }, [startTime, endTime]);

  // Selected datasets have changed
  useEffect(() => {
    dispatch({
      type: 'changeFilteredDatasets',
      payload: { filteredDatasets },
    });
  }, [filteredDatasets]);

  const handleFetchNextPage = useCallback(() => {
    if (reducerState.lastReceivedCursors) {
      dispatch({ type: 'fetchNextPage' });
    }
  }, [dispatch, reducerState]);

  const handleFetchPreviousPage = useCallback(() => {
    if (reducerState.lastReceivedCursors) {
      dispatch({ type: 'fetchPreviousPage' });
    }
  }, [dispatch, reducerState]);

  const isPendingMetricsK8sAnomalies = isPending(status);
  const hasFailedLoadingMetricsK8sAnomalies = isFailure(status);

  return {
    metricsK8sAnomalies,
    getMetricsK8sAnomalies: refetch,
    isPendingMetricsK8sAnomalies,
    hasFailedLoadingMetricsK8sAnomalies,
    changeSortOptions,
    sortOptions: reducerState.sortOptions,
    changePaginationOptions,
    paginationOptions: reducerState.paginationOptions,
    fetchPreviousPage: reducerState.page > 1 ? handleFetchPreviousPage : undefined,
    fetchNextPage: reducerState.hasNextPage ? handleFetchNextPage : undefined,
    page: reducerState.page,
  };
};
