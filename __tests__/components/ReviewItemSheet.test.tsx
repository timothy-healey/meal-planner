import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ReviewItemSheet } from '../../components/ReviewItemSheet';
import { useIngredientSuggestions } from '../../hooks/useIngredientSuggestions';
import type { ShoppingItemRow } from '../../types/db';

jest.mock('../../components/PriceHistoryChart', () => ({
  PriceHistoryChart: () => null,
}));

jest.mock('../../hooks/useIngredientSuggestions');

beforeEach(() => {
  (useIngredientSuggestions as jest.Mock).mockReturnValue({
    query: jest.fn().mockResolvedValue([]),
    invalidate: jest.fn(),
  });
});

const ITEM: ShoppingItemRow = {
  id: 'i-1',
  plan_id: 'p-1',
  category: 'Dairy',
  category_order: 0,
  item_order: 0,
  name: 'milk',
  qty: '1L',
  estimated_price: 4,
  is_oneoff: 0,
  note: null,
  is_checked: 0,
};

function baseProps() {
  return {
    visible: true,
    item: ITEM,
    store: 'Coles',
    branch: 'CBD',
    latestRecord: null,
    pendingRow: null,
    pendingScan: null,
    onSave: jest.fn(),
    onClose: jest.fn(),
    onPendingScanConsumed: jest.fn(),
  };
}

describe('ReviewItemSheet × suggestions', () => {
  it('shows a brand suggestion when the brand field is focused', async () => {
    (useIngredientSuggestions as jest.Mock).mockReturnValue({
      query: jest.fn().mockResolvedValue([
        { kind: 'brand', brand: 'Pauls', productName: null, productCount: 2,
          latestProductName: 'Full Cream', lastUsedAt: '2026-05-26T00:00:00Z',
          foodNutritionId: null, matches: [] },
      ]),
      invalidate: jest.fn(),
    });

    const { findByText, getByPlaceholderText } = render(<ReviewItemSheet {...baseProps()} />);
    fireEvent(getByPlaceholderText('e.g. Coles, Macro, Lilydale'), 'focus');
    expect(await findByText('Pauls')).toBeTruthy();
  });

  it('tapping a product suggestion fills brand + product but leaves price/qty alone', async () => {
    (useIngredientSuggestions as jest.Mock).mockReturnValue({
      query: jest.fn().mockResolvedValue([
        { kind: 'product', brand: 'Pauls', productName: 'Full Cream',
          lastUsedAt: '2026-05-26T00:00:00Z', foodNutritionId: 'fn-1', matches: [] },
      ]),
      invalidate: jest.fn(),
    });

    const { findByText, getByPlaceholderText, getByDisplayValue } = render(<ReviewItemSheet {...baseProps()} />);
    fireEvent(getByPlaceholderText('e.g. RSPCA Chicken Breast'), 'focus');
    fireEvent.press(await findByText('Full Cream'));
    await waitFor(() => expect(getByDisplayValue('Pauls')).toBeTruthy());
    await waitFor(() => expect(getByDisplayValue('Full Cream')).toBeTruthy());
  });

  it('does not render the pie-chart emblem (no nutrition autofill in this sheet)', async () => {
    (useIngredientSuggestions as jest.Mock).mockReturnValue({
      query: jest.fn().mockResolvedValue([
        { kind: 'product', brand: 'Pauls', productName: 'Full Cream',
          lastUsedAt: '2026-05-26T00:00:00Z', foodNutritionId: 'fn-1', matches: [] },
      ]),
      invalidate: jest.fn(),
    });

    const { findByText, getByPlaceholderText, queryAllByTestId } = render(<ReviewItemSheet {...baseProps()} />);
    fireEvent(getByPlaceholderText('e.g. RSPCA Chicken Breast'), 'focus');
    await findByText('Full Cream');
    expect(queryAllByTestId('suggestion-emblem')).toHaveLength(0);
  });
});
