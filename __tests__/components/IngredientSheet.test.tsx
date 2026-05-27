import React from 'react';
import { render } from '@testing-library/react-native';
import { IngredientSheet } from '../../components/IngredientSheet';
import type { FoodNutritionRow } from '../../types/db';
import type { Ingredient } from '../../meal_plan.types';

jest.mock('../../components/PriceHistoryChart', () => ({
  PriceHistoryChart: () => null,
}));

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
});
