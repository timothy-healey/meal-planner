import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CategorySection } from '../../components/CategorySection';
import type { ShoppingItemRow } from '../../types/db';

const makeItem = (id: string, name: string, isOneoff = 0): ShoppingItemRow => ({
  id,
  plan_id: 'plan1',
  category: 'Produce',
  category_order: 0,
  item_order: 0,
  name,
  qty: '2',
  estimated_price: 3.5,
  is_oneoff: isOneoff as 0 | 1,
  note: null,
  is_checked: 0,
  actual_price: null,
  store: null,
});

describe('CategorySection', () => {
  it('renders the category header', () => {
    const { getByText } = render(
      <CategorySection
        category="Produce"
        items={[makeItem('a', 'Broccoli')]}
        isOneoff={false}
        onToggle={jest.fn()} onDelete={jest.fn()} onEdit={jest.fn()}
      />
    );
    expect(getByText('PRODUCE')).toBeTruthy();
  });

  it('renders all items', () => {
    const items = [makeItem('a', 'Broccoli'), makeItem('b', 'Spinach')];
    const { getByText } = render(
      <CategorySection category="Produce" items={items} isOneoff={false} onToggle={jest.fn()} onDelete={jest.fn()} onEdit={jest.fn()} />
    );
    expect(getByText('Broccoli')).toBeTruthy();
    expect(getByText('Spinach')).toBeTruthy();
  });

  it('calls onToggle with item id when item is pressed', () => {
    const onToggle = jest.fn();
    const { getByRole } = render(
      <CategorySection
        category="Produce"
        items={[makeItem('item_abc', 'Broccoli')]}
        isOneoff={false}
        onToggle={onToggle}
        onDelete={jest.fn()}
        onEdit={jest.fn()}
      />
    );
    fireEvent.press(getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledWith('item_abc');
  });

  it('passes isOneoff to CategoryHeader', () => {
    const { getByText } = render(
      <CategorySection
        category="One-Off Items"
        items={[makeItem('a', 'Salt', 1)]}
        isOneoff={true}
        onToggle={jest.fn()} onDelete={jest.fn()} onEdit={jest.fn()}
      />
    );
    expect(getByText('(check pantry first)')).toBeTruthy();
  });
});
