import { findDuplicateMatches } from '../../../lib/catalog/findDuplicates';
import type { ProductRow } from '../../../types/db';

function p(overrides: Partial<ProductRow>): ProductRow {
  return {
    id: 'id', brand: '', product_name: 'product', item_name: 'item',
    basis: 'per_100g',
    cal_per_basis: null, protein_per_basis: null, carbs_per_basis: null, fat_per_basis: null,
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('findDuplicateMatches', () => {
  it('returns an empty map for empty input', () => {
    expect(findDuplicateMatches([]).size).toBe(0);
  });

  it('returns an empty map when no two products share an item_name', () => {
    const result = findDuplicateMatches([
      p({ id: '1', item_name: 'chicken breast', product_name: 'Coles Chicken Breast Fillets' }),
      p({ id: '2', item_name: 'eggs',           product_name: 'Coles Eggs 12pk' }),
    ]);
    expect(result.size).toBe(0);
  });

  it('surfaces near-spelling twins within the same item_name', () => {
    const a = p({ id: '1', item_name: 'chicken breast', product_name: 'Coles Chicken Breast Fillet' });
    const b = p({ id: '2', item_name: 'chicken breast', product_name: 'Coles Chicken Breast Fillets' });
    const result = findDuplicateMatches([a, b]);
    expect(result.size).toBe(2);
    expect(result.get('1')?.twin.id).toBe('2');
    expect(result.get('2')?.twin.id).toBe('1');
  });

  it('does not match products whose product_name is too distant', () => {
    const a = p({ id: '1', item_name: 'meat', product_name: 'Chicken Breast' });
    const b = p({ id: '2', item_name: 'meat', product_name: 'Lamb Shoulder' });
    expect(findDuplicateMatches([a, b]).size).toBe(0);
  });

  it('item_name grouping is case- and whitespace-insensitive', () => {
    const a = p({ id: '1', item_name: 'Chicken Breast', product_name: 'Coles Fillet' });
    const b = p({ id: '2', item_name: 'chicken breast ', product_name: 'Coles Fillets' });
    expect(findDuplicateMatches([a, b]).size).toBe(2);
  });
});
