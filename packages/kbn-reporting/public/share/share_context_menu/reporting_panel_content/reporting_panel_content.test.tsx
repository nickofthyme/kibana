/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { coreMock, httpServiceMock, uiSettingsServiceMock } from '@kbn/core/public/mocks';
import { mountWithIntl } from '@kbn/test-jest-helpers';
import React from 'react';
import * as Rx from 'rxjs';
import { ReportingPanelProps as Props, ReportingPanelContent } from '.';
import { ReportingAPIClient } from '../../..';
import { ErrorUnsavedWorkPanel } from './components';
import * as constants from './constants';

jest.mock('./constants', () => ({
  getMaxUrlLength: jest.fn(() => 9999999),
}));

describe('ReportingPanelContent', () => {
  const props: Partial<Props> = {
    layoutId: 'super_cool_layout_id_X',
  };
  const jobParams = {
    appState: 'very_cool_app_state_X',
    objectType: 'noice_object',
    title: 'ultimate_title',
  };
  const http = httpServiceMock.createSetupContract();
  const uiSettings = uiSettingsServiceMock.createSetupContract();
  let apiClient: ReportingAPIClient;

  beforeEach(() => {
    props.layoutId = 'super_cool_layout_id_X';
    uiSettings.get.mockImplementation((key: string) => {
      switch (key) {
        case 'dateFormat:tz':
          return 'Mars';
      }
    });
    apiClient = new ReportingAPIClient(http, uiSettings, '7.15.0-test');
  });

  const { getStartServices } = coreMock.createSetup();
  const mountComponent = (newProps: Partial<Props>) =>
    mountWithIntl(
      <ReportingPanelContent
        requiresSavedState
        isDirty={true} // We have unsaved changes
        reportType="test"
        objectId="my-object-id"
        layoutId={props.layoutId}
        getJobParams={() => jobParams}
        apiClient={apiClient}
        startServices$={Rx.from(getStartServices())}
        {...props}
        {...newProps}
      />
    );

  describe('saved state', () => {
    it('prevents generating reports when saving is required and we have unsaved changes', () => {
      const wrapper = mountComponent({
        requiresSavedState: true,
        isDirty: true,
        objectId: undefined,
      });
      wrapper.update();
      expect(wrapper.find('[data-test-subj="generateReportButton"]').last().props().disabled).toBe(
        true
      );
    });

    it('allows generating reports when saving is not required', () => {
      const wrapper = mountComponent({
        requiresSavedState: false,
        isDirty: true,
        objectId: undefined,
      });
      wrapper.update();
      expect(wrapper.find('[data-test-subj="generateReportButton"]').last().props().disabled).toBe(
        false
      );
    });

    it('changing the layout triggers refreshing the state with the latest job params', () => {
      const wrapper = mountComponent({ requiresSavedState: false, isDirty: false });
      wrapper.update();
      expect(wrapper.find('EuiCopy').prop('textToCopy')).toMatchInlineSnapshot(
        `"http://localhost/api/reporting/generate/test?jobParams=%28appState%3Avery_cool_app_state_X%2CbrowserTimezone%3AMars%2CobjectType%3Anoice_object%2Ctitle%3Aultimate_title%2Cversion%3A%277.15.0-test%27%29"`
      );

      jobParams.appState = 'very_NOT_cool_app_state_Y';
      wrapper.setProps({ layoutId: 'super_cool_layout_id_Y' }); // update the component internal state
      wrapper.update();
      expect(wrapper.find('EuiCopy').prop('textToCopy')).toMatchInlineSnapshot(
        `"http://localhost/api/reporting/generate/test?jobParams=%28appState%3Avery_NOT_cool_app_state_Y%2CbrowserTimezone%3AMars%2CobjectType%3Anoice_object%2Ctitle%3Aultimate_title%2Cversion%3A%277.15.0-test%27%29"`
      );
    });
  });

  describe('copy post URL', () => {
    it('shows the copy button without warnings', () => {
      const wrapper = mountComponent({ requiresSavedState: false, isDirty: false });
      wrapper.update();
      expect(wrapper.exists('EuiCopy')).toBe(true);
      expect(wrapper.exists(ErrorUnsavedWorkPanel)).toBe(false);
    });

    it('does not show the copy button when there is unsaved state', () => {
      const wrapper = mountComponent({ requiresSavedState: false, isDirty: true });
      wrapper.update();
      expect(wrapper.exists('EuiCopy')).toBe(false);
      expect(wrapper.exists(ErrorUnsavedWorkPanel)).toBe(true);
    });

    it('does not show the copy button when the URL is too long', () => {
      (constants.getMaxUrlLength as jest.Mock).mockReturnValue(1);
      const wrapper = mountComponent({ requiresSavedState: false, isDirty: true });
      wrapper.update();

      expect(wrapper.exists('EuiCopy')).toBe(false);
      expect(wrapper.exists('[data-test-subj="urlTooLongTrySavingMessage"]')).toBe(true);
      expect(wrapper.exists('[data-test-subj="urlTooLongErrorMessage"]')).toBe(false);

      wrapper.setProps({ isDirty: false });
      expect(wrapper.exists('EuiCopy')).toBe(false);
      expect(wrapper.exists('[data-test-subj="urlTooLongTrySavingMessage"]')).toBe(false);
      expect(wrapper.exists('[data-test-subj="urlTooLongErrorMessage"]')).toBe(true);
    });
  });
});
