import { dedupCandidates, projectBrands } from '../../../lib/suggestions/ranking';
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

describe('projectBrands', () => {
  it('returns one suggestion per case-insensitive brand', () => {
    const input: Candidate[] = [
      { brand: 'Vitasoy',  productName: 'Oat Milk',  itemName: 'oat milk',   foodNutritionId: 'a', lastUsedAt: '2026-05-20T00:00:00Z' },
      { brand: 'vitasoy',  productName: 'Soy Milk',  itemName: 'soy milk',   foodNutritionId: 'b', lastUsedAt: '2026-05-25T00:00:00Z' },
      { brand: 'So Good',  productName: 'Almond',    itemName: 'almond milk',foodNutritionId: 'c', lastUsedAt: '2026-05-22T00:00:00Z' },
    ];
    const result = projectBrands(input);
    expect(result).toHaveLength(2);
    const vitasoy = result.find(b => b.brand.toLowerCase() === 'vitasoy')!;
    expect(vitasoy.productCount).toBe(2);
    expect(vitasoy.latestProductName).toBe('Soy Milk');
    expect(vitasoy.lastUsedAt).toBe('2026-05-25T00:00:00Z');
  });

  it('uses the first-seen capitalisation of the brand', () => {
    const input: Candidate[] = [
      { brand: 'Vitasoy', productName: 'A', itemName: null, foodNutritionId: null, lastUsedAt: '2026-05-20T00:00:00Z' },
      { brand: 'VITASOY', productName: 'B', itemName: null, foodNutritionId: null, lastUsedAt: '2026-05-21T00:00:00Z' },
    ];
    expect(projectBrands(input)[0].brand).toBe('Vitasoy');
  });
});

import { recencyMultiplier, itemNameMatches } from '../../../lib/suggestions/ranking';

describe('recencyMultiplier', () => {
  it('returns 0.8 for today (max boost)', () => {
    const now = Date.parse('2026-05-27T12:00:00Z');
    expect(recencyMultiplier('2026-05-27T12:00:00Z', now)).toBeCloseTo(0.8, 2);
  });

  it('returns ~0.93 for 30 days ago', () => {
    const now = Date.parse('2026-05-27T12:00:00Z');
    const thirtyDaysAgo = '2026-04-27T12:00:00Z';
    const m = recencyMultiplier(thirtyDaysAgo, now);
    expect(m).toBeGreaterThan(0.92);
    expect(m).toBeLessThan(0.94);
  });

  it('approaches 1.0 for ancient dates', () => {
    const now = Date.parse('2026-05-27T12:00:00Z');
    expect(recencyMultiplier('2020-01-01T00:00:00Z', now)).toBeCloseTo(1.0, 2);
  });

  it('clamps negative deltas (future dates) to 0 days', () => {
    const now = Date.parse('2026-05-27T12:00:00Z');
    expect(recencyMultiplier('2026-12-01T00:00:00Z', now)).toBeCloseTo(0.8, 2);
  });
});

describe('itemNameMatches', () => {
  it('returns true on a close fuzzy match', () => {
    expect(itemNameMatches('oat milk', 'milk')).toBe(true);
    expect(itemNameMatches('rolled oats', 'oats')).toBe(true);
  });

  it('returns false on dissimilar strings', () => {
    expect(itemNameMatches('chicken thigh', 'milk')).toBe(false);
  });

  it('returns false when either side is null or empty', () => {
    expect(itemNameMatches(null, 'milk')).toBe(false);
    expect(itemNameMatches('milk', '')).toBe(false);
  });
});

import { rankEmptyQuery } from '../../../lib/suggestions/ranking';
import type { Suggestion } from '../../../lib/suggestions/types';

describe('rankEmptyQuery', () => {
  const baseTargets: Suggestion[] = [
    { kind: 'product', brand: 'Vitasoy', productName: 'Oat Milk Barista',  lastUsedAt: '2026-04-20T00:00:00Z', foodNutritionId: 'a', matches: [] },
    { kind: 'product', brand: 'So Good', productName: 'Almond Unsweetened',lastUsedAt: '2026-05-26T00:00:00Z', foodNutritionId: 'b', matches: [] },
    { kind: 'product', brand: 'Coles',   productName: 'Chicken Breast',    lastUsedAt: '2026-05-27T00:00:00Z', foodNutritionId: 'c', matches: [] },
  ];

  it('item-name match outranks pure recency', () => {
    const itemNameById = new Map([
      ['a', 'oat milk'],
      ['b', 'almond milk'],
      ['c', 'chicken breast'],
    ]);
    const result = rankEmptyQuery(baseTargets, 'milk', id => itemNameById.get(id) ?? null);
    expect(result[0].foodNutritionId).toBe('b');
    expect(result[1].foodNutritionId).toBe('a');
    expect(result[2].foodNutritionId).toBe('c');
  });

  it('within matches, sorts by lastUsedAt descending', () => {
    const itemNameById = new Map([['a', 'oat milk'], ['b', 'oat milk'], ['c', 'oat milk']]);
    const result = rankEmptyQuery(baseTargets, 'oat milk', id => itemNameById.get(id) ?? null);
    expect(result.map(r => r.foodNutritionId)).toEqual(['c', 'b', 'a']);
  });

  it('caps results at 5', () => {
    const many: Suggestion[] = Array.from({ length: 10 }, (_, i) => ({
      kind: 'product' as const, brand: `B${i}`, productName: `P${i}`,
      lastUsedAt: `2026-05-${10 + i}T00:00:00Z`, foodNutritionId: `id-${i}`, matches: [],
    }));
    expect(rankEmptyQuery(many, 'milk', () => null)).toHaveLength(5);
  });

  it('all rows have empty matches array', () => {
    const result = rankEmptyQuery(baseTargets, 'milk', () => null);
    for (const row of result) expect(row.matches).toEqual([]);
  });
});
