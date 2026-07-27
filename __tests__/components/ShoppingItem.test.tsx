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

describe('ShoppingItem — derived-line affordances', () => {
  it('hides the price when it is zero rather than showing $0.00', () => {
    // Derived lines carry no estimate; Review mode captures the real price.
    const { queryByText } = render(
      <ShoppingItem item={{ ...ITEM, estimated_price: 0 }} onToggle={jest.fn()} />
    );
    expect(queryByText('$0.00')).toBeNull();
  });

  it('still shows a real price', () => {
    const { getByText } = render(
      <ShoppingItem item={{ ...ITEM, estimated_price: 4.5 }} onToggle={jest.fn()} />
    );
    expect(getByText('$4.50')).toBeTruthy();
  });

  it('marks a checked line whose recipe has moved on', () => {
    const { getByLabelText } = render(
      <ShoppingItem
        item={{ ...ITEM, is_checked: 1, item_key: 'name:beef', qty: '500 g', planned_qty: '750 g' }}
        onToggle={jest.fn()}
      />
    );
    expect(getByLabelText('recipe now calls for 750 g')).toBeTruthy();
  });

  it('does not mark a line that still matches its recipe', () => {
    const { queryByLabelText } = render(
      <ShoppingItem
        item={{ ...ITEM, item_key: 'name:beef', qty: '750 g', planned_qty: '750 g' }}
        onToggle={jest.fn()}
      />
    );
    expect(queryByLabelText(/recipe now calls for/i)).toBeNull();
  });

  it('does not mark a manual row as stale', () => {
    const { queryByLabelText } = render(
      <ShoppingItem
        item={{ ...ITEM, item_key: null, planned_qty: null }}
        onToggle={jest.fn()}
      />
    );
    expect(queryByLabelText(/recipe now calls for/i)).toBeNull();
  });
});
