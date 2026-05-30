import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockProduct = {
  id: 'p1', brand: 'Coles', product_name: 'Chicken Breast Fillets', item_name: 'chicken breast',
  basis: 'per_100g',
  cal_per_basis: 165, protein_per_basis: 31, carbs_per_basis: 0, fat_per_basis: 3.6,
  updated_at: '2026-05-01T00:00:00Z',
};
const mockState: { product: any; recipes: any[]; allProducts: any[] } = {
  product: mockProduct,
  recipes: [],
  allProducts: [mockProduct],
};

const mockGetById = jest.fn().mockImplementation(async () => mockState.product);
const mockGetAll = jest.fn().mockImplementation(async () => mockState.allProducts);
const mockDeleteProduct = jest.fn().mockResolvedValue(undefined);
const mockMergeProduct = jest.fn().mockResolvedValue(undefined);

jest.mock('../../hooks/useProducts', () => ({
  useProducts: () => ({
    getById: mockGetById,
    getAll: mockGetAll,
    upsert: jest.fn(),
    getByKey: jest.fn(),
    getNutritionForIngredients: jest.fn(),
    deleteProduct: mockDeleteProduct,
    mergeProduct: mockMergeProduct,
  }),
}));

jest.mock('../../hooks/useRecipes', () => ({
  useRecipes: () => ({
    recipes: mockState.recipes,
    loading: false,
  }),
}));

jest.mock('../../providers/DatabaseProvider', () => ({
  useDb: () => ({
    getAllAsync: jest.fn().mockResolvedValue([]),
  }),
  usePlanVersion: () => ({ planVersion: 0, bumpPlanVersion: jest.fn() }),
}));

jest.mock('../../components/PriceHistoryChart', () => ({
  PriceHistoryChart: () => null,
}));

jest.mock('../../components/IngredientSheet', () => ({
  IngredientSheet: () => null,
}));

jest.mock('../../components/MergeProductSheet', () => ({
  MergeProductSheet: () => null,
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ id: 'p1' }),
}));

import CatalogDetailScreen from '../../app/catalog/[id]';

describe('CatalogDetailScreen', () => {
  beforeEach(() => {
    mockState.product = mockProduct;
    mockState.recipes = [];
    mockState.allProducts = [mockProduct];
    mockGetById.mockClear();
    mockDeleteProduct.mockClear();
    mockMergeProduct.mockClear();
  });

  it('renders the brand and product header', async () => {
    const { findByText } = render(<CatalogDetailScreen />);
    expect(await findByText(/COLES/)).toBeTruthy();
    expect(await findByText(/Chicken Breast Fillets/)).toBeTruthy();
  });

  it('renders "GENERIC" in the header when brand is empty', async () => {
    mockState.product = { ...mockProduct, brand: '' };
    const { findByText } = render(<CatalogDetailScreen />);
    expect(await findByText(/GENERIC/)).toBeTruthy();
  });

  it('renders the four macros from the product row', async () => {
    const { findByText } = render(<CatalogDetailScreen />);
    expect(await findByText('165')).toBeTruthy();
    expect(await findByText('31')).toBeTruthy();
    expect(await findByText('3.6')).toBeTruthy();
  });

  it('renders the empty-nutrition CTA when all macros are null', async () => {
    mockState.product = { ...mockProduct, cal_per_basis: null, protein_per_basis: null, carbs_per_basis: null, fat_per_basis: null };
    const { findByText } = render(<CatalogDetailScreen />);
    expect(await findByText(/No nutrition on file/i)).toBeTruthy();
    expect(await findByText(/Add macros/i)).toBeTruthy();
  });

  it('omits the recipes card when no recipes reference the product', async () => {
    const { queryByText } = render(<CatalogDetailScreen />);
    await waitFor(() => expect(mockGetById).toHaveBeenCalled());
    expect(queryByText(/USED IN/)).toBeNull();
  });

  it('delete action invokes deleteProduct via destructive Alert', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    alertSpy.mockImplementation((_t, _m, btns) => {
      btns?.find(b => b.text === 'Delete')?.onPress?.();
    });
    const { findByLabelText } = render(<CatalogDetailScreen />);
    const menuBtn = await findByLabelText(/Product actions/i);
    fireEvent.press(menuBtn);
    const deleteAction = await findByLabelText(/Delete product/i);
    fireEvent.press(deleteAction);
    await waitFor(() => expect(mockDeleteProduct).toHaveBeenCalledWith('p1'));
    alertSpy.mockRestore();
  });
});
