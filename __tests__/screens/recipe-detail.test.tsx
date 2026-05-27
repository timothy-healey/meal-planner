import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockUpdateNotes = jest.fn().mockResolvedValue(undefined);
const mockGetLinksForRecipe = jest.fn().mockResolvedValue({});

const mockRecipeBase = {
  id: 'r1',
  title: 'Chicken Stir-fry',
  meal_type: 'dinner',
  servings: 3,
  calories_per_serve: 480,
  protein_per_serve_g: 38,
  cook_method: 'stir-fry',
  prep_minutes: 10,
  cook_minutes: 15,
  ingredients: [
    { item: 'Chicken breast', amount: { kind: 'measured', value: 600, unit: 'g' } },
  ],
  method_steps: ['Brown the chicken.', 'Add broccoli.'],
  is_favourite: false,
  notes: null as string | null,
};

const mockRecipesState = { current: [{ ...mockRecipeBase }] };

jest.mock('../../hooks/useRecipes', () => ({
  useRecipes: () => ({
    recipes: mockRecipesState.current,
    loading: false,
    getById: jest.fn(),
    updateNotes: mockUpdateNotes,
  }),
}));

jest.mock('../../hooks/useFoodNutrition', () => ({
  useFoodNutrition: () => ({
    upsert: jest.fn(),
    linkIngredient: jest.fn(),
    getLinksForRecipe: mockGetLinksForRecipe,
  }),
}));

jest.mock('../../hooks/useRecipeIngredients', () => ({
  useRecipeIngredients: () => ({
    updateIngredient: jest.fn(),
    addIngredient: jest.fn(),
    deleteIngredient: jest.fn(),
  }),
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ id: 'r1' }),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

// IngredientSheet reaches into useIngredientSuggestions which calls useDb.
// Stable refs avoid render-loop on the consuming useEffect's dep array.
const mockSuggestionQuery = jest.fn().mockResolvedValue([]);
const mockSuggestionInvalidate = jest.fn();
jest.mock('../../hooks/useIngredientSuggestions', () => ({
  useIngredientSuggestions: () => ({
    query: mockSuggestionQuery,
    invalidate: mockSuggestionInvalidate,
  }),
}));

import RecipeDetailScreen from '../../app/recipe/[id]';

function setNotes(notes: string | null) {
  mockRecipesState.current = [{ ...mockRecipeBase, notes }];
}

describe('RecipeDetailScreen — notes', () => {
  beforeEach(() => {
    mockUpdateNotes.mockClear();
    setNotes(null);
  });

  it('renders the header pill with "+ Note" copy when no notes are set', () => {
    const { getByText } = render(<RecipeDetailScreen />);
    expect(getByText(/^\+\s*Note$/)).toBeTruthy();
  });

  it('renders the header pill with "Note" + pencil affordance when notes exist', () => {
    setNotes('sauce too thin');
    const { getByLabelText } = render(<RecipeDetailScreen />);
    expect(getByLabelText('Edit notes')).toBeTruthy();
  });

  it('does not render a Notes section when notes are null', () => {
    const { queryByText } = render(<RecipeDetailScreen />);
    // CategoryHeader uppercases its label — guard against the rendered form.
    expect(queryByText('NOTES')).toBeNull();
  });

  it('renders the Notes section + body text when notes exist', () => {
    setNotes('sauce too thin, try thighs next time');
    const { getByText } = render(<RecipeDetailScreen />);
    // CategoryHeader uppercases its label in the rendered output.
    expect(getByText('NOTES')).toBeTruthy();
    expect(getByText('sauce too thin, try thighs next time')).toBeTruthy();
  });

  it('opens the notes sheet when the header pill is tapped', () => {
    const { getByLabelText, getByPlaceholderText } = render(<RecipeDetailScreen />);
    fireEvent.press(getByLabelText('Add notes'));
    expect(getByPlaceholderText(/What worked/i)).toBeTruthy();
  });

  it('opens the notes sheet when the Notes card is tapped', () => {
    setNotes('sauce too thin');
    const { getByText, getByPlaceholderText } = render(<RecipeDetailScreen />);
    fireEvent.press(getByText('sauce too thin'));
    expect(getByPlaceholderText(/What worked/i)).toBeTruthy();
  });

  it('calls updateNotes with the saved value when the sheet saves', async () => {
    const { getByLabelText, getByPlaceholderText, getByText } = render(<RecipeDetailScreen />);
    fireEvent.press(getByLabelText('Add notes'));
    fireEvent.changeText(getByPlaceholderText(/What worked/i), 'doubled the broccoli');
    fireEvent.press(getByText('Save notes'));
    await waitFor(() => expect(mockUpdateNotes).toHaveBeenCalledWith('r1', 'doubled the broccoli'));
  });

  it('calls updateNotes(r1, null) when the sheet saves whitespace', async () => {
    setNotes('previous notes');
    const { getByText: gbt, getByPlaceholderText, getByLabelText } = render(<RecipeDetailScreen />);
    fireEvent.press(getByLabelText('Edit notes'));
    fireEvent.changeText(getByPlaceholderText(/What worked/i), '   ');
    fireEvent.press(gbt('Save notes'));
    await waitFor(() => expect(mockUpdateNotes).toHaveBeenCalledWith('r1', null));
  });
});
