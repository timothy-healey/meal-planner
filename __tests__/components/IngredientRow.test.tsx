import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { IngredientRow } from '../../components/IngredientRow';
import type { Ingredient } from '../../meal_plan.types';

const ING: Ingredient = { item: 'Chicken breast', amount: '200g' };

describe('IngredientRow', () => {
  it('renders item name and amount', () => {
    const { getByText } = render(<IngredientRow ingredient={ING} />);
    expect(getByText('Chicken breast')).toBeTruthy();
    expect(getByText('200g')).toBeTruthy();
  });

  it('shows macro chip strip when nutrition provided', () => {
    const { getByLabelText } = render(
      <IngredientRow
        ingredient={ING}
        nutrition={{ protein_g: 62, carbs_g: 0, fat_g: 7.2 }}
        onPress={jest.fn()}
      />
    );
    expect(getByLabelText('62g protein, 0g carbs, 7g fat')).toBeTruthy();
  });

  it('shows "tap to add nutrition" hint when onPress provided but no nutrition', () => {
    const { getByText } = render(
      <IngredientRow ingredient={ING} onPress={jest.fn()} />
    );
    expect(getByText('tap to add nutrition')).toBeTruthy();
  });

  it('shows neither hint nor chips when no onPress and no nutrition', () => {
    const { queryByText } = render(<IngredientRow ingredient={ING} />);
    expect(queryByText('tap to add nutrition')).toBeNull();
    expect(queryByText('P 0g')).toBeNull();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <IngredientRow ingredient={ING} onPress={onPress} />
    );
    fireEvent.press(getByText('Chicken breast'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
