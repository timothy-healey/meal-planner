import React from 'react';
import { render } from '@testing-library/react-native';
import { CategoryHeader } from '../../../components/ui/CategoryHeader';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { EmptyState } from '../../../components/ui/EmptyState';

describe('CategoryHeader', () => {
  it('renders label text in uppercase', () => {
    const { getByText } = render(<CategoryHeader label="Meat & Seafood" />);
    expect(getByText('MEAT & SEAFOOD')).toBeTruthy();
  });

  it('renders pantry note for isOneoff', () => {
    const { getByText } = render(
      <CategoryHeader label="Pantry" isOneoff />
    );
    expect(getByText('(check pantry first)')).toBeTruthy();
  });
});

describe('ProgressBar', () => {
  it('renders without crashing at 0%', () => {
    const { toJSON } = render(<ProgressBar progress={0} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders without crashing at 100%', () => {
    const { toJSON } = render(<ProgressBar progress={1} />);
    expect(toJSON()).toBeTruthy();
  });
});

describe('EmptyState', () => {
  it('shows default message and import button', () => {
    const { getByText } = render(<EmptyState onImport={() => {}} />);
    expect(getByText("The pantry's empty. Drop in a meal plan to see your week.")).toBeTruthy();
    expect(getByText('Import meal plan')).toBeTruthy();
  });
});
