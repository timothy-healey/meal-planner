import { renderHook, act, waitFor } from '@testing-library/react-native';
import { usePurchaseHistory } from '../../hooks/usePurchaseHistory';

const mockRows: any[] = [];
const mockDb = {
  getAllAsync: jest.fn(async (sql: string) => {
    if (sql.includes('ph.plan_id = ?')) return mockRows;
    if (sql.includes('LOWER(ph.item_name)')) return mockRows;
    if (sql.includes('ph.barcode =')) return mockRows;
    return [];
  }),
  getFirstAsync: jest.fn().mockResolvedValue({ id: 'store-1' }),
  runAsync: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../providers/DatabaseProvider', () => ({
  useDb: () => mockDb,
}));

describe('usePurchaseHistory', () => {
  beforeEach(() => {
    mockRows.length = 0;
    mockDb.getAllAsync.mockClear();
    mockDb.getFirstAsync.mockClear();
    mockDb.runAsync.mockClear();
    mockDb.getFirstAsync.mockResolvedValue({ id: 'store-1' });
    mockDb.getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('ph.plan_id = ?')) return mockRows;
      if (sql.includes('LOWER(ph.item_name)')) return mockRows;
      if (sql.includes('ph.barcode =')) return mockRows;
      return [];
    });
  });

  it('loads records for the current plan', async () => {
    mockRows.push({
      id: '1', plan_id: 'p1', item_name: 'Chicken', store_id: 's1',
      product_id: 'pp1', brand: null, product_name: null,
      qty_amount: 500, qty_unit: 'g',
      price: 12, is_sale: 0, barcode: null, purchased_at: '2026-05-12T10:00:00Z',
      status: 'confirmed',
    });
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.records).toHaveLength(1);
  });

  it('load excludes pending rows (SQL has status = confirmed)', async () => {
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const loadCall = mockDb.getAllAsync.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('ph.plan_id = ?')
    );
    expect(loadCall?.[0]).toMatch(/status = 'confirmed'/);
  });

  it('getLatestForItem filters to confirmed only', async () => {
    let observedSql: string | undefined;
    mockDb.getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('LOWER(ph.item_name)')) {
        observedSql = sql;
        return [];
      }
      return [];
    });
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await result.current.getLatestForItem('chicken');
    expect(observedSql).toMatch(/status = 'confirmed'/);
  });

  it('getLatestForBarcode filters to confirmed only', async () => {
    let observedSql: string | undefined;
    mockDb.getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('ph.barcode =')) {
        observedSql = sql;
        return [];
      }
      return [];
    });
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await result.current.getLatestForBarcode('9310172050024');
    expect(observedSql).toMatch(/status = 'confirmed'/);
  });

  it("addRecord defaults to status='confirmed'", async () => {
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.addRecord({
        plan_id: 'p1', item_name: 'Chicken', store: 'Coles',
        product_id: null, qty_amount: null, qty_unit: null,
        price: 10, is_sale: 0, barcode: null,
        purchased_at: '2026-05-12T10:00:00Z',
      });
    });
    const insert = mockDb.runAsync.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('INSERT INTO purchase_history')
    );
    expect(insert?.[1]).toContain('confirmed');
  });

  it("addRecord writes status='pending' when requested", async () => {
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.addRecord(
        {
          plan_id: 'p1', item_name: 'Chicken', store: 'Coles',
          product_id: null, qty_amount: null, qty_unit: null,
          price: 10, is_sale: 0, barcode: null,
          purchased_at: '2026-05-12T10:00:00Z',
        },
        'pending',
      );
    });
    const insert = mockDb.runAsync.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('INSERT INTO purchase_history')
    );
    expect(insert?.[1]).toContain('pending');
  });

  it('addRecord stores product_id and not brand/product_name', async () => {
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.addRecord({
        plan_id: 'p1',
        item_name: 'Chicken',
        store: 'Coles',
        product_id: 'prod-1',
        qty_amount: 500,
        qty_unit: 'g',
        price: 12.50,
        is_sale: 0,
        barcode: null,
        purchased_at: '2026-05-28T00:00:00Z',
      });
    });
    const insert = mockDb.runAsync.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('INSERT INTO purchase_history')
    );
    expect(insert?.[0]).toMatch(/INSERT INTO purchase_history[\s\S]*product_id/);
    expect(insert?.[1]).toEqual(expect.arrayContaining(['prod-1']));
  });

  it('getLatestForItem returns the joined row (brand/product_name from products)', async () => {
    const record = {
      id: '1', plan_id: 'p1', item_name: 'Chicken', store_id: 'store-1',
      product_id: 'prod-1', brand: 'Coles', product_name: 'RSPCA Chicken Breast',
      qty_amount: 500, qty_unit: 'g',
      price: 12, is_sale: 0, barcode: null, purchased_at: '2026-05-12T10:00:00Z',
      status: 'confirmed',
    };
    mockDb.getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('LOWER(ph.item_name)') && sql.includes('is_sale = 0')) return [record];
      return [];
    });
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const found = await result.current.getLatestForItem('chicken');
    expect(found?.brand).toBe('Coles');
    expect(found?.product_name).toBe('RSPCA Chicken Breast');
  });

  it('getLatestForBarcode returns the joined row with product fields', async () => {
    const record = {
      id: '2', plan_id: 'p1', item_name: 'Chicken', store_id: 'store-1',
      product_id: 'prod-1', brand: 'Coles', product_name: 'RSPCA',
      qty_amount: 500, qty_unit: 'g',
      price: 12, is_sale: 0, barcode: '9310172050024', purchased_at: '2026-05-12T10:00:00Z',
      status: 'confirmed',
    };
    mockDb.getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('ph.barcode =')) return [record];
      return [];
    });
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const found = await result.current.getLatestForBarcode('9310172050024');
    expect(found?.product_name).toBe('RSPCA');
  });

  it('deletePending issues a delete scoped to plan + item name + pending', async () => {
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.deletePending('p1', 'Chicken');
    });
    const del = mockDb.runAsync.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('DELETE FROM purchase_history')
    );
    expect(del?.[0]).toMatch(/plan_id = \?/);
    expect(del?.[0]).toMatch(/LOWER\(item_name\) = LOWER\(\?\)/);
    expect(del?.[0]).toMatch(/status = 'pending'/);
    expect(del?.[1]).toEqual(['p1', 'Chicken']);
  });

  it('updatePending updates an existing pending row in place', async () => {
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.updatePending('row-1', {
        plan_id: 'p1', item_name: 'Chicken', store: 'Coles',
        product_id: 'prod-2', qty_amount: 500, qty_unit: 'g',
        price: 13.5, is_sale: 0, barcode: null,
        purchased_at: '2026-05-12T10:00:00Z',
      });
    });
    const upd = mockDb.runAsync.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('UPDATE purchase_history')
    );
    expect(upd?.[0]).toMatch(/WHERE id = \? AND status = 'pending'/);
    expect(upd?.[1]?.[upd[1].length - 1]).toBe('row-1');
  });

  it('confirmShop runs the bulk update and deletes checked items in a transaction', async () => {
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.confirmShop('p1'); });

    const calls = mockDb.runAsync.mock.calls.map((c: any[]) => c[0] as string);
    expect(calls).toEqual(expect.arrayContaining([
      expect.stringContaining('BEGIN'),
      expect.stringMatching(/UPDATE purchase_history SET status = 'confirmed' WHERE plan_id = \? AND status = 'pending'/),
      expect.stringMatching(/DELETE FROM shopping_items WHERE plan_id = \? AND is_checked = 1/),
      expect.stringContaining('COMMIT'),
    ]));
  });

  it('addRecord resolves store by (chain, branch) tuple', async () => {
    mockDb.getFirstAsync.mockImplementation(async (sql: string, params: any[]) => {
      expect(sql).toMatch(/LOWER\(chain\) = LOWER\(\?\)/);
      expect(sql).toMatch(/LOWER\(branch\) = LOWER\(\?\)/);
      expect(params).toEqual(['Coles', 'Bondi']);
      return { id: 'store-bondi' };
    });
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.addRecord({
        plan_id: 'p1', item_name: 'Chicken', store: 'Coles', branch: 'Bondi',
        product_id: null, qty_amount: null, qty_unit: null,
        price: 10, is_sale: 0, barcode: null,
        purchased_at: '2026-05-12T10:00:00Z',
      });
    });
    const insert = mockDb.runAsync.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('INSERT INTO purchase_history')
    );
    expect(insert?.[1]).toContain('store-bondi');
  });

  it('pendingRecords reflects pending rows for the active plan', async () => {
    const pendingRow = {
      id: '1', plan_id: 'p1', item_name: 'Chicken', store_id: 's1',
      product_id: null, brand: null, product_name: null,
      qty_amount: null, qty_unit: null,
      price: 10, is_sale: 0, barcode: null,
      purchased_at: '2026-05-12T10:00:00Z', status: 'pending',
    };
    mockDb.getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes("status = 'pending'") && sql.includes('ph.plan_id = ?')) {
        return [pendingRow];
      }
      return [];
    });
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pendingRecords).toHaveLength(1);
    expect(result.current.pendingRecords[0].status).toBe('pending');
  });
});
