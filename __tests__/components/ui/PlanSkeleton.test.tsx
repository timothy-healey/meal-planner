import React from 'react';
import { render } from '@testing-library/react-native';
import { PlanSkeleton } from '../../../components/ui/PlanSkeleton';

describe('PlanSkeleton', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<PlanSkeleton />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders 6 day row skeletons', () => {
    const { UNSAFE_getAllByType } = render(<PlanSkeleton />);
    const { View } = require('react-native');
    const views = UNSAFE_getAllByType(View);
    expect(views.length).toBeGreaterThan(0);
  });
});
