import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BasketSection } from '../../components/BasketSection';
import type { ShoppingItemRow } from '../../types/db';

const makeItem = (id: string, name: string): ShoppingItemRow => ({
  id,
  plan_id: 'plan1',
  category: 'Produce',
  category_order: 1,
  item_order: 0,
  name,
  qty: '1',
  estimated_price: 2,
  is_oneoff: 0,
  note: null,
  is_checked: 1,
  actual_price: null,
  store: null,
});

const DEFAULT_PROPS = {
  onToggle: jest.fn(),
  onDelete: jest.fn(),
  onEdit: jest.fn(),
};

describe('BasketSection', () => {
  it('shows "IN BASKET" header with count', () => {
    const items = [makeItem('a', 'Milk'), makeItem('b', 'Eggs')];
    const { getByText } = render(<BasketSection items={items} {...DEFAULT_PROPS} />);
    expect(getByText('IN BASKET (2)')).toBeTruthy();
  });

  it('shows hint text', () => {
    const items = [makeItem('a', 'Milk')];
    const { getByText } = render(<BasketSection items={items} {...DEFAULT_PROPS} />);
    expect(getByText('Tap any item to put it back')).toBeTruthy();
  });

  it('renders item names when expanded (default)', () => {
    const items = [makeItem('a', 'Milk'), makeItem('b', 'Eggs')];
    const { getByText } = render(<BasketSection items={items} {...DEFAULT_PROPS} />);
    expect(getByText('Milk')).toBeTruthy();
    expect(getByText('Eggs')).toBeTruthy();
  });

  it('collapses item list when header is pressed', () => {
    const items = [makeItem('a', 'Milk')];
    const { getByText, queryByText } = render(
      <BasketSection items={items} {...DEFAULT_PROPS} />
    );
    fireEvent.press(getByText('IN BASKET (1)'));
    expect(queryByText('Milk')).toBeNull();
  });

  it('calls onToggle with item id when item is pressed', () => {
    const onToggle = jest.fn();
    const items = [makeItem('a', 'Milk')];
    const { getAllByRole } = render(
      <BasketSection items={items} onToggle={onToggle} onDelete={jest.fn()} onEdit={jest.fn()} />
    );
    const checkbox = getAllByRole('checkbox')[0];
    fireEvent.press(checkbox);
    expect(onToggle).toHaveBeenCalledWith('a');
  });
});
