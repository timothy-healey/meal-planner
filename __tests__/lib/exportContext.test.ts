import { buildClaudeContext } from '../../lib/exportContext';

describe('buildClaudeContext', () => {
  const mockDb = {
    getFirstAsync: jest.fn(),
    getAllAsync: jest.fn(),
  };

  beforeEach(() => {
    mockDb.getFirstAsync.mockReset();
    mockDb.getAllAsync.mockReset();
    mockDb.getFirstAsync.mockImplementation((sql: string) => {
      if (sql.includes('weekly_plans')) {
        return Promise.resolve({ week_starting: '2026-05-18' });
      }
      return Promise.resolve(null);
    });
  });

  it('returns valid JSON with correct shape when no purchases', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);
    const result = await buildClaudeContext(mockDb as any, 'plan-1');
    const parsed = JSON.parse(result);
    expect(parsed.purchases).toEqual([]);
    expect(parsed.week_starting).toBe('2026-05-18');
    expect(typeof parsed.generated_at).toBe('string');
  });

  it('resolves nutrition from barcode_nutrition for purchases with a barcode', async () => {
    mockDb.getAllAsync.mockResolvedValue([{
      item_name: 'oat milk', brand: 'Vitasoy', product_name: 'Oat Milk Barista',
      product_id: 'prod-1',
      store: 'Coles', qty_amount: 1000, qty_unit: 'mL', price: 2.80,
      is_sale: 0, barcode: '9310123456789',
    }]);
    mockDb.getFirstAsync.mockImplementation((sql: string) => {
      if (sql.includes('weekly_plans')) return Promise.resolve({ week_starting: '2026-05-18' });
      if (sql.includes('barcode_nutrition')) return Promise.resolve({
        cal_per_100g: 45, protein_per_100g: 1, carbs_per_100g: 4.5, fat_per_100g: 1.5,
      });
      return Promise.resolve(null);
    });
    const result = await buildClaudeContext(mockDb as any, 'plan-1');
    const parsed = JSON.parse(result);
    expect(parsed.purchases[0].nutrition.calories).toBe(45);
    expect(parsed.purchases[0].nutrition_basis).toBe('per_100g');
    expect(parsed.purchases[0].barcode).toBe('9310123456789');
  });

  it('falls back to products lookup via product_id when no barcode', async () => {
    mockDb.getAllAsync.mockResolvedValue([{
      item_name: 'chicken breast', brand: 'Lilydale', product_name: 'Free Range',
      product_id: 'prod-1',
      store: 'Coles', qty_amount: 500, qty_unit: 'g', price: 12.50,
      is_sale: 0, barcode: null,
    }]);
    mockDb.getFirstAsync.mockImplementation((sql: string) => {
      if (sql.includes('weekly_plans')) return Promise.resolve({ week_starting: '2026-05-18' });
      if (sql.includes('FROM products')) return Promise.resolve({
        basis: 'per_100g', cal_per_basis: 165, protein_per_basis: 31,
        carbs_per_basis: 0, fat_per_basis: 3.6,
      });
      return Promise.resolve(null);
    });
    const result = await buildClaudeContext(mockDb as any, 'plan-1');
    const parsed = JSON.parse(result);
    expect(parsed.purchases[0].nutrition.calories).toBe(165);
    expect(parsed.purchases[0].nutrition_basis).toBe('per_100g');
  });

  it('omits nutrition key when no match found for a purchase', async () => {
    mockDb.getAllAsync.mockResolvedValue([{
      item_name: 'mystery herb', brand: null, product_name: null, product_id: null,
      store: 'Coles', qty_amount: null, qty_unit: null, price: 1.00,
      is_sale: 0, barcode: null,
    }]);
    const result = await buildClaudeContext(mockDb as any, 'plan-1');
    const parsed = JSON.parse(result);
    expect(parsed.purchases[0].nutrition).toBeUndefined();
    expect(parsed.purchases[0].item).toBe('mystery herb');
  });

  it('only exports confirmed purchases', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);
    await buildClaudeContext(mockDb as any, 'plan-1');
    const sqls = mockDb.getAllAsync.mock.calls.map((c: any[]) => c[0] as string);
    expect(sqls.some(s => /status = 'confirmed'/.test(s))).toBe(true);
  });
});
