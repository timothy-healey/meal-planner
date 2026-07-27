import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ShoppingItem } from '../../components/ShoppingItem';
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
  is_checked: 0,
  item_key: null,
  planned_qty: null,
};

const ITEM_WITH_NOTE: ShoppingItemRow = { ...ITEM, id: 'plan1_0_1', note: 'Free range' };

describe('ShoppingItem', () => {
  it('renders item name', () => {
    const { getByText } = render(<ShoppingItem item={ITEM} onToggle={jest.fn()} />);
    expect(getByText('Chicken thighs')).toBeTruthy();
  });

  it('renders qty and formatted price', () => {
    const { getByText } = render(<ShoppingItem item={ITEM} onToggle={jest.fn()} />);
    expect(getByText('1.2 kg ·')).toBeTruthy();
    expect(getByText('$8.50')).toBeTruthy();
  });

  it('renders note when present', () => {
    const { getByText } = render(<ShoppingItem item={ITEM_WITH_NOTE} onToggle={jest.fn()} />);
    expect(getByText('Free range')).toBeTruthy();
  });

  it('does not render note when absent', () => {
    const { queryByText } = render(<ShoppingItem item={ITEM} onToggle={jest.fn()} />);
    expect(queryByText('Free range')).toBeNull();
  });

  it('calls onToggle when row is pressed', () => {
    const onToggle = jest.fn();
    const { getByRole } = render(<ShoppingItem item={ITEM} onToggle={onToggle} />);
    fireEvent.press(getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
