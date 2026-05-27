import { renderHook } from '@testing-library/react-native';
import { useProducts } from '../../hooks/useProducts';
import type { Ingredient } from '../../meal_plan.types';
import type { ProductRow } from '../../types/db';

const mockDb = {
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
  runAsync: jest.fn(),
};

jest.mock('../../providers/DatabaseProvider', () => ({
  useDb: () => mockDb,
}));

jest.mock('../../lib/uuid', () => ({
  generateId: jest.fn(() => 'generated-id'),
}));

beforeEach(() => {
  mockDb.getFirstAsync.mockReset();
  mockDb.getAllAsync.mockReset();
  mockDb.runAsync.mockReset();
});

describe('useProducts.upsert', () => {
  it('inserts a new row when no match exists; returns the generated id', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useProducts());
    const id = await result.current.upsert({
      brand: 'Coles',
      product_name: 'Chicken Breast Fillets',
      item_name: 'chicken breast',
      basis: 'per_100g',
      cal_per_basis: 165,
      protein_per_basis: 31,
      carbs_per_basis: 0,
      fat_per_basis: 3.6,
    });
    expect(id).toBe('generated-id');
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO products'),
      expect.arrayContaining(['generated-id', 'Coles', 'Chicken Breast Fillets']),
    );
  });

  it('updates the existing row when (brand, product_name) matches; returns its id', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ id: 'existing-id' });
    const { result } = renderHook(() => useProducts());
    const id = await result.current.upsert({
      brand: 'Coles',
      product_name: 'Chicken Breast Fillets',
      item_name: 'chicken breast',
      basis: 'per_100g',
      cal_per_basis: 165,
      protein_per_basis: 31,
      carbs_per_basis: 0,
      fat_per_basis: 3.6,
    });
    expect(id).toBe('existing-id');
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE products'),
      expect.arrayContaining(['chicken breast', 'per_100g', 165, 31, 0, 3.6, expect.any(String), 'existing-id']),
    );
  });

  it('matches by exact brand and product_name', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useProducts());
    await result.current.upsert({
      brand: '',
      product_name: 'banana',
      item_name: 'banana',
      basis: 'per_unit',
      cal_per_basis: 105,
      protein_per_basis: 1.3,
      carbs_per_basis: 27,
      fat_per_basis: 0.4,
    });
    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
      'SELECT id FROM products WHERE brand = ? AND product_name = ?',
      ['', 'banana'],
    );
  });
});

describe('useProducts.getById', () => {
  it('returns the row when found', async () => {
    const row: ProductRow = {
      id: 'p1', brand: 'Coles', product_name: 'Eggs', item_name: 'eggs',
      basis: 'per_unit', cal_per_basis: 70, protein_per_basis: 6,
      carbs_per_basis: 0, fat_per_basis: 5, updated_at: '2026-01-01T00:00:00Z',
    };
    mockDb.getFirstAsync.mockResolvedValueOnce(row);
    const { result } = renderHook(() => useProducts());
    expect(await result.current.getById('p1')).toEqual(row);
  });

  it('returns null when no row matches', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useProducts());
    expect(await result.current.getById('missing')).toBeNull();
  });
});

describe('useProducts.getByKey', () => {
  it('queries by (brand, product_name)', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useProducts());
    await result.current.getByKey('Coles', 'Chicken');
    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
      'SELECT * FROM products WHERE brand = ? AND product_name = ?',
      ['Coles', 'Chicken'],
    );
  });
});

describe('useProducts.getNutritionForIngredients', () => {
  it('returns {} when no ingredients have product_id', async () => {
    const ingredients: Ingredient[] = [
      { item: 'salt', amount: { kind: 'measured', value: 5, unit: 'g' } },
    ];
    const { result } = renderHook(() => useProducts());
    expect(await result.current.getNutritionForIngredients(ingredients)).toEqual({});
    expect(mockDb.getAllAsync).not.toHaveBeenCalled();
  });

  it('returns rows keyed by ingredient index', async () => {
    const row1: ProductRow = {
      id: 'p1', brand: 'Coles', product_name: 'Eggs', item_name: 'eggs',
      basis: 'per_unit', cal_per_basis: 70, protein_per_basis: 6,
      carbs_per_basis: 0, fat_per_basis: 5, updated_at: '2026-01-01T00:00:00Z',
    };
    const row2: ProductRow = {
      id: 'p2', brand: '', product_name: 'banana', item_name: 'banana',
      basis: 'per_unit', cal_per_basis: 105, protein_per_basis: 1.3,
      carbs_per_basis: 27, fat_per_basis: 0.4, updated_at: '2026-01-01T00:00:00Z',
    };
    mockDb.getAllAsync.mockResolvedValueOnce([row1, row2]);
    const ingredients: Ingredient[] = [
      { item: 'eggs',   amount: { kind: 'measured', value: 2, unit: 'unit' }, product_id: 'p1' },
      { item: 'salt',   amount: { kind: 'measured', value: 5, unit: 'g' } },
      { item: 'banana', amount: { kind: 'measured', value: 1, unit: 'unit' }, product_id: 'p2' },
    ];
    const { result } = renderHook(() => useProducts());
    const out = await result.current.getNutritionForIngredients(ingredients);
    expect(out).toEqual({ 0: row1, 2: row2 });
  });

  it('omits indices whose product_id does not resolve', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([]);
    const ingredients: Ingredient[] = [
      { item: 'eggs', amount: { kind: 'measured', value: 1, unit: 'unit' }, product_id: 'missing' },
    ];
    const { result } = renderHook(() => useProducts());
    expect(await result.current.getNutritionForIngredients(ingredients)).toEqual({});
  });
});
