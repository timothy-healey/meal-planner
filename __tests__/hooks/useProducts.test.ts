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

describe('useProducts.getAll', () => {
  it('returns all rows ordered by item_name then product_name', async () => {
    const rows = [
      { id: '1', brand: '', product_name: 'banana', item_name: 'banana', basis: 'per_unit',
        cal_per_basis: 105, protein_per_basis: 1.3, carbs_per_basis: 27, fat_per_basis: 0.4,
        updated_at: '2026-01-01T00:00:00Z' },
    ];
    mockDb.getAllAsync.mockResolvedValueOnce(rows);
    const { result } = renderHook(() => useProducts());
    const got = await result.current.getAll();
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM products'),
    );
    expect(got).toEqual(rows);
  });
});

describe('useProducts.deleteProduct', () => {
  it('clears recipe references, nulls purchase_history.product_id, then deletes the row', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([
      { id: 'r1', ingredients_json: JSON.stringify([
        { item: 'chicken', amount: { kind: 'measured', value: 200, unit: 'g' }, product_id: 'p1' },
        { item: 'rice',    amount: { kind: 'measured', value: 150, unit: 'g' } },
      ]) },
    ]);
    const { result } = renderHook(() => useProducts());
    await result.current.deleteProduct('p1');

    const calls = mockDb.runAsync.mock.calls.map((c: any[]) => c[0] as string);
    expect(calls[0]).toBe('BEGIN');
    expect(calls[calls.length - 1]).toBe('COMMIT');

    const updateRecipe = mockDb.runAsync.mock.calls.find(
      c => typeof c[0] === 'string' && c[0].startsWith('UPDATE recipes'),
    );
    expect(updateRecipe).toBeDefined();
    const written = JSON.parse(updateRecipe![1][0]);
    expect(written[0].product_id).toBeUndefined();

    expect(calls).toEqual(expect.arrayContaining([
      expect.stringMatching(/UPDATE purchase_history SET product_id = NULL WHERE product_id = \?/),
    ]));

    expect(calls).toEqual(expect.arrayContaining([
      expect.stringMatching(/DELETE FROM products WHERE id = \?/),
    ]));
  });
});

describe('useProducts.mergeProduct', () => {
  it('runs the full merge transaction (re-target purchases, rewrite recipes, delete source)', async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({ id: 'src', brand: 'Coles', product_name: 'Fillet', item_name: 'chicken breast',
        basis: 'per_100g', cal_per_basis: 165, protein_per_basis: 31, carbs_per_basis: 0, fat_per_basis: 3.6,
        updated_at: '2026-02-01T00:00:00Z' })
      .mockResolvedValueOnce({ id: 'tgt', brand: 'Coles', product_name: 'Fillets', item_name: 'chicken breast',
        basis: 'per_100g', cal_per_basis: 170, protein_per_basis: 30, carbs_per_basis: 0, fat_per_basis: 4,
        updated_at: '2026-01-01T00:00:00Z' });
    mockDb.getAllAsync.mockResolvedValueOnce([
      { id: 'r1', ingredients_json: JSON.stringify([
        { item: 'chicken', amount: { kind: 'measured', value: 200, unit: 'g' }, product_id: 'src' },
      ]) },
    ]);

    const { result } = renderHook(() => useProducts());
    await result.current.mergeProduct('src', 'tgt');

    const calls = mockDb.runAsync.mock.calls;
    const sqls = calls.map(c => c[0] as string);

    expect(sqls[0]).toBe('BEGIN');
    expect(sqls[sqls.length - 1]).toBe('COMMIT');

    const updateProducts = calls.find(c => typeof c[0] === 'string' && c[0].includes('UPDATE products SET'));
    expect(updateProducts).toBeDefined();
    expect(updateProducts![1]).toEqual(expect.arrayContaining([165, 31, 0, 3.6, 'tgt']));

    expect(sqls).toEqual(expect.arrayContaining([
      expect.stringMatching(/UPDATE purchase_history SET product_id = \? WHERE product_id = \?/),
    ]));

    const updateRecipe = calls.find(c => typeof c[0] === 'string' && c[0].startsWith('UPDATE recipes'));
    const written = JSON.parse(updateRecipe![1][0]);
    expect(written[0].product_id).toBe('tgt');

    expect(sqls).toEqual(expect.arrayContaining([
      expect.stringMatching(/DELETE FROM products WHERE id = \?/),
    ]));
  });

  it('keeps target macros when source has none', async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({ id: 'src', brand: 'A', product_name: 'X', item_name: 'foo',
        basis: 'per_100g', cal_per_basis: null, protein_per_basis: null, carbs_per_basis: null, fat_per_basis: null,
        updated_at: '2026-02-01T00:00:00Z' })
      .mockResolvedValueOnce({ id: 'tgt', brand: 'A', product_name: 'Y', item_name: 'foo',
        basis: 'per_100g', cal_per_basis: 100, protein_per_basis: 10, carbs_per_basis: 20, fat_per_basis: 1,
        updated_at: '2026-01-01T00:00:00Z' });
    mockDb.getAllAsync.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useProducts());
    await result.current.mergeProduct('src', 'tgt');

    const calls = mockDb.runAsync.mock.calls;
    const updateProducts = calls.find(c => typeof c[0] === 'string' && c[0].includes('UPDATE products SET'));
    expect(updateProducts).toBeUndefined();
  });
});
