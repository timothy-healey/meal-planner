import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useShoppingItems } from '../../hooks/useShoppingItems';

const planId = 'plan-1';

const rows = [
  { id: 'a', plan_id: planId, category: 'Produce', category_order: 0, item_order: 0,
    name: 'Apples', qty: '1kg', estimated_price: 5, is_oneoff: 0, note: null, is_checked: 1 },
  { id: 'b', plan_id: planId, category: 'Produce', category_order: 0, item_order: 1,
    name: 'Bananas', qty: '1 bunch', estimated_price: 4, is_oneoff: 0, note: null, is_checked: 1 },
  { id: 'c', plan_id: planId, category: 'Meat', category_order: 1, item_order: 0,
    name: 'Chicken', qty: '500g', estimated_price: 8, is_oneoff: 0, note: null, is_checked: 0 },
];

const mockDb = {
  getAllAsync: jest.fn(),
  runAsync: jest.fn().mockResolvedValue(undefined),
  getFirstAsync: jest.fn(),
};

jest.mock('../../providers/DatabaseProvider', () => ({
  useDb: () => mockDb,
}));

describe('useShoppingItems.deleteChecked', () => {
  beforeEach(() => {
    mockDb.getAllAsync.mockReset();
    mockDb.runAsync.mockReset().mockResolvedValue(undefined);
    mockDb.getAllAsync.mockResolvedValue(rows);
  });

  it('issues DELETE scoped to checked rows for the active plan_id', async () => {
    const { result } = renderHook(() => useShoppingItems(planId));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.deleteChecked(); });

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'DELETE FROM shopping_items WHERE plan_id = ? AND is_checked = 1',
      [planId],
    );
  });

  it('removes checked items from local state, keeping unchecked ones', async () => {
    const { result } = renderHook(() => useShoppingItems(planId));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(3);

    await act(async () => { await result.current.deleteChecked(); });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe('c');
    expect(result.current.items[0].isChecked).toBe(false);
  });

  it('is a no-op when planId is null (does not issue SQL)', async () => {
    const { result } = renderHook(() => useShoppingItems(null));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.deleteChecked(); });

    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });
});

describe('useShoppingItems category learning', () => {
  const ROW = {
    id: 'i1', plan_id: 'p1', category: 'Unsorted', category_order: 7, item_order: 0,
    name: 'Beef mince', qty: '750 g', estimated_price: 0, is_oneoff: 0,
    note: null, is_checked: 0, item_key: 'name:beef mince', planned_qty: '750 g',
  };

  function edit(category: string) {
    return { name: 'Beef mince', qty: '750 g', estimatedPrice: 0, category, note: null };
  }

  function learnCalls() {
    return mockDb.runAsync.mock.calls.filter((c) =>
      String(c[0]).includes('item_category_map'));
  }

  beforeEach(() => {
    mockDb.getAllAsync.mockReset().mockResolvedValue([ROW]);
    mockDb.runAsync.mockReset().mockResolvedValue(undefined);
  });

  it('learns the mapped category when an item is recategorised', async () => {
    const { result } = renderHook(() => useShoppingItems('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.updateItem('i1', edit('Meat & Poultry')); });
    expect(learnCalls()[0][1]).toEqual(['name:beef mince', 'Meat & Poultry', expect.any(String)]);
  });

  it('maps a Claude name onto the fixed vocabulary before storing it', async () => {
    const { result } = renderHook(() => useShoppingItems('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.updateItem('i1', edit('Pantry (this week)')); });
    expect(learnCalls()[0][1][1]).toBe('Pantry');
  });

  it('discards a category that will not map', async () => {
    const { result } = renderHook(() => useShoppingItems('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.updateItem('i1', edit('One-offs (check pantry first)')); });
    expect(learnCalls()).toHaveLength(0);
  });

  it('does not learn when the category is unchanged', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ ...ROW, category: 'Meat & Poultry', category_order: 0 }]);
    const { result } = renderHook(() => useShoppingItems('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.updateItem('i1', edit('Meat & Poultry')); });
    expect(learnCalls()).toHaveLength(0);
  });

  it('learns against a normalised name for a hand-added row', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ ...ROW, item_key: null, name: 'Beef mince (lean)' }]);
    const { result } = renderHook(() => useShoppingItems('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.updateItem('i1',
        { ...edit('Meat & Poultry'), name: 'Beef mince (lean)' });
    });
    expect(learnCalls()[0][1][0]).toBe('name:beef mince');
  });
});
