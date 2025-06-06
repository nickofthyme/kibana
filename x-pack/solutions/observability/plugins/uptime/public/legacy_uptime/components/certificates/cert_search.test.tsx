/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
// Necessary until components being tested are migrated of styled-components https://github.com/elastic/kibana/issues/219037
import 'jest-styled-components';
import { renderWithRouter, shallowWithRouter } from '../../lib';
import { CertificateSearch } from './cert_search';

describe('CertificatesSearch', () => {
  it('shallow renders expected elements for valid props', () => {
    // dive() removes all unnecessary React-Router wrapping elements
    expect(shallowWithRouter(<CertificateSearch setSearch={jest.fn()} />).dive()).toMatchSnapshot();
  });
  it('renders expected elements for valid props', () => {
    expect(renderWithRouter(<CertificateSearch setSearch={jest.fn()} />)).toMatchSnapshot();
  });
});
