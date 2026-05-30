import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { MergeProductSheet } from '../../components/MergeProductSheet';
import type { ProductRow } from '../../types/db';

const SOURCE: ProductRow = {
  id: 'src', brand: 'Coles', product_name: 'Chicken Breast Fillet', item_name: 'chicken breast',
  basis: 'per_100g',
  cal_per_basis: 165, protein_per_basis: 31, carbs_per_basis: 0, fat_per_basis: 3.6,
  updated_at: '2026-05-01T00:00:00Z',
};
const TWIN: ProductRow = {
  ...SOURCE, id: 'twin', product_name: 'Chicken Breast Fillets',
};
const OTHER: ProductRow = {
  id: 'other', brand: 'Macro', product_name: 'Free Range', item_name: 'chicken breast',
  basis: 'per_100g',
  cal_per_basis: null, protein_per_basis: null, carbs_per_basis: null, fat_per_basis: null,
  updated_at: '2026-05-01T00:00:00Z',
};
const UNRELATED: ProductRow = {
  id: 'eggs', brand: 'Coles', product_name: 'Eggs', item_name: 'eggs',
  basis: 'per_unit',
  cal_per_basis: 70, protein_per_basis: 6, carbs_per_basis: 0, fat_per_basis: 5,
  updated_at: '2026-05-01T00:00:00Z',
};

describe('MergeProductSheet', () => {
  it('surfaces the fuzzy twin as the suggested match', () => {
    const { getByText, getAllByText } = render(
      <MergeProductSheet
        visible={true}
        source={SOURCE}
        candidates={[TWIN, OTHER, UNRELATED]}
        onClose={jest.fn()}
        onMerge={jest.fn()}
      />,
    );
    expect(getByText(/Suggested match/i)).toBeTruthy();
    expect(getAllByText(/Coles Chicken Breast Fillets/).length).toBeGreaterThan(0);
  });

  it('omits the source from the candidate list', () => {
    const { getAllByText } = render(
      <MergeProductSheet
        visible={true}
        source={SOURCE}
        candidates={[SOURCE, TWIN, OTHER]}
        onClose={jest.fn()}
        onMerge={jest.fn()}
      />,
    );
    // Source appears only in the subtitle, never as a tappable candidate row.
    // "Coles Chicken Breast Fillet" (without trailing s) is the source label.
    expect(getAllByText('Coles Chicken Breast Fillet')).toHaveLength(1);
  });

  it('confirms via destructive Alert before invoking onMerge', () => {
    const onMerge = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert');
    alertSpy.mockImplementation((_title, _msg, buttons) => {
      const mergeBtn = buttons?.find(b => b.text === 'Merge');
      mergeBtn?.onPress?.();
    });

    const { getAllByText } = render(
      <MergeProductSheet
        visible={true}
        source={SOURCE}
        candidates={[TWIN]}
        onClose={jest.fn()}
        onMerge={onMerge}
      />,
    );
    // Pick the first occurrence of the twin label (either suggested or list row)
    fireEvent.press(getAllByText(/Coles Chicken Breast Fillets/)[0]);
    expect(alertSpy).toHaveBeenCalled();
    expect(onMerge).toHaveBeenCalledWith('twin');
    alertSpy.mockRestore();
  });

  it('search field filters candidate list by substring', () => {
    const { getByPlaceholderText, queryByText } = render(
      <MergeProductSheet
        visible={true}
        source={SOURCE}
        candidates={[TWIN, OTHER, UNRELATED]}
        onClose={jest.fn()}
        onMerge={jest.fn()}
      />,
    );
    fireEvent.changeText(getByPlaceholderText(/Search/i), 'eggs');
    expect(queryByText(/Coles Eggs/)).toBeTruthy();
    expect(queryByText(/Macro Free Range/)).toBeNull();
  });
});
