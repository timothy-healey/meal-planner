import { rollupMacros } from '../../lib/rollupMacros';
import type { ProductRow } from '../../types/db';
import type { Ingredient } from '../../meal_plan.types';

function makeEntry(overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    id: 'test-id',
    brand: '',
    product_name: 'chicken breast',
    item_name: 'chicken breast',
    basis: 'per_100g',
    cal_per_basis: 165,
    protein_per_basis: 31,
    carbs_per_basis: 0,
    fat_per_basis: 3.6,
    updated_at: '2026-05-24T00:00:00.000Z',
    ...overrides,
  };
}

const TWO_INGREDIENTS: Ingredient[] = [
  { item: 'chicken breast', amount: { kind: 'measured', value: 200, unit: 'g' } },
  { item: 'brown rice',     amount: { kind: 'measured', value: 150, unit: 'g' } },
];

describe('rollupMacros', () => {
  it('returns null when links is empty', () => {
    expect(rollupMacros(TWO_INGREDIENTS, {}, 2)).toBeNull();
  });

  it('calculates per-serve totals when all ingredients linked (per_100g)', () => {
    const links = {
      0: makeEntry({ cal_per_basis: 165, protein_per_basis: 31, carbs_per_basis: 0, fat_per_basis: 3.6 }),
      1: makeEntry({ item_name: 'brown rice', cal_per_basis: 130, protein_per_basis: 2.7, carbs_per_basis: 28, fat_per_basis: 0.3 }),
    };
    const result = rollupMacros(TWO_INGREDIENTS, links, 2);
    expect(result).not.toBeNull();
    expect(result!.isPartial).toBe(false);
    expect(result!.perServe.cal).toBeCloseTo(262.5);
    expect(result!.perServe.protein_g).toBeCloseTo(33.025);
  });

  it('sets isPartial true when only some ingredients have links', () => {
    const links = { 0: makeEntry() };
    const result = rollupMacros(TWO_INGREDIENTS, links, 2);
    expect(result!.isPartial).toBe(true);
  });

  it('populates contributions keyed by ingredient index', () => {
    const links = { 0: makeEntry({ protein_per_basis: 31 }) };
    const result = rollupMacros(TWO_INGREDIENTS, links, 2);
    expect(result!.contributions[0].protein_g).toBeCloseTo(62);
    expect(result!.contributions[1]).toBeUndefined();
  });

  it('handles per_100mL basis with measured mL', () => {
    const ingredients: Ingredient[] = [
      { item: 'oat milk', amount: { kind: 'measured', value: 250, unit: 'mL' } },
    ];
    const links = {
      0: makeEntry({ basis: 'per_100mL', cal_per_basis: 45 }),
    };
    const result = rollupMacros(ingredients, links, 1);
    expect(result!.perServe.cal).toBeCloseTo(112.5);
  });

  it('handles per_unit basis with measured unit', () => {
    const ingredients: Ingredient[] = [
      { item: 'egg', amount: { kind: 'measured', value: 2, unit: 'unit' } },
    ];
    const links = {
      0: makeEntry({ basis: 'per_unit', cal_per_basis: 72, protein_per_basis: 6, carbs_per_basis: 0, fat_per_basis: 5 }),
    };
    const result = rollupMacros(ingredients, links, 1);
    expect(result!.perServe.cal).toBeCloseTo(144);
  });

  it('handles per_unit basis with custom amount (multiplier = value)', () => {
    const ingredients: Ingredient[] = [
      { item: 'garlic', amount: { kind: 'custom', value: 3, unit: 'cloves' } },
    ];
    const links = {
      0: makeEntry({ basis: 'per_unit', cal_per_basis: 5, protein_per_basis: 0.2, carbs_per_basis: 1, fat_per_basis: 0 }),
    };
    const result = rollupMacros(ingredients, links, 1);
    expect(result!.perServe.cal).toBeCloseTo(15);
  });

  it('contributes 0 on basis-unit mismatch (e.g. mL amount with per_100g nutrition)', () => {
    const ingredients: Ingredient[] = [
      { item: 'honey', amount: { kind: 'measured', value: 50, unit: 'mL' } },
    ];
    const links = { 0: makeEntry({ basis: 'per_100g', cal_per_basis: 304 }) };
    const result = rollupMacros(ingredients, links, 1);
    expect(result!.perServe.cal).toBeCloseTo(0);
    expect(result!.isPartial).toBe(false); // link exists, just contributes 0
  });

  it('contributes 0 for note amounts', () => {
    const ingredients: Ingredient[] = [
      { item: 'salt', amount: { kind: 'note', text: 'to taste' } },
    ];
    const links = { 0: makeEntry({ basis: 'per_100g', cal_per_basis: 0 }) };
    const result = rollupMacros(ingredients, links, 1);
    expect(result!.perServe.cal).toBeCloseTo(0);
  });
});
