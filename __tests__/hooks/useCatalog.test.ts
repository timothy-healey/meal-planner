import { renderHook, waitFor } from '@testing-library/react-native';
import { useCatalog } from '../../hooks/useCatalog';

const mockDb = {
  getAllAsync: jest.fn(),
  getFirstAsync: jest.fn(),
};

jest.mock('../../providers/DatabaseProvider', () => ({
  useDb: () => mockDb,
  usePlanVersion: () => ({ planVersion: 0 }),
}));

beforeEach(() => {
  mockDb.getAllAsync.mockReset();
  mockDb.getFirstAsync.mockReset();
});

function mockQueries({ products = [], latest = [], recipeRefs = [] }: {
  products?: any[]; latest?: any[]; recipeRefs?: any[];
}) {
  mockDb.getAllAsync.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM products p')) return products;
    if (sql.includes('FROM purchase_history ph') && sql.includes('latest_per_product')) return latest;
    if (sql.includes('json_each')) return recipeRefs;
    return [];
  });
}

describe('useCatalog', () => {
  it('returns empty rows and zero counts on an empty catalog', async () => {
    mockQueries({});
    const { result } = renderHook(() => useCatalog());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toEqual([]);
    expect(result.current.counts).toEqual({ missingNutrition: 0, unused: 0, duplicates: 0, total: 0 });
  });

  it('flags missing_nutrition only when recipe_count > 0 AND all macros null', async () => {
    mockQueries({
      products: [
        { id: 'p1', brand: 'A', product_name: 'X', item_name: 'foo', basis: 'per_100g',
          cal_per_basis: null, protein_per_basis: null, carbs_per_basis: null, fat_per_basis: null,
          updated_at: '2026-01-01T00:00:00Z', purchase_count: 0, latest_purchased_at: null,
          last_used_at: '2026-01-01T00:00:00Z' },
      ],
      recipeRefs: [{ product_id: 'p1', recipe_count: 2 }],
    });
    const { result } = renderHook(() => useCatalog());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows[0].issue).toBe('missing_nutrition');
    expect(result.current.counts.missingNutrition).toBe(1);
  });

  it('flags unused when no purchases AND no recipe references', async () => {
    mockQueries({
      products: [
        { id: 'p1', brand: 'A', product_name: 'X', item_name: 'foo', basis: 'per_100g',
          cal_per_basis: 100, protein_per_basis: 10, carbs_per_basis: 0, fat_per_basis: 1,
          updated_at: '2026-01-01T00:00:00Z', purchase_count: 0, latest_purchased_at: null,
          last_used_at: '2026-01-01T00:00:00Z' },
      ],
      recipeRefs: [],
    });
    const { result } = renderHook(() => useCatalog());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows[0].issue).toBe('unused');
    expect(result.current.counts.unused).toBe(1);
  });

  it('flags duplicates and gives counts of unique products in the cluster', async () => {
    mockQueries({
      products: [
        { id: '1', brand: 'Coles', product_name: 'Chicken Breast Fillet', item_name: 'chicken breast',
          basis: 'per_100g', cal_per_basis: 165, protein_per_basis: 31, carbs_per_basis: 0, fat_per_basis: 3.6,
          updated_at: '2026-01-01T00:00:00Z', purchase_count: 1, latest_purchased_at: '2026-01-01T00:00:00Z',
          last_used_at: '2026-01-01T00:00:00Z' },
        { id: '2', brand: 'Coles', product_name: 'Chicken Breast Fillets', item_name: 'chicken breast',
          basis: 'per_100g', cal_per_basis: 165, protein_per_basis: 31, carbs_per_basis: 0, fat_per_basis: 3.6,
          updated_at: '2026-02-01T00:00:00Z', purchase_count: 1, latest_purchased_at: '2026-02-01T00:00:00Z',
          last_used_at: '2026-02-01T00:00:00Z' },
      ],
    });
    const { result } = renderHook(() => useCatalog());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows.every(r => r.issue === 'duplicate')).toBe(true);
    expect(result.current.counts.duplicates).toBe(2);
    expect(result.current.rows[0].duplicate_of).toBeDefined();
  });

  it('sorts rows by last_used_at descending', async () => {
    mockQueries({
      products: [
        { id: '1', brand: 'A', product_name: 'Old', item_name: 'foo', basis: 'per_100g',
          cal_per_basis: 100, protein_per_basis: 10, carbs_per_basis: 0, fat_per_basis: 1,
          updated_at: '2025-01-01T00:00:00Z', purchase_count: 0, latest_purchased_at: null,
          last_used_at: '2025-01-01T00:00:00Z' },
        { id: '2', brand: 'B', product_name: 'New', item_name: 'bar', basis: 'per_100g',
          cal_per_basis: 100, protein_per_basis: 10, carbs_per_basis: 0, fat_per_basis: 1,
          updated_at: '2026-06-01T00:00:00Z', purchase_count: 0, latest_purchased_at: null,
          last_used_at: '2026-06-01T00:00:00Z' },
      ],
    });
    const { result } = renderHook(() => useCatalog());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows.map(r => r.product.id)).toEqual(['2', '1']);
  });
});
