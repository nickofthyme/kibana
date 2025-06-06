/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { render } from '@testing-library/react';
import React from 'react';
import type { Indicator } from '../../../../../../common/threat_intelligence/types/indicator';
import { generateMockFileIndicator } from '../../../../../../common/threat_intelligence/types/indicator';
import { TestProvidersComponent } from '../../../../mocks/test_providers';
import { MoreActions } from './more_actions';
import { MORE_ACTIONS_TEST_ID } from './test_ids';

describe('MoreActions', () => {
  it('should render an EuiContextMenuPanel', () => {
    const indicator: Indicator = generateMockFileIndicator();
    const { getByTestId } = render(
      <TestProvidersComponent>
        <MoreActions indicator={indicator} />
      </TestProvidersComponent>
    );
    expect(getByTestId(MORE_ACTIONS_TEST_ID)).toBeInTheDocument();
  });
});
