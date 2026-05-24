import { rollupMacros } from '../../lib/rollupMacros';
import type { FoodNutritionRow } from '../../types/db';
import type { Ingredient } from '../../meal_plan.types';

function makeEntry(overrides: Partial<FoodNutritionRow> = {}): FoodNutritionRow {
  return {
    id: 'test-id',
    item_name: 'chicken breast',
    brand: null,
    product_name: null,
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
  { item: 'chicken breast', amount: '200g' },
  { item: 'brown rice', amount: '150g' },
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
    // chicken: 200/100*165=330, rice: 150/100*130=195 → total 525, /2 = 262.5
    expect(result!.perServe.cal).toBeCloseTo(262.5);
    // chicken: 200/100*31=62, rice: 150/100*2.7=4.05 → 66.05, /2 = 33.025
    expect(result!.perServe.protein_g).toBeCloseTo(33.025);
  });

  it('sets isPartial true when only some ingredients have links', () => {
    const links = { 0: makeEntry() }; // only ingredient 0 linked
    const result = rollupMacros(TWO_INGREDIENTS, links, 2);
    expect(result).not.toBeNull();
    expect(result!.isPartial).toBe(true);
  });

  it('populates contributions keyed by ingredient index', () => {
    const links = { 0: makeEntry({ protein_per_basis: 31 }) }; // 200g chicken
    const result = rollupMacros(TWO_INGREDIENTS, links, 2);
    // 200/100 * 31 = 62g protein for ingredient 0
    expect(result!.contributions[0].protein_g).toBeCloseTo(62);
    expect(result!.contributions[1]).toBeUndefined();
  });

  it('handles per_100mL basis', () => {
    const ingredients: Ingredient[] = [{ item: 'oat milk', amount: '250mL' }];
    const links = {
      0: makeEntry({ basis: 'per_100mL', cal_per_basis: 45, protein_per_basis: 1, carbs_per_basis: 4.5, fat_per_basis: 1.5 }),
    };
    const result = rollupMacros(ingredients, links, 1);
    // 250/100 * 45 = 112.5
    expect(result!.perServe.cal).toBeCloseTo(112.5);
  });

  it('handles per_unit basis', () => {
    const ingredients: Ingredient[] = [{ item: 'egg', amount: '2 eggs' }];
    const links = {
      0: makeEntry({ basis: 'per_unit', cal_per_basis: 72, protein_per_basis: 6, carbs_per_basis: 0, fat_per_basis: 5 }),
    };
    const result = rollupMacros(ingredients, links, 1);
    // 2 * 72 = 144
    expect(result!.perServe.cal).toBeCloseTo(144);
  });

  it('treats unparseable amount as 0 contribution', () => {
    const ingredients: Ingredient[] = [{ item: 'salt', amount: '1 tsp' }];
    const links = { 0: makeEntry({ cal_per_basis: 0, protein_per_basis: 0, carbs_per_basis: 0, fat_per_basis: 0 }) };
    const result = rollupMacros(ingredients, links, 1);
    expect(result!.perServe.cal).toBeCloseTo(0);
  });
});
