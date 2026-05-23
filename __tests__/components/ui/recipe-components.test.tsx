import React from 'react';
import { render } from '@testing-library/react-native';
import { StatStrip } from '../../../components/ui/StatStrip';
import { StepList } from '../../../components/ui/StepList';

describe('StatStrip', () => {
  const stats = [
    { label: 'Cal', value: '650', highlight: true },
    { label: 'Protein', value: '48g', highlight: false },
    { label: 'Serves', value: '3', highlight: false },
    { label: 'Cook', value: '8h', highlight: false },
  ];

  it('renders all stat labels', () => {
    const { getByText } = render(<StatStrip stats={stats} />);
    expect(getByText('Cal')).toBeTruthy();
    expect(getByText('Protein')).toBeTruthy();
    expect(getByText('Serves')).toBeTruthy();
    expect(getByText('Cook')).toBeTruthy();
  });

  it('renders all stat values', () => {
    const { getByText } = render(<StatStrip stats={stats} />);
    expect(getByText('650')).toBeTruthy();
    expect(getByText('48g')).toBeTruthy();
  });
});

describe('StepList', () => {
  const steps = ['Chop vegetables', 'Brown the beef', 'Slow cook 8 hours'];

  it('renders all steps', () => {
    const { getByText } = render(<StepList steps={steps} />);
    expect(getByText('Chop vegetables')).toBeTruthy();
    expect(getByText('Brown the beef')).toBeTruthy();
    expect(getByText('Slow cook 8 hours')).toBeTruthy();
  });

  it('renders step numbers 1 to N', () => {
    const { getByText } = render(<StepList steps={steps} />);
    expect(getByText('1')).toBeTruthy();
    expect(getByText('2')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
  });

  it('renders fallback paragraph when steps is empty and method is provided', () => {
    const { getByText } = render(<StepList steps={[]} method="Cook everything together." />);
    expect(getByText('Cook everything together.')).toBeTruthy();
  });
});
