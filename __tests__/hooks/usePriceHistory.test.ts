import { renderHook, waitFor } from '@testing-library/react-native';
import { usePriceHistory } from '../../hooks/usePriceHistory';

const mockDb = {
  getAllAsync: jest.fn().mockResolvedValue([]),
};

jest.mock('../../providers/DatabaseProvider', () => ({
  useDb: () => mockDb,
}));

const makeRow = (overrides = {}) => ({
  id: '1',
  plan_id: null,
  item_name: 'Oats',
  store_id: 's1',
  brand: 'Woolworths',
  product_name: 'Rolled Oats 1kg',
  qty_amount: 1000,
  qty_unit: 'g',
  price: 4.50,
  is_sale: 0,
  barcode: null,
  purchased_at: '2026-01-15T10:00:00Z',
  chain: 'Woolworths',
  ...overrides,
});

describe('usePriceHistory', () => {
  beforeEach(() => {
    mockDb.getAllAsync.mockClear();
    mockDb.getAllAsync.mockResolvedValue([]);
  });

  it('returns empty array when brand or productName is null', async () => {
    const { result } = renderHook(() => usePriceHistory(null, null));
    await waitFor(() => expect(result.current.points).toEqual([]));
    expect(mockDb.getAllAsync).not.toHaveBeenCalled();
  });

  it('queries by brand and product_name', async () => {
    mockDb.getAllAsync.mockResolvedValue([makeRow()]);
    const { result } = renderHook(() =>
      usePriceHistory('Woolworths', 'Rolled Oats 1kg'),
    );
    await waitFor(() => expect(result.current.points).toHaveLength(1));
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('ph.brand = ?'),
      ['Woolworths', 'Rolled Oats 1kg'],
    );
  });

  it('normalises g price to ¢/100g', async () => {
    mockDb.getAllAsync.mockResolvedValue([makeRow({ price: 4.50, qty_amount: 1000, qty_unit: 'g' })]);
    const { result } = renderHook(() =>
      usePriceHistory('Woolworths', 'Rolled Oats 1kg'),
    );
    await waitFor(() => expect(result.current.points).toHaveLength(1));
    expect(result.current.points[0].normalisedPrice).toBeCloseTo(0.45);
  });

  it('maps isOnSale correctly', async () => {
    mockDb.getAllAsync.mockResolvedValue([makeRow({ is_sale: 1 })]);
    const { result } = renderHook(() =>
      usePriceHistory('Woolworths', 'Rolled Oats 1kg'),
    );
    await waitFor(() => expect(result.current.points).toHaveLength(1));
    expect(result.current.points[0].isOnSale).toBe(true);
  });

  it('exposes a reload function', async () => {
    const { result } = renderHook(() =>
      usePriceHistory('Woolworths', 'Rolled Oats 1kg'),
    );
    await waitFor(() => expect(result.current.points).toBeDefined());
    expect(typeof result.current.reload).toBe('function');
  });

  it('queries only confirmed purchase rows', async () => {
    const { result } = renderHook(() =>
      usePriceHistory('Woolworths', 'Rolled Oats 1kg'),
    );
    await waitFor(() => expect(result.current.points).toEqual([]));
    const sqlCalls = mockDb.getAllAsync.mock.calls.map((c: any[]) => c[0] as string);
    expect(sqlCalls.some(s => /status = 'confirmed'/.test(s))).toBe(true);
  });
});
