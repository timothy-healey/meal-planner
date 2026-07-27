import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { RecipeCard } from '../../components/RecipeCard';
import { colors } from '../../constants/tokens';
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

describe('RecipeCard — in-plan marker', () => {
  it('shows no marker by default', () => {
    const { queryByText } = render(<RecipeCard recipe={RECIPE} onPress={jest.fn()} />);
    expect(queryByText('THIS WEEK')).toBeNull();
  });

  it('marks a recipe that is in the active plan', () => {
    const { getByText } = render(<RecipeCard recipe={RECIPE} onPress={jest.fn()} inPlan />);
    expect(getByText('THIS WEEK')).toBeTruthy();
  });

  it('announces in-plan status to screen readers', () => {
    const { getByLabelText } = render(
      <RecipeCard recipe={RECIPE} onPress={jest.fn()} inPlan />);
    expect(getByLabelText(/in this week's plan/i)).toBeTruthy();
  });

  it('uses terracotta, not orange — the marker is taxonomy, not an action', () => {
    // DESIGN.md reserves orange for verbs and headline numbers.
    const { getByText } = render(<RecipeCard recipe={RECIPE} onPress={jest.fn()} inPlan />);
    const style = StyleSheet.flatten(getByText('THIS WEEK').props.style);
    expect(style.color).toBe(colors.terracotta);
  });

  it('still opens the recipe when marked', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <RecipeCard recipe={RECIPE} onPress={onPress} inPlan />);
    fireEvent.press(getByLabelText(/in this week's plan/i));
    expect(onPress).toHaveBeenCalled();
  });
});
