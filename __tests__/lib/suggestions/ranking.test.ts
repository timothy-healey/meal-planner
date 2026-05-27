import { dedupCandidates } from '../../../lib/suggestions/ranking';
import type { Candidate } from '../../../lib/suggestions/types';

describe('dedupCandidates', () => {
  it('groups by case-insensitive trimmed (brand, productName)', () => {
    const input: Candidate[] = [
      { brand: 'Vitasoy', productName: 'Oat Milk', itemName: 'oat milk', foodNutritionId: 'fn-1', lastUsedAt: '2026-05-20T00:00:00Z' },
      { brand: 'vitasoy ', productName: ' oat milk', itemName: null, foodNutritionId: null, lastUsedAt: '2026-05-25T00:00:00Z' },
    ];
    const result = dedupCandidates(input);
    expect(result).toHaveLength(1);
    expect(result[0].foodNutritionId).toBe('fn-1');
    expect(result[0].itemName).toBe('oat milk');
    expect(result[0].lastUsedAt).toBe('2026-05-25T00:00:00Z');
  });

  it('keeps distinct (brand, product) pairs separate', () => {
    const input: Candidate[] = [
      { brand: 'Vitasoy', productName: 'Oat Milk',  itemName: null, foodNutritionId: null, lastUsedAt: '2026-05-20T00:00:00Z' },
      { brand: 'Vitasoy', productName: 'Soy Milk',  itemName: null, foodNutritionId: null, lastUsedAt: '2026-05-21T00:00:00Z' },
    ];
    const result = dedupCandidates(input);
    expect(result).toHaveLength(2);
  });

  it('handles null productName (brand-only purchase_history rows) by grouping per brand', () => {
    const input: Candidate[] = [
      { brand: 'No-Brand', productName: null, itemName: null, foodNutritionId: null, lastUsedAt: '2026-05-20T00:00:00Z' },
      { brand: 'No-Brand', productName: null, itemName: null, foodNutritionId: null, lastUsedAt: '2026-05-21T00:00:00Z' },
    ];
    const result = dedupCandidates(input);
    expect(result).toHaveLength(1);
    expect(result[0].lastUsedAt).toBe('2026-05-21T00:00:00Z');
  });
});
