import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AddItemSheet } from '../../components/AddItemSheet';
import type { ShoppingItemRow } from '../../types/db';

const CATEGORIES = ['Fresh Produce', 'Freezer', 'Dairy'];

const ITEM: ShoppingItemRow = {
  id: 'item1',
  plan_id: 'plan1',
  category: 'Fresh Produce',
  category_order: 0,
  item_order: 0,
  name: 'Mixed berries',
  qty: '1 bag',
  estimated_price: 6,
  is_oneoff: 0,
  note: null,
  is_checked: 0,
  actual_price: null,
  store: null,
};

const ITEM_WITH_NOTE: ShoppingItemRow = { ...ITEM, id: 'item2', note: 'Buy frozen' };

describe('AddItemSheet — note field', () => {
  it('hides note field by default in add mode', () => {
    const { queryByLabelText } = render(
      <AddItemSheet
        visible
        categories={CATEGORIES}
        onAdd={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(queryByLabelText('Note, optional')).toBeNull();
  });

  it('reveals note field when "+ Add note" is pressed', () => {
    const { getByLabelText } = render(
      <AddItemSheet
        visible
        categories={CATEGORIES}
        onAdd={jest.fn()}
        onClose={jest.fn()}
      />
    );
    fireEvent.press(getByLabelText('Add note'));
    expect(getByLabelText('Note, optional')).toBeTruthy();
  });
});

describe('AddItemSheet — edit mode', () => {
  it('shows "Edit item" title when initialItem is provided', () => {
    const { getByText } = render(
      <AddItemSheet
        visible
        categories={CATEGORIES}
        onAdd={jest.fn()}
        onSave={jest.fn()}
        onClose={jest.fn()}
        initialItem={ITEM}
      />
    );
    expect(getByText('Edit item')).toBeTruthy();
  });

  it('shows "Save changes" CTA in edit mode', () => {
    const { getByText } = render(
      <AddItemSheet
        visible
        categories={CATEGORIES}
        onAdd={jest.fn()}
        onSave={jest.fn()}
        onClose={jest.fn()}
        initialItem={ITEM}
      />
    );
    expect(getByText('Save changes')).toBeTruthy();
  });

  it('pre-populates name field from initialItem', () => {
    const { getByDisplayValue } = render(
      <AddItemSheet
        visible
        categories={CATEGORIES}
        onAdd={jest.fn()}
        onSave={jest.fn()}
        onClose={jest.fn()}
        initialItem={ITEM}
      />
    );
    expect(getByDisplayValue('Mixed berries')).toBeTruthy();
  });

  it('expands note field when initialItem has a note', () => {
    const { getByLabelText } = render(
      <AddItemSheet
        visible
        categories={CATEGORIES}
        onAdd={jest.fn()}
        onSave={jest.fn()}
        onClose={jest.fn()}
        initialItem={ITEM_WITH_NOTE}
      />
    );
    expect(getByLabelText('Note, optional')).toBeTruthy();
  });

  it('calls onSave (not onAdd) when Save changes is pressed', () => {
    const onAdd = jest.fn();
    const onSave = jest.fn();
    const { getByLabelText } = render(
      <AddItemSheet
        visible
        categories={CATEGORIES}
        onAdd={onAdd}
        onSave={onSave}
        onClose={jest.fn()}
        initialItem={ITEM}
      />
    );
    fireEvent.press(getByLabelText('Save changes'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('item1', {
      name: 'Mixed berries',
      qty: '1 bag',
      estimatedPrice: 6,
      category: 'Fresh Produce',
      note: null,
    });
    expect(onAdd).not.toHaveBeenCalled();
  });
});
