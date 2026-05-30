import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CatalogRow } from '../../components/CatalogRow';
import type { CatalogRow as CatalogRowData } from '../../hooks/useCatalog';

function makeRow(overrides: Partial<CatalogRowData> = {}): CatalogRowData {
  return {
    product: {
      id: 'p1', brand: 'Coles', product_name: 'Chicken Breast Fillets', item_name: 'chicken breast',
      basis: 'per_100g',
      cal_per_basis: 165, protein_per_basis: 31, carbs_per_basis: 0, fat_per_basis: 3.6,
      updated_at: '2026-01-01T00:00:00Z',
    },
    latest: { price: 12.50, chain: 'Coles', purchased_at: '2026-05-25T00:00:00Z', qty: '500g' },
    purchase_count: 4,
    recipe_count: 2,
    last_used_at: '2026-05-25T00:00:00Z',
    issue: null,
    ...overrides,
  };
}

describe('CatalogRow — clean', () => {
  it('renders title with brand + product_name', () => {
    const { getByText } = render(<CatalogRow row={makeRow()} onPress={jest.fn()} />);
    expect(getByText(/Coles Chicken Breast Fillets/)).toBeTruthy();
  });

  it('renders "· generic" suffix when brand is empty', () => {
    const row = makeRow({ product: { ...makeRow().product, brand: '' } });
    const { getByText } = render(<CatalogRow row={row} onPress={jest.fn()} />);
    expect(getByText(/generic/i)).toBeTruthy();
  });

  it('renders price in the tail', () => {
    const { getByText } = render(<CatalogRow row={makeRow()} onPress={jest.fn()} />);
    expect(getByText(/\$12\.50/)).toBeTruthy();
  });

  it('fires onPress with the product id', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(<CatalogRow row={makeRow()} onPress={onPress} />);
    fireEvent.press(getByLabelText(/Coles Chicken Breast Fillets/));
    expect(onPress).toHaveBeenCalledWith('p1');
  });
});

describe('CatalogRow — issue variants', () => {
  it('renders missing nutrition hint', () => {
    const row = makeRow({ issue: 'missing_nutrition', recipe_count: 2 });
    const { getByText } = render(<CatalogRow row={row} onPress={jest.fn()} />);
    expect(getByText(/No nutrition on file/)).toBeTruthy();
    expect(getByText(/used in 2 recipes/)).toBeTruthy();
  });

  it('renders unused hint', () => {
    const row = makeRow({ issue: 'unused', purchase_count: 0, recipe_count: 0, latest: null });
    const { getByText } = render(<CatalogRow row={row} onPress={jest.fn()} />);
    expect(getByText(/Unused/)).toBeTruthy();
  });

  it('renders duplicate hint with twin product_name', () => {
    const row = makeRow({
      issue: 'duplicate',
      duplicate_of: { id: 'p2', brand: 'Coles', product_name: 'Chicken Breast Fillet' },
    });
    const { getByText, getAllByText } = render(<CatalogRow row={row} onPress={jest.fn()} />);
    expect(getByText(/Looks like a duplicate/)).toBeTruthy();
    expect(getAllByText(/Chicken Breast Fillet/).length).toBeGreaterThan(0);
  });
});
