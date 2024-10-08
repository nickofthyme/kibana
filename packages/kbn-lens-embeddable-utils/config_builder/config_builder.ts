/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { FormulaPublicApi, LensEmbeddableInput } from '@kbn/lens-plugin/public';
import { v4 as uuidv4 } from 'uuid';
import { DataViewsService } from '@kbn/data-views-plugin/common';
import { LensAttributes, LensConfig, LensConfigOptions } from './types';
import {
  buildGauge,
  buildHeatmap,
  buildMetric,
  buildRegionMap,
  buildTagCloud,
  buildTable,
  buildXY,
  buildPartitionChart,
} from './charts';

export type DataViewsCommon = Pick<DataViewsService, 'get' | 'create'>;

export class LensConfigBuilder {
  private charts = {
    metric: buildMetric,
    tagcloud: buildTagCloud,
    treemap: buildPartitionChart,
    pie: buildPartitionChart,
    donut: buildPartitionChart,
    gauge: buildGauge,
    heatmap: buildHeatmap,
    mosaic: buildPartitionChart,
    regionmap: buildRegionMap,
    xy: buildXY,
    table: buildTable,
  };
  private formulaAPI: FormulaPublicApi | undefined;
  private dataViewsAPI: DataViewsCommon;

  // formulaApi is optional, as it is not necessary to use it when creating charts with ES|QL
  constructor(dataViewsAPI: DataViewsCommon, formulaAPI?: FormulaPublicApi) {
    this.formulaAPI = formulaAPI;
    this.dataViewsAPI = dataViewsAPI;
  }

  async build(
    config: LensConfig,
    options: LensConfigOptions = {}
  ): Promise<LensAttributes | LensEmbeddableInput> {
    const { chartType } = config;
    const chartConfig = await this.charts[chartType](config as any, {
      formulaAPI: this.formulaAPI,
      dataViewsAPI: this.dataViewsAPI,
    });

    const chartState = {
      ...chartConfig,
      state: {
        ...chartConfig.state,
        filters: options.filters || [],
        query: options.query || { language: 'kuery', query: '' },
      },
    };

    if (options.embeddable) {
      return {
        id: uuidv4(),
        attributes: chartState,
        timeRange: options.timeRange,
        references: chartState.references,
      } as LensEmbeddableInput;
    }

    return chartState as LensAttributes;
  }
}
