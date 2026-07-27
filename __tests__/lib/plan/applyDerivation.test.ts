import { applyDerivation } from '../../../lib/plan/applyDerivation';
import type { PlannedLine } from '../../../lib/plan/derive';
import { ItemKey } from '../../../lib/catalog/itemKey';

function line(over: Partial<PlannedLine> = {}): PlannedLine {
  return {
    itemKey: ItemKey.fromName('Beef mince'),
    name: 'Beef mince',
    qty: '750 g',
    note: null,
    category: 'Meat & Poultry',
    ...over,
  };
}

function stored(over: Record<string, unknown> = {}) {
  return {
    id: 'i1', plan_id: 'p1', item_key: 'name:beef mince',
    name: 'Beef mince', qty: '500 g', planned_qty: '500 g',
    category: 'Meat & Poultry', category_order: 0, item_order: 0,
    estimated_price: 0, is_oneoff: 0, note: null, is_checked: 0,
    ...over,
  };
}

const mockDb = { getAllAsync: jest.fn(), runAsync: jest.fn().mockResolvedValue(undefined) };

function calls(kind: 'INSERT' | 'UPDATE' | 'DELETE') {
  return mockDb.runAsync.mock.calls.filter((c) => String(c[0]).includes(kind));
}

describe('applyDerivation', () => {
  beforeEach(() => {
    mockDb.getAllAsync.mockReset().mockResolvedValue([]);
    mockDb.runAsync.mockReset().mockResolvedValue(undefined);
  });

  it('only ever reads rows the projection owns', () => {
    // Manual rows have item_key NULL and must never be considered.
    return applyDerivation(mockDb as any, 'p1', []).then(() => {
      expect(String(mockDb.getAllAsync.mock.calls[0][0])).toContain('item_key IS NOT NULL');
    });
  });

  it('inserts a line that has no stored row', async () => {
    await applyDerivation(mockDb as any, 'p1', [line()]);
    expect(calls('INSERT')).toHaveLength(1);
  });

  it('updates an unchecked planned row', async () => {
    mockDb.getAllAsync.mockResolvedValue([stored()]);
    await applyDerivation(mockDb as any, 'p1', [line()]);
    const update = calls('UPDATE')[0];
    expect(update[1]).toEqual(expect.arrayContaining(['750 g', 'i1']));
  });

  it('updates only planned_qty on a checked row, leaving qty stale', async () => {
    mockDb.getAllAsync.mockResolvedValue([stored({ is_checked: 1 })]);
    await applyDerivation(mockDb as any, 'p1', [line()]);
    const update = calls('UPDATE')[0];
    expect(String(update[0])).toContain('planned_qty');
    expect(String(update[0])).not.toMatch(/\bqty = \?/);
    expect(update[1]).toEqual(['750 g', 'i1']);
  });

  it('deletes an unchecked planned row that left the projection', async () => {
    mockDb.getAllAsync.mockResolvedValue([stored()]);
    await applyDerivation(mockDb as any, 'p1', []);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'DELETE FROM shopping_items WHERE id = ?', ['i1']);
  });

  it('retires a checked row whose key left the projection', async () => {
    mockDb.getAllAsync.mockResolvedValue([stored({ is_checked: 1 })]);
    await applyDerivation(mockDb as any, 'p1', []);
    expect(calls('DELETE')).toHaveLength(1);
  });

  it('does not duplicate a line when a product merges behind a checked row', async () => {
    // The checked row is keyed product:A. Catalog merged A into B, so the
    // projection now emits product:B for the same item. Leaving the old row
    // would shadow the new key with a permanent duplicate.
    mockDb.getAllAsync.mockResolvedValue([stored({ item_key: 'product:A', is_checked: 1 })]);
    await applyDerivation(mockDb as any, 'p1', [line({ itemKey: ItemKey.parse('product:B') })]);
    expect(calls('INSERT')).toHaveLength(1);
    expect(calls('DELETE')).toHaveLength(1);
  });

  it('writes qty and planned_qty together on an insert', async () => {
    await applyDerivation(mockDb as any, 'p1', [line()]);
    const params = calls('INSERT')[0][1] as unknown[];
    expect(params.filter((p) => p === '750 g')).toHaveLength(2);
  });

  it('carries the note onto the row', async () => {
    await applyDerivation(mockDb as any, 'p1', [line({ note: 'to drizzle' })]);
    expect(calls('INSERT')[0][1]).toEqual(expect.arrayContaining(['to drizzle']));
  });

  it('orders lines by their category position', async () => {
    await applyDerivation(mockDb as any, 'p1', [
      line({ itemKey: ItemKey.fromName('Milk'), name: 'Milk', category: 'Dairy & Fridge' }),
    ]);
    // Dairy & Fridge is index 3 in the fixed vocabulary.
    expect(calls('INSERT')[0][1]).toEqual(expect.arrayContaining([3]));
  });

  it('does nothing at all for an empty plan with no stored rows', async () => {
    await applyDerivation(mockDb as any, 'p1', []);
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });
});
