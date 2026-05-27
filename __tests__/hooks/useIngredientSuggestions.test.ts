import { renderHook, act } from '@testing-library/react-native';
import { useIngredientSuggestions } from '../../hooks/useIngredientSuggestions';

const mockDb = {
  getAllAsync: jest.fn(),
};

jest.mock('../../providers/DatabaseProvider', () => ({
  useDb: () => mockDb,
}));

beforeEach(() => {
  mockDb.getAllAsync.mockReset();
});

function mockProducts(rows: any[]) {
  mockDb.getAllAsync.mockResolvedValue(rows);
}

describe('useIngredientSuggestions', () => {
  it('fetches once and reuses the cache for subsequent queries', async () => {
    mockProducts([
      { product_id: 'fn-1', brand: 'Vitasoy', product_name: 'Oat Milk', item_name: 'oat milk', has_nutrition: 1, last_used_at: '2026-05-20T00:00:00Z' },
    ]);
    const { result } = renderHook(() => useIngredientSuggestions());
    await act(async () => {
      await result.current.query({ field: 'product', text: '', ingredientName: 'milk' });
      await result.current.query({ field: 'product', text: 'oat', ingredientName: 'milk' });
    });
    expect(mockDb.getAllAsync).toHaveBeenCalledTimes(1);
  });

  it('invalidate() forces the next query to refetch', async () => {
    mockProducts([]);
    const { result } = renderHook(() => useIngredientSuggestions());
    await act(async () => { await result.current.query({ field: 'product', text: '', ingredientName: 'milk' }); });
    expect(mockDb.getAllAsync).toHaveBeenCalledTimes(1);
    act(() => { result.current.invalidate(); });
    await act(async () => { await result.current.query({ field: 'product', text: '', ingredientName: 'milk' }); });
    expect(mockDb.getAllAsync).toHaveBeenCalledTimes(2);
  });

  it('applies the brand filter case-insensitively to product-field queries', async () => {
    mockProducts([
      { product_id: 'a', brand: 'Vitasoy', product_name: 'Oat Milk',  item_name: 'oat milk', has_nutrition: 1, last_used_at: '2026-05-20T00:00:00Z' },
      { product_id: 'b', brand: 'Oatly',   product_name: 'Original',  item_name: 'oat milk', has_nutrition: 1, last_used_at: '2026-05-20T00:00:00Z' },
    ]);
    const { result } = renderHook(() => useIngredientSuggestions());
    let suggestions: any[] = [];
    await act(async () => {
      suggestions = await result.current.query({
        field: 'product', text: '', ingredientName: 'milk', brandFilter: 'VITASOY',
      });
    });
    expect(suggestions.map(s => s.productId)).toEqual(['a']);
  });

  it('projects to brand rows when field=brand', async () => {
    mockProducts([
      { product_id: 'a', brand: 'Vitasoy', product_name: 'A', item_name: 'milk', has_nutrition: 1, last_used_at: '2026-05-20T00:00:00Z' },
      { product_id: 'b', brand: 'Vitasoy', product_name: 'B', item_name: 'milk', has_nutrition: 1, last_used_at: '2026-05-21T00:00:00Z' },
    ]);
    const { result } = renderHook(() => useIngredientSuggestions());
    let suggestions: any[] = [];
    await act(async () => {
      suggestions = await result.current.query({ field: 'brand', text: '', ingredientName: 'milk' });
    });
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].kind).toBe('brand');
    expect(suggestions[0].productCount).toBe(2);
  });

  it('exposes hasNutrition on product suggestions', async () => {
    mockProducts([
      { product_id: 'a', brand: 'Vitasoy', product_name: 'A', item_name: 'milk', has_nutrition: 0, last_used_at: '2026-05-20T00:00:00Z' },
      { product_id: 'b', brand: 'Vitasoy', product_name: 'B', item_name: 'milk', has_nutrition: 1, last_used_at: '2026-05-21T00:00:00Z' },
    ]);
    const { result } = renderHook(() => useIngredientSuggestions());
    let suggestions: any[] = [];
    await act(async () => {
      suggestions = await result.current.query({ field: 'product', text: '', ingredientName: 'milk' });
    });
    const a = suggestions.find(s => s.productId === 'a');
    const b = suggestions.find(s => s.productId === 'b');
    expect(a?.hasNutrition).toBe(false);
    expect(b?.hasNutrition).toBe(true);
  });
});
