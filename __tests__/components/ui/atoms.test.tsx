import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Row } from '../../../components/ui/Row';
import { Card } from '../../../components/ui/Card';
import { Pill } from '../../../components/ui/Pill';
import { Divider } from '../../../components/ui/Divider';
import { Checkbox } from '../../../components/ui/Checkbox';

describe('Row', () => {
  it('renders children in a row', () => {
    const { getByText } = render(
      <Row><Text>A</Text><Text>B</Text></Row>
    );
    expect(getByText('A')).toBeTruthy();
    expect(getByText('B')).toBeTruthy();
  });
});

describe('Card', () => {
  it('renders children', () => {
    const { getByText } = render(<Card><Text>content</Text></Card>);
    expect(getByText('content')).toBeTruthy();
  });
});

describe('Pill', () => {
  it('renders label', () => {
    const { getByText } = render(<Pill label="Import" onPress={() => {}} />);
    expect(getByText('Import')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Pill label="Import" onPress={onPress} />);
    fireEvent.press(getByText('Import'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('Checkbox', () => {
  it('renders unchecked by default', () => {
    const { getByTestId } = render(<Checkbox checked={false} testID="cb" />);
    expect(getByTestId('cb')).toBeTruthy();
  });

  it('renders checked state with accessible label', () => {
    const { getByRole } = render(
      <Checkbox checked={true} accessibilityLabel="Chicken thighs" />
    );
    expect(getByRole('checkbox', { checked: true })).toBeTruthy();
  });
});
