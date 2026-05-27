import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RecipeCard } from '../../components/RecipeCard';
import type { Recipe } from '../../hooks/useRecipes';

const RECIPE: Recipe = {
  id: 'beef_stew',
  title: 'Slow Cooker Beef Stew',
  meal_type: 'dinner',
  servings: 4,
  calories_per_serve: 480,
  protein_per_serve_g: 38,
  cook_method: 'crockpot',
  prep_minutes: 20,
  cook_minutes: 480,
  ingredients: [],
  method_steps: [],
  is_favourite: false,
  notes: null,
};

describe('RecipeCard', () => {
  it('renders recipe title', () => {
    const { getByText } = render(<RecipeCard recipe={RECIPE} onPress={jest.fn()} />);
    expect(getByText('Slow Cooker Beef Stew')).toBeTruthy();
  });

  it('renders calorie value', () => {
    const { getByText } = render(<RecipeCard recipe={RECIPE} onPress={jest.fn()} />);
    expect(getByText('480 cal')).toBeTruthy();
  });

  it('renders protein value', () => {
    const { getByText } = render(<RecipeCard recipe={RECIPE} onPress={jest.fn()} />);
    expect(getByText('38g protein')).toBeTruthy();
  });

  it('renders time as Nh when cook_minutes >= 60', () => {
    const { getByText } = render(<RecipeCard recipe={RECIPE} onPress={jest.fn()} />);
    expect(getByText('8h')).toBeTruthy();
  });

  it('renders time as N min when cook_minutes < 60', () => {
    const quickRecipe: Recipe = { ...RECIPE, prep_minutes: 10, cook_minutes: 20 };
    const { getByText } = render(<RecipeCard recipe={quickRecipe} onPress={jest.fn()} />);
    expect(getByText('30 min')).toBeTruthy();
  });

  it('calls onPress when card is tapped', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<RecipeCard recipe={RECIPE} onPress={onPress} />);
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
