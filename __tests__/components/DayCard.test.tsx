import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DayCard } from '../../components/DayCard';

const DAY = {
  day: 'Tuesday',
  breakfast: 'Overnight oats',
  lunch: 'Tuna wrap',
  dinner: 'Chicken soup',
  calories: 2000,
  protein_g: 138,
};

describe('DayCard', () => {
  it('renders day name', () => {
    const { getByText } = render(<DayCard day={DAY} isFirst={false} isLast={false} />);
    expect(getByText('Tuesday')).toBeTruthy();
  });

  it('renders cal and protein', () => {
    const { getByText } = render(<DayCard day={DAY} isFirst={false} isLast={false} />);
    expect(getByText('2000 cal')).toBeTruthy();
    expect(getByText('138g protein')).toBeTruthy();
  });

  it('renders B / L / D meal names', () => {
    const { getByText } = render(<DayCard day={DAY} isFirst={false} isLast={false} />);
    expect(getByText('Overnight oats')).toBeTruthy();
    expect(getByText('Tuna wrap')).toBeTruthy();
    expect(getByText('Chicken soup')).toBeTruthy();
  });

  it('renders B / L / D prefix letters', () => {
    const { getAllByText } = render(<DayCard day={DAY} isFirst={false} isLast={false} />);
    expect(getAllByText('B').length).toBeGreaterThan(0);
    expect(getAllByText('L').length).toBeGreaterThan(0);
    expect(getAllByText('D').length).toBeGreaterThan(0);
  });

  it('calls onPress when tapped and onPress is provided', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <DayCard day={DAY} isFirst={false} isLast={false} onPress={onPress} />
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not render as a button when onPress is absent', () => {
    const { queryByRole } = render(<DayCard day={DAY} isFirst={false} isLast={false} />);
    expect(queryByRole('button')).toBeNull();
  });
});
