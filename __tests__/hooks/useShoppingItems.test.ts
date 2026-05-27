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

describe('useShoppingItems.resetAll', () => {
  beforeEach(() => {
    mockDb.getAllAsync.mockReset();
    mockDb.runAsync.mockReset().mockResolvedValue(undefined);
    mockDb.getAllAsync.mockResolvedValue(rows);
  });

  it('issues UPDATE setting is_checked = 0 scoped to the active plan_id', async () => {
    const { result } = renderHook(() => useShoppingItems(planId));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.resetAll(); });

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'UPDATE shopping_items SET is_checked = 0 WHERE plan_id = ?',
      [planId],
    );
  });

  it('updates local state so all items become isChecked = false after resetAll', async () => {
    const { result } = renderHook(() => useShoppingItems(planId));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.filter((i) => i.isChecked)).toHaveLength(2);

    await act(async () => { await result.current.resetAll(); });

    expect(result.current.items.every((i) => i.isChecked === false)).toBe(true);
    expect(result.current.items.every((i) => i.is_checked === 0)).toBe(true);
  });

  it('is a no-op when planId is null (does not issue SQL)', async () => {
    const { result } = renderHook(() => useShoppingItems(null));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.resetAll(); });

    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });
});

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
