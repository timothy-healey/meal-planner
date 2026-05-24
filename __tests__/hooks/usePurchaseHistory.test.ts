import { renderHook, act, waitFor } from '@testing-library/react-native';
import { usePurchaseHistory } from '../../hooks/usePurchaseHistory';

const mockRows: any[] = [];
const mockDb = {
  getAllAsync: jest.fn(async (sql: string) => {
    if (sql.includes('plan_id = ?')) return mockRows;
    if (sql.includes('LOWER(item_name)')) return mockRows;
    if (sql.includes('barcode =')) return mockRows;
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
      if (sql.includes('plan_id = ?')) return mockRows;
      if (sql.includes('LOWER(item_name)')) return mockRows;
      if (sql.includes('barcode =')) return mockRows;
      return [];
    });
  });

  it('loads records for the current plan', async () => {
    mockRows.push({
      id: '1', plan_id: 'p1', item_name: 'Chicken', store: 'Coles',
      brand: null, product_name: null, qty_amount: 500, qty_unit: 'g',
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
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('plan_id = ?')
    );
    expect(loadCall?.[0]).toMatch(/status = 'confirmed'/);
  });

  it('getLatestForItem filters to confirmed only', async () => {
    let observedSql: string | undefined;
    mockDb.getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('LOWER(item_name)')) {
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
      if (sql.includes('barcode =')) {
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
        plan_id: 'p1', item_name: 'Chicken', store: 'Coles', brand: null,
        product_name: null, qty_amount: null, qty_unit: null,
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
          plan_id: 'p1', item_name: 'Chicken', store: 'Coles', brand: null,
          product_name: null, qty_amount: null, qty_unit: null,
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

  it('addRecord inserts a row and reloads', async () => {
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.addRecord({
        plan_id: 'p1',
        item_name: 'Chicken',
        store: 'Coles',
        brand: 'Coles',
        product_name: 'RSPCA Chicken Breast',
        qty_amount: 500,
        qty_unit: 'g',
        price: 12,
        is_sale: 0,
        barcode: null,
        purchased_at: '2026-05-12T10:00:00Z',
      });
    });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO purchase_history'),
      expect.arrayContaining(['store-1'])
    );
  });

  it('getLatestForItem returns most recent non-sale record across all plans', async () => {
    const record = {
      id: '1', plan_id: 'p1', item_name: 'Chicken', store: 'Coles',
      brand: 'Coles', product_name: null, qty_amount: 500, qty_unit: 'g',
      price: 12, is_sale: 0, barcode: null, purchased_at: '2026-05-12T10:00:00Z',
    };
    mockDb.getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('LOWER(item_name)') && sql.includes('is_sale = 0')) return [record];
      return [];
    });
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const found = await result.current.getLatestForItem('chicken');
    expect(found?.brand).toBe('Coles');
  });

  it('getLatestForBarcode returns most recent record with matching barcode', async () => {
    const record = {
      id: '2', plan_id: 'p1', item_name: 'Chicken', store: 'Coles',
      brand: 'Coles', product_name: 'RSPCA', qty_amount: 500, qty_unit: 'g',
      price: 12, is_sale: 0, barcode: '9310172050024', purchased_at: '2026-05-12T10:00:00Z',
    };
    mockDb.getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('barcode =')) return [record];
      return [];
    });
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const found = await result.current.getLatestForBarcode('9310172050024');
    expect(found?.product_name).toBe('RSPCA');
  });
});
