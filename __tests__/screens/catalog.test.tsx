import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

const mockCatalogState = {
  current: {
    rows: [] as any[],
    counts: { missingNutrition: 0, unused: 0, duplicates: 0, total: 0 },
    loading: false,
  },
};

jest.mock('../../hooks/useCatalog', () => ({
  useCatalog: () => ({ ...mockCatalogState.current, reload: jest.fn() }),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void) => cb(),
}));

import CatalogScreen from '../../app/(tabs)/catalog';

beforeEach(() => {
  mockCatalogState.current = {
    rows: [],
    counts: { missingNutrition: 0, unused: 0, duplicates: 0, total: 0 },
    loading: false,
  };
});

function makeRow(overrides: any) {
  return {
    product: {
      id: 'p1', brand: 'Coles', product_name: 'Chicken Breast Fillets', item_name: 'chicken breast',
      basis: 'per_100g',
      cal_per_basis: 165, protein_per_basis: 31, carbs_per_basis: 0, fat_per_basis: 3.6,
      updated_at: '2026-05-01T00:00:00Z',
      ...overrides.product,
    },
    latest: { price: 12.50, chain: 'Coles', purchased_at: '2026-05-25T00:00:00Z', qty: '500g' },
    purchase_count: 4,
    recipe_count: 2,
    last_used_at: '2026-05-25T00:00:00Z',
    issue: null,
    ...overrides,
  };
}

describe('CatalogScreen', () => {
  it('renders the empty state when catalog is empty', () => {
    const { getByText } = render(<CatalogScreen />);
    expect(getByText(/No products yet/i)).toBeTruthy();
  });

  it('shows the header total and audit chips', () => {
    mockCatalogState.current = {
      rows: [makeRow({})],
      counts: { missingNutrition: 1, unused: 2, duplicates: 0, total: 5 },
      loading: false,
    };
    const { getByText } = render(<CatalogScreen />);
    expect(getByText(/Catalog · 5/)).toBeTruthy();
    expect(getByText(/Missing nutrition/)).toBeTruthy();
    expect(getByText(/Unused/)).toBeTruthy();
  });

  it('filters list when an audit chip is tapped', () => {
    const clean = makeRow({ product: { id: 'a', brand: 'A', product_name: 'A1', item_name: 'a' } });
    const dirty = makeRow({
      product: { id: 'b', brand: 'B', product_name: 'B1', item_name: 'b' },
      issue: 'unused', purchase_count: 0, recipe_count: 0, latest: null,
    });
    mockCatalogState.current = {
      rows: [clean, dirty],
      counts: { missingNutrition: 0, unused: 1, duplicates: 0, total: 2 },
      loading: false,
    };
    const { getAllByText, queryByText } = render(<CatalogScreen />);
    expect(queryByText(/A A1/)).toBeTruthy();
    expect(queryByText(/B B1/)).toBeTruthy();
    // First "Unused" match is the chip pill; tapping it filters the list.
    fireEvent.press(getAllByText(/^Unused$/)[0]);
    expect(queryByText(/A A1/)).toBeNull();
    expect(queryByText(/B B1/)).toBeTruthy();
  });

  it('filters list when search text is entered', () => {
    mockCatalogState.current = {
      rows: [
        makeRow({ product: { id: '1', brand: 'Coles', product_name: 'Chicken Breast Fillets', item_name: 'chicken breast' } }),
        makeRow({ product: { id: '2', brand: 'Vitasoy', product_name: 'Oat Milk', item_name: 'oat milk' } }),
      ],
      counts: { missingNutrition: 0, unused: 0, duplicates: 0, total: 2 },
      loading: false,
    };
    const { getByPlaceholderText, queryByText } = render(<CatalogScreen />);
    fireEvent.changeText(getByPlaceholderText(/Search/i), 'oat');
    expect(queryByText(/Oat Milk/)).toBeTruthy();
    expect(queryByText(/Chicken Breast Fillets/)).toBeNull();
  });
});
