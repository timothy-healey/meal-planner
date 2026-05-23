import React from 'react';
import { render } from '@testing-library/react-native';
import { TodayCard } from '../../components/TodayCard';

const DAY = {
  day: 'Monday',
  breakfast: 'Overnight oats',
  lunch: 'Chicken burrito',
  dinner: 'Beef stew',
  calories: 2000,
  protein_g: 140,
};

describe('TodayCard', () => {
  it('renders day name', () => {
    const { getByText } = render(<TodayCard day={DAY} />);
    expect(getByText('Monday')).toBeTruthy();
  });

  it('renders TODAY badge', () => {
    const { getByText } = render(<TodayCard day={DAY} />);
    expect(getByText('TODAY')).toBeTruthy();
  });

  it('renders B/L/D meal names', () => {
    const { getByText } = render(<TodayCard day={DAY} />);
    expect(getByText('Overnight oats')).toBeTruthy();
    expect(getByText('Chicken burrito')).toBeTruthy();
    expect(getByText('Beef stew')).toBeTruthy();
  });

  it('renders calorie value in footer', () => {
    const { getByText } = render(<TodayCard day={DAY} />);
    expect(getByText('2000 cal')).toBeTruthy();
  });

  it('renders protein value in footer', () => {
    const { getByText } = render(<TodayCard day={DAY} />);
    expect(getByText('140g protein')).toBeTruthy();
  });
});
