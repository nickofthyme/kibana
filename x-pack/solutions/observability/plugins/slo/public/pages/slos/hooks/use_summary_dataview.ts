/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useFetcher } from '@kbn/observability-shared-plugin/public';
import { useEffect, useState } from 'react';
import { getSLOSummaryIndices } from '../../../../common/get_slo_summary_indices';
import { useCreateDataView } from '../../../hooks/use_create_data_view';
import { useKibana } from '../../../hooks/use_kibana';
import { useGetSettings } from '../../slo_settings/hooks/use_get_settings';

export const useSloSummaryDataView = () => {
  const { http } = useKibana().services;

  const [indexPattern, setIndexPattern] = useState<string | undefined>();
  const { isLoading: isSettingsLoading, data: settings } = useGetSettings();
  const { loading: isRemoteClustersLoading, data: remoteClusters } = useFetcher(() => {
    return http?.get<Array<{ name: string; isConnected: boolean }>>('/api/remote_clusters');
  }, [http]);

  useEffect(() => {
    if (settings && remoteClusters) {
      const summaryIndices = getSLOSummaryIndices(settings, remoteClusters);
      setIndexPattern(summaryIndices.join(','));
    }
  }, [settings, remoteClusters]);

  const { loading: isDataViewLoading, dataView } = useCreateDataView({
    indexPatternString: indexPattern,
  });

  return {
    isLoading: isSettingsLoading || isRemoteClustersLoading || isDataViewLoading,
    data: dataView,
  };
};
