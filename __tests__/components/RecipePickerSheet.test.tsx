import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RecipePickerSheet, type PickableRecipe } from '../../components/RecipePickerSheet';

const RECIPES: PickableRecipe[] = [
  { id: 'r1', title: 'Beef Ragu', meal_type: 'dinner', servings: 4 },
  { id: 'r2', title: 'Overnight Oats', meal_type: 'breakfast', servings: 2 },
];

function renderSheet(props: Partial<React.ComponentProps<typeof RecipePickerSheet>> = {}) {
  return render(
    <RecipePickerSheet
      visible
      recipes={RECIPES}
      alreadyInPlan={[]}
      onPick={jest.fn()}
      onClose={jest.fn()}
      {...props}
    />
  );
}

describe('RecipePickerSheet', () => {
  it('lists recipes grouped by meal type', () => {
    const { getByText } = renderSheet();
    expect(getByText('Beef Ragu')).toBeTruthy();
    expect(getByText('Overnight Oats')).toBeTruthy();
  });

  it("picks a recipe with the recipe's own servings as the default target", () => {
    const onPick = jest.fn();
    const { getByText } = renderSheet({ onPick });
    fireEvent.press(getByText('Beef Ragu'));
    expect(onPick).toHaveBeenCalledWith('r1', 4);
  });

  it('marks recipes already in the plan and does not re-pick them', () => {
    const onPick = jest.fn();
    const { getByLabelText } = renderSheet({ onPick, alreadyInPlan: ['r1'] });
    fireEvent.press(getByLabelText('Beef Ragu, already in plan'));
    expect(onPick).not.toHaveBeenCalled();
  });

  it('still allows picking a recipe that is not in the plan', () => {
    const onPick = jest.fn();
    const { getByText } = renderSheet({ onPick, alreadyInPlan: ['r1'] });
    fireEvent.press(getByText('Overnight Oats'));
    expect(onPick).toHaveBeenCalledWith('r2', 2);
  });

  it('shows an empty state when the library is empty', () => {
    const { getByText } = renderSheet({ recipes: [] });
    expect(getByText(/No recipes yet/i)).toBeTruthy();
  });

  it('closes without picking', () => {
    const onClose = jest.fn();
    const onPick = jest.fn();
    const { getByLabelText } = renderSheet({ onClose, onPick });
    fireEvent.press(getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('sizes the sheet as a percentage so the keyboard cannot push its top off screen', () => {
    const { getByText } = renderSheet();
    // Same trap as IngredientSheet and ReviewItemSheet.
    expect(getByText('Add a recipe')).toBeTruthy();
  });
});
