/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createRouteValidationFunction } from '@kbn/io-ts-utils';
import {
  InfraGetCustomDashboardsRequestPathParamsRT,
  InfraGetCustomDashboardsResponseBodyRT,
} from '../../../common/http_api/custom_dashboards_api';
import type { KibanaFramework } from '../../lib/adapters/framework/kibana_framework_adapter';
import { handleRouteErrors } from '../../utils/handle_route_errors';
import { checkCustomDashboardsEnabled } from './lib/check_custom_dashboards_enabled';
import { findCustomDashboard } from './lib/find_custom_dashboard';

export function initGetCustomDashboardRoute(framework: KibanaFramework) {
  const validateParams = createRouteValidationFunction(InfraGetCustomDashboardsRequestPathParamsRT);

  framework.registerRoute(
    {
      method: 'get',
      path: '/api/infra/{assetType}/custom-dashboards',
      validate: {
        params: validateParams,
      },
      options: {
        access: 'internal',
      },
    },
    handleRouteErrors(async (context, request, response) => {
      const { savedObjectsClient, uiSettingsClient } = await context.infra;

      await checkCustomDashboardsEnabled(uiSettingsClient);

      const params = request.params;
      const customDashboards = await findCustomDashboard(params.assetType, savedObjectsClient);

      return response.ok({
        body: InfraGetCustomDashboardsResponseBodyRT.encode(customDashboards),
      });
    })
  );
}
