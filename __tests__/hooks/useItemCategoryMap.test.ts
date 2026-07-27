import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useItemCategoryMap } from '../../hooks/useItemCategoryMap';
import { ItemKey } from '../../lib/catalog/itemKey';

const mockDb = {
  getAllAsync: jest.fn().mockResolvedValue([]),
  runAsync: jest.fn().mockResolvedValue(undefined),
};
jest.mock('../../providers/DatabaseProvider', () => ({ useDb: () => mockDb }));

/** load() reads item_category_map first, then shopping_items. */
function mockTiers(learned: unknown[], history: unknown[]) {
  mockDb.getAllAsync
    .mockReset()
    .mockResolvedValueOnce(learned)
    .mockResolvedValueOnce(history)
    .mockResolvedValue([]);
}

describe('useItemCategoryMap', () => {
  beforeEach(() => {
    mockDb.getAllAsync.mockReset().mockResolvedValue([]);
    mockDb.runAsync.mockReset().mockResolvedValue(undefined);
  });

  it('loads the learned map', async () => {
    mockTiers([{ item_key: 'name:beef mince', category: 'Meat & Poultry' }], []);
    const { result } = renderHook(() => useItemCategoryMap());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categoryFor(ItemKey.fromName('Beef mince'), 'Beef mince'))
      .toBe('Meat & Poultry');
  });

  it('falls back to shopping history when the key is unlearned', async () => {
    // This tier is the 47% the spec measured — without it every item lands in
    // Unsorted until corrected by hand once.
    mockTiers([], [{ name: 'Beef mince (lean)', category: 'Meat & Poultry' }]);
    const { result } = renderHook(() => useItemCategoryMap());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categoryFor(ItemKey.fromName('Beef mince'), 'Beef mince'))
      .toBe('Meat & Poultry');
  });

  it('prefers a learned category over a historical match', async () => {
    mockTiers(
      [{ item_key: 'name:beef mince', category: 'Frozen' }],
      [{ name: 'Beef mince', category: 'Meat & Poultry' }],
    );
    const { result } = renderHook(() => useItemCategoryMap());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categoryFor(ItemKey.fromName('Beef mince'), 'Beef mince'))
      .toBe('Frozen');
  });

  it('discards an unmappable historical category rather than propagating drift', async () => {
    mockTiers([], [{ name: 'Beef mince', category: 'One-offs (check pantry first)' }]);
    const { result } = renderHook(() => useItemCategoryMap());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categoryFor(ItemKey.fromName('Beef mince'), 'Beef mince'))
      .toBe('Unsorted');
  });

  it('normalises a Claude suffix out of a historical category', async () => {
    mockTiers([], [{ name: 'Rice', category: 'Pantry (this week)' }]);
    const { result } = renderHook(() => useItemCategoryMap());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categoryFor(ItemKey.fromName('Rice'), 'Rice')).toBe('Pantry');
  });

  it('falls back to Unsorted for an unknown key', async () => {
    const { result } = renderHook(() => useItemCategoryMap());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categoryFor(ItemKey.fromName('Nope'), 'Nope')).toBe('Unsorted');
  });

  it('learns a category, mapping it onto the fixed vocabulary first', async () => {
    const { result } = renderHook(() => useItemCategoryMap());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.learn(ItemKey.fromName('Beef mince'), 'Pantry (this week)');
    });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO item_category_map'),
      ['name:beef mince', 'Pantry', expect.any(String)],
    );
  });

  it('discards a category that will not map, rather than storing Claude drift', async () => {
    const { result } = renderHook(() => useItemCategoryMap());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.learn(ItemKey.fromName('Beef'), 'One-offs (check pantry first)');
    });
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it('makes a freshly learned category available without a reload', async () => {
    const { result } = renderHook(() => useItemCategoryMap());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.learn(ItemKey.fromName('Beef mince'), 'Frozen');
    });
    expect(result.current.categoryFor(ItemKey.fromName('Beef mince'), 'Beef mince'))
      .toBe('Frozen');
  });
});
