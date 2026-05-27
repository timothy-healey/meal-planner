import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { IngredientSheet } from '../../components/IngredientSheet';
import { useIngredientSuggestions } from '../../hooks/useIngredientSuggestions';
import { useFoodNutrition } from '../../hooks/useFoodNutrition';
import type { FoodNutritionRow } from '../../types/db';
import type { Ingredient } from '../../meal_plan.types';

jest.mock('../../components/PriceHistoryChart', () => ({
  PriceHistoryChart: () => null,
}));

jest.mock('../../hooks/useIngredientSuggestions');
jest.mock('../../hooks/useFoodNutrition');

// Default safe mocks. Specific tests override via mockReturnValue.
beforeEach(() => {
  (useIngredientSuggestions as jest.Mock).mockReturnValue({
    query: jest.fn().mockResolvedValue([]),
    invalidate: jest.fn(),
  });
  (useFoodNutrition as jest.Mock).mockReturnValue({
    getById: jest.fn(),
  });
});

const EXISTING: FoodNutritionRow = {
  id: 'test-id',
  item_name: 'oat milk',
  brand: 'Vitasoy',
  product_name: 'Oat Milk Barista',
  basis: 'per_100mL',
  cal_per_basis: 45,
  protein_per_basis: 1,
  carbs_per_basis: 4.5,
  fat_per_basis: 1.5,
  updated_at: '2026-05-24T00:00:00.000Z',
};

const ING: Ingredient = { item: 'Oat milk', amount: { kind: 'measured', value: 240, unit: 'mL' } };

describe('IngredientSheet', () => {
  it('pre-fills brand and product name from existingEntry', () => {
    const { getByDisplayValue } = render(
      <IngredientSheet
        visible={true}
        mode="edit"
        initialIngredient={ING}
        existingEntry={EXISTING}
        onSave={jest.fn()}
        onClose={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    expect(getByDisplayValue('Vitasoy')).toBeTruthy();
    expect(getByDisplayValue('Oat Milk Barista')).toBeTruthy();
  });

  it('pre-fills calorie value from existingEntry', () => {
    const { getByDisplayValue } = render(
      <IngredientSheet
        visible={true}
        mode="edit"
        initialIngredient={ING}
        existingEntry={EXISTING}
        onSave={jest.fn()}
        onClose={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    expect(getByDisplayValue('45')).toBeTruthy();
  });

  it('shows empty name input in add mode', () => {
    const { getByPlaceholderText } = render(
      <IngredientSheet
        visible={true}
        mode="add"
        initialIngredient={null}
        existingEntry={null}
        onSave={jest.fn()}
        onClose={jest.fn()}
      />
    );
    const input = getByPlaceholderText('Ingredient name');
    expect(input.props.value).toBe('');
  });

  it('renders the editable ingredient name from initialIngredient', () => {
    const { getByDisplayValue } = render(
      <IngredientSheet
        visible={true}
        mode="edit"
        initialIngredient={{ item: 'Brown rice', amount: { kind: 'measured', value: 200, unit: 'g' } }}
        existingEntry={null}
        onSave={jest.fn()}
        onClose={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    expect(getByDisplayValue('Brown rice')).toBeTruthy();
  });

  it('pre-fills the amount value and unit from initialIngredient', () => {
    const { getByDisplayValue, getByText } = render(
      <IngredientSheet
        visible={true}
        mode="edit"
        initialIngredient={{ item: 'Honey', amount: { kind: 'measured', value: 70, unit: 'g' } }}
        existingEntry={null}
        onSave={jest.fn()}
        onClose={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    expect(getByDisplayValue('70')).toBeTruthy();
    expect(getByText('grams (g)')).toBeTruthy();
  });

  it('pre-fills the custom unit when amount is custom', () => {
    const { getByDisplayValue } = render(
      <IngredientSheet
        visible={true}
        mode="edit"
        initialIngredient={{ item: 'Garlic', amount: { kind: 'custom', value: 3, unit: 'cloves' } }}
        existingEntry={null}
        onSave={jest.fn()}
        onClose={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    expect(getByDisplayValue('3')).toBeTruthy();
    expect(getByDisplayValue('cloves')).toBeTruthy();
  });

  it('emits unified onSave with ingredient + nutrition on Done press', () => {
    const onSave = jest.fn();
    const { getByText } = render(
      <IngredientSheet
        visible={true}
        mode="edit"
        initialIngredient={{ item: 'Honey', amount: { kind: 'measured', value: 70, unit: 'g' } }}
        existingEntry={EXISTING}
        onSave={onSave}
        onClose={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    fireEvent.press(getByText('Done'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      ingredient: { item: 'Honey', amount: { kind: 'measured', value: 70, unit: 'g' } },
      nutrition: expect.objectContaining({ brand: 'Vitasoy' }),
    }));
  });
});

describe('IngredientSheet × suggestions', () => {
  beforeEach(() => {
    (useIngredientSuggestions as jest.Mock).mockReturnValue({
      query: jest.fn().mockResolvedValue([
        {
          kind: 'product', brand: 'Vitasoy', productName: 'Oat Milk Barista',
          lastUsedAt: '2026-05-25T00:00:00Z', foodNutritionId: 'fn-1', matches: [],
        },
      ]),
      invalidate: jest.fn(),
    });
  });

  it('does not show the dropdown when ingredient name is empty', async () => {
    const { queryByText, getByPlaceholderText } = render(
      <IngredientSheet
        visible={true}
        mode="add"
        initialIngredient={null}
        existingEntry={null}
        onSave={jest.fn()}
        onClose={jest.fn()}
      />
    );
    fireEvent(getByPlaceholderText('e.g. Vitasoy'), 'focus');
    await new Promise(r => setTimeout(r, 0));
    expect(queryByText('Oat Milk Barista')).toBeNull();
  });

  it('shows the dropdown after name has ≥1 char and brand field is focused', async () => {
    const { findByText, getByPlaceholderText } = render(
      <IngredientSheet
        visible={true}
        mode="add"
        initialIngredient={{ item: 'milk', amount: { kind: 'measured', value: 250, unit: 'mL' } }}
        existingEntry={null}
        onSave={jest.fn()}
        onClose={jest.fn()}
      />
    );
    fireEvent(getByPlaceholderText('e.g. Vitasoy'), 'focus');
    expect(await findByText('Oat Milk Barista')).toBeTruthy();
  });
});

describe('IngredientSheet × selection', () => {
  beforeEach(() => {
    (useIngredientSuggestions as jest.Mock).mockReturnValue({
      query: jest.fn().mockResolvedValue([
        {
          kind: 'product', brand: 'Vitasoy', productName: 'Oat Milk Barista',
          lastUsedAt: '2026-05-25T00:00:00Z', foodNutritionId: 'fn-1', matches: [],
        },
      ]),
      invalidate: jest.fn(),
    });
    (useFoodNutrition as jest.Mock).mockReturnValue({
      getById: jest.fn().mockResolvedValue({
        id: 'fn-1', item_name: 'oat milk', brand: 'Vitasoy', product_name: 'Oat Milk Barista',
        basis: 'per_100mL', cal_per_basis: 50, protein_per_basis: 1.2, carbs_per_basis: 4.6, fat_per_basis: 1.5,
        updated_at: '2026-05-25T00:00:00Z',
      }),
    });
  });

  it('tapping a product suggestion fills brand + product + nutrition fields', async () => {
    const { findByText, getByPlaceholderText, getByDisplayValue } = render(
      <IngredientSheet
        visible={true}
        mode="add"
        initialIngredient={{ item: 'milk', amount: { kind: 'measured', value: 250, unit: 'mL' } }}
        existingEntry={null}
        onSave={jest.fn()}
        onClose={jest.fn()}
      />
    );
    fireEvent(getByPlaceholderText('e.g. Oat Milk Barista'), 'focus');
    const row = await findByText('Oat Milk Barista');
    fireEvent.press(row);
    await waitFor(() => expect(getByDisplayValue('Vitasoy')).toBeTruthy());
    await waitFor(() => expect(getByDisplayValue('Oat Milk Barista')).toBeTruthy());
    await waitFor(() => expect(getByDisplayValue('50')).toBeTruthy());
  });
});
