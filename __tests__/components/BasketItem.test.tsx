import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { BasketItem } from '../../components/BasketItem';
import type { ShoppingItemRow } from '../../types/db';

const ITEM: ShoppingItemRow = {
  id: 'plan1_0_0',
  plan_id: 'plan1',
  category: 'Meat & Seafood',
  category_order: 0,
  item_order: 0,
  name: 'Chicken thighs',
  qty: '1.2 kg',
  estimated_price: 8.5,
  is_oneoff: 0,
  note: null,
  is_checked: 1,
  actual_price: null,
  store: null,
};

describe('BasketItem', () => {
  it('renders item name with strikethrough', () => {
    const { getByText } = render(<BasketItem item={ITEM} onToggle={jest.fn()} />);
    const nameEl = getByText('Chicken thighs');
    expect(nameEl).toBeTruthy();
    // strikethrough is applied via style
    expect(StyleSheet.flatten(nameEl.props.style)).toMatchObject({ textDecorationLine: 'line-through' });
  });

  it('renders category label below name', () => {
    const { getByText } = render(<BasketItem item={ITEM} onToggle={jest.fn()} />);
    expect(getByText('Meat & Seafood')).toBeTruthy();
  });

  it('has accessibilityState checked=true', () => {
    const { getByRole } = render(<BasketItem item={ITEM} onToggle={jest.fn()} />);
    const checkbox = getByRole('checkbox');
    expect(checkbox.props.accessibilityState).toEqual({ checked: true });
  });

  it('calls onToggle when row is pressed', () => {
    const onToggle = jest.fn();
    const { getByRole } = render(<BasketItem item={ITEM} onToggle={onToggle} />);
    fireEvent.press(getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
