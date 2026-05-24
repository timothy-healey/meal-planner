import React from 'react';
import { render } from '@testing-library/react-native';
import { FoodNutritionSheet } from '../../components/FoodNutritionSheet';
import type { FoodNutritionRow } from '../../types/db';

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

describe('FoodNutritionSheet', () => {
  it('pre-fills brand and product name from existingEntry', () => {
    const { getByDisplayValue } = render(
      <FoodNutritionSheet
        visible={true}
        ingredientName="Oat milk"
        ingredientAmount="240mL"
        existingEntry={EXISTING}
        onSave={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(getByDisplayValue('Vitasoy')).toBeTruthy();
    expect(getByDisplayValue('Oat Milk Barista')).toBeTruthy();
  });

  it('pre-fills calorie value from existingEntry', () => {
    const { getByDisplayValue } = render(
      <FoodNutritionSheet
        visible={true}
        ingredientName="Oat milk"
        ingredientAmount="240mL"
        existingEntry={EXISTING}
        onSave={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(getByDisplayValue('45')).toBeTruthy();
  });

  it('shows empty inputs when existingEntry is null', () => {
    const { queryByDisplayValue } = render(
      <FoodNutritionSheet
        visible={true}
        ingredientName="Brown rice"
        ingredientAmount="200g"
        existingEntry={null}
        onSave={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(queryByDisplayValue('Vitasoy')).toBeNull();
    expect(queryByDisplayValue('45')).toBeNull();
  });

  it('displays the ingredient name as heading', () => {
    const { getByText } = render(
      <FoodNutritionSheet
        visible={true}
        ingredientName="Brown rice"
        ingredientAmount="200g"
        existingEntry={null}
        onSave={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(getByText('Brown rice')).toBeTruthy();
  });
});
