import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { IngredientSheet } from '../../components/IngredientSheet';
import { useIngredientSuggestions } from '../../hooks/useIngredientSuggestions';
import { useProducts } from '../../hooks/useProducts';
import type { ProductRow } from '../../types/db';
import type { Ingredient } from '../../meal_plan.types';

jest.mock('../../components/PriceHistoryChart', () => ({
  PriceHistoryChart: () => null,
}));

jest.mock('../../hooks/useIngredientSuggestions');
jest.mock('../../hooks/useProducts');

// Default safe mocks. Specific tests override via mockReturnValue.
beforeEach(() => {
  (useIngredientSuggestions as jest.Mock).mockReturnValue({
    query: jest.fn().mockResolvedValue([]),
    invalidate: jest.fn(),
  });
  (useProducts as jest.Mock).mockReturnValue({
    getById: jest.fn(),
  });
});

const EXISTING: ProductRow = {
  id: 'test-id',
  brand: 'Vitasoy',
  product_name: 'Oat Milk Barista',
  item_name: 'oat milk',
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
      nutrition: expect.objectContaining({ brand: 'Vitasoy', product_name: 'Oat Milk Barista' }),
    }));
  });
});

describe('IngredientSheet × suggestions', () => {
  beforeEach(() => {
    (useIngredientSuggestions as jest.Mock).mockReturnValue({
      query: jest.fn().mockResolvedValue([
        {
          kind: 'product', brand: 'Vitasoy', productName: 'Oat Milk Barista',
          lastUsedAt: '2026-05-25T00:00:00Z', productId: 'fn-1', hasNutrition: true, matches: [],
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
          lastUsedAt: '2026-05-25T00:00:00Z', productId: 'fn-1', hasNutrition: true, matches: [],
        },
      ]),
      invalidate: jest.fn(),
    });
    (useProducts as jest.Mock).mockReturnValue({
      getById: jest.fn().mockResolvedValue({
        id: 'fn-1', brand: 'Vitasoy', product_name: 'Oat Milk Barista', item_name: 'oat milk',
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

describe('IngredientSheet × keyboard avoidance', () => {
  // The parent KeyboardAvoidingView uses behavior="padding", which shrinks its
  // content box by the keyboard height. A child sized with an absolute height
  // cannot shrink with it, so `justifyContent: 'flex-end'` bottom-aligns it and
  // the overflow spills off the TOP of the screen — carrying the name and
  // amount inputs, which sit above the KeyboardAwareScrollView and so cannot be
  // scrolled back into view. A percentage height resolves against the padded
  // content box instead, so the sheet shrinks and its top stays on screen.
  it('sizes the sheet as a percentage so the keyboard cannot push its top off screen', () => {
    const { getByTestId } = render(
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
    const style = StyleSheet.flatten(getByTestId('ingredient-sheet').props.style);
    expect(style.height).toBe('80%');
  });
});

describe('IngredientSheet × calorie recalculation', () => {
  function renderSheet(props: Partial<React.ComponentProps<typeof IngredientSheet>> = {}) {
    return render(
      <IngredientSheet
        visible={true}
        mode="add"
        initialIngredient={null}
        existingEntry={null}
        onSave={jest.fn()}
        onClose={jest.fn()}
        {...props}
      />
    );
  }

  it('recalculates calories when a macro is edited on a saved product', () => {
    const { getByLabelText } = renderSheet({
      mode: 'edit', initialIngredient: ING, existingEntry: EXISTING, onDelete: jest.fn(),
    });
    // EXISTING carries a hand-entered 45 kcal; the old calIsAuto gate froze it.
    fireEvent.changeText(getByLabelText('Protein'), '10');
    // 10×4 + 4.5×4 + 1.5×9 = 71.5 → 72
    expect(getByLabelText('Calories').props.value).toBe('72');
  });

  it('treats blank carbs and fat as zero when only protein is filled', () => {
    const { getByLabelText } = renderSheet();
    fireEvent.changeText(getByLabelText('Protein'), '20');
    expect(getByLabelText('Calories').props.value).toBe('80');
  });

  it('leaves calories untouched when all three macros are blank', () => {
    const { getByLabelText } = renderSheet();
    fireEvent.changeText(getByLabelText('Protein'), '20');
    expect(getByLabelText('Calories').props.value).toBe('80');
    fireEvent.changeText(getByLabelText('Protein'), '');
    expect(getByLabelText('Calories').props.value).toBe('80');
  });

  it('does not recalculate on open — only on edit', () => {
    const { getByLabelText } = renderSheet({
      mode: 'edit', initialIngredient: ING, existingEntry: EXISTING, onDelete: jest.fn(),
    });
    // Atwater over EXISTING's macros would give 36; the stored 45 must survive a plain open.
    expect(getByLabelText('Calories').props.value).toBe('45');
  });

  it('overwrites a hand-typed calorie value on a later macro edit', () => {
    const { getByLabelText } = renderSheet();
    fireEvent.changeText(getByLabelText('Calories'), '200');
    fireEvent.changeText(getByLabelText('Protein'), '10');
    expect(getByLabelText('Calories').props.value).toBe('40');
  });

  it('ignores an unparseable macro entry rather than treating it as zero', () => {
    const { getByLabelText } = renderSheet();
    fireEvent.changeText(getByLabelText('Protein'), '20');
    fireEvent.changeText(getByLabelText('Carbs'), 'abc');
    expect(getByLabelText('Calories').props.value).toBe('80');
  });
});

describe('IngredientSheet × autofill flow', () => {
  beforeEach(() => {
    (useIngredientSuggestions as jest.Mock).mockReturnValue({
      query: jest.fn().mockResolvedValue([
        { kind: 'product', brand: 'Vitasoy', productName: 'Oat Milk Barista',
          lastUsedAt: '2026-05-25T00:00:00Z', productId: 'fn-1', hasNutrition: true, matches: [] },
      ]),
      invalidate: jest.fn(),
    });
    (useProducts as jest.Mock).mockReturnValue({
      getById: jest.fn().mockResolvedValue({
        id: 'fn-1', brand: 'Vitasoy', product_name: 'Oat Milk Barista', item_name: 'oat milk',
        basis: 'per_100mL', cal_per_basis: 50, protein_per_basis: 1, carbs_per_basis: 5, fat_per_basis: 1,
        updated_at: '2026-05-25T00:00:00Z',
      }),
    });
  });

  it('save after autofill emits a nutrition payload with the picked brand/product', async () => {
    const onSave = jest.fn();
    const { findByText, getByPlaceholderText, getByText } = render(
      <IngredientSheet
        visible={true}
        mode="add"
        initialIngredient={{ item: 'milk', amount: { kind: 'measured', value: 250, unit: 'mL' } }}
        existingEntry={null}
        onSave={onSave}
        onClose={jest.fn()}
      />
    );
    fireEvent(getByPlaceholderText('e.g. Oat Milk Barista'), 'focus');
    fireEvent.press(await findByText('Oat Milk Barista'));
    await waitFor(() => expect(getByPlaceholderText('e.g. Oat Milk Barista').props.value).toBe('Oat Milk Barista'));
    fireEvent.press(getByText('Done'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      nutrition: expect.objectContaining({
        brand: 'Vitasoy',
        product_name: 'Oat Milk Barista',
      }),
    }));
  });

  it('editing brand after autofill emits the edited brand in nutrition payload', async () => {
    const onSave = jest.fn();
    const { findByText, getByPlaceholderText, getByText, getByDisplayValue } = render(
      <IngredientSheet
        visible={true}
        mode="add"
        initialIngredient={{ item: 'milk', amount: { kind: 'measured', value: 250, unit: 'mL' } }}
        existingEntry={null}
        onSave={onSave}
        onClose={jest.fn()}
      />
    );
    fireEvent(getByPlaceholderText('e.g. Oat Milk Barista'), 'focus');
    fireEvent.press(await findByText('Oat Milk Barista'));
    await waitFor(() => getByDisplayValue('Vitasoy'));
    fireEvent.changeText(getByDisplayValue('Vitasoy'), 'Vitasoy Plus');
    fireEvent.press(getByText('Done'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      nutrition: expect.objectContaining({
        brand: 'Vitasoy Plus',
        product_name: 'Oat Milk Barista',
      }),
    }));
  });
});
