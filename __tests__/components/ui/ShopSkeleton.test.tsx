import React from 'react';
import { render } from '@testing-library/react-native';
import { ShopSkeleton } from '../../../components/ui/ShopSkeleton';

describe('ShopSkeleton', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<ShopSkeleton />);
    expect(toJSON()).toBeTruthy();
  });
});
