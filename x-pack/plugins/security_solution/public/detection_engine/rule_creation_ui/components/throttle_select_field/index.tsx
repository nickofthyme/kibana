/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback } from 'react';

import {
  NOTIFICATION_THROTTLE_RULE,
  NOTIFICATION_THROTTLE_NO_ACTIONS,
} from '../../../../../common/constants';
import { SelectField } from '../../../../shared_imports';

export const THROTTLE_OPTIONS_FOR_BULK_RULE_ACTIONS = [
  { value: NOTIFICATION_THROTTLE_RULE, text: 'On each rule execution' },
  { value: '1h', text: 'Hourly' },
  { value: '1d', text: 'Daily' },
  { value: '7d', text: 'Weekly' },
];

export const THROTTLE_OPTIONS_FOR_RULE_CREATION_AND_EDITING = [
  { value: NOTIFICATION_THROTTLE_NO_ACTIONS, text: 'Perform no actions' },
  ...THROTTLE_OPTIONS_FOR_BULK_RULE_ACTIONS,
];

export const DEFAULT_THROTTLE_OPTION = THROTTLE_OPTIONS_FOR_RULE_CREATION_AND_EDITING[0];

type ThrottleSelectField = typeof SelectField;

export const ThrottleSelectField: ThrottleSelectField = (props) => {
  const { setValue } = props.field;
  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const throttle = e.target.value;
      setValue(throttle);
    },
    [setValue]
  );
  const newEuiFieldProps = { ...props.euiFieldProps, onChange };
  return <SelectField {...props} euiFieldProps={newEuiFieldProps} />;
};
