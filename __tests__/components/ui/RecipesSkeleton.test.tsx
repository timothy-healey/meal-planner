import React from 'react';
import { render } from '@testing-library/react-native';
import { RecipesSkeleton } from '../../../components/ui/RecipesSkeleton';

describe('RecipesSkeleton', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<RecipesSkeleton />);
    expect(toJSON()).toBeTruthy();
  });
});
