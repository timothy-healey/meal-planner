import { amountMultiplier } from './amount';
import type { ProductRow } from '../types/db';
import type { Ingredient } from '../meal_plan.types';

export interface MacroTotals {
  cal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface RollupResult {
  perServe: MacroTotals;
  isPartial: boolean;
  contributions: Record<number, MacroTotals>;
}

export function rollupMacros(
  ingredients: Ingredient[],
  links: Record<number, ProductRow>,
  servings: number,
): RollupResult | null {
  if (Object.keys(links).length === 0) return null;

  let totalCal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let linked = 0;
  const contributions: Record<number, MacroTotals> = {};

  for (let i = 0; i < ingredients.length; i++) {
    const entry = links[i];
    if (!entry) continue;
    linked++;

    const multiplier = amountMultiplier(ingredients[i].amount, entry.basis);

    const contrib: MacroTotals = {
      cal:       (entry.cal_per_basis ?? 0)     * multiplier,
      protein_g: (entry.protein_per_basis ?? 0) * multiplier,
      carbs_g:   (entry.carbs_per_basis ?? 0)   * multiplier,
      fat_g:     (entry.fat_per_basis ?? 0)     * multiplier,
    };
    contributions[i] = contrib;

    totalCal     += contrib.cal;
    totalProtein += contrib.protein_g;
    totalCarbs   += contrib.carbs_g;
    totalFat     += contrib.fat_g;
  }

  const s = servings > 0 ? servings : 1;
  return {
    perServe: {
      cal: totalCal / s,
      protein_g: totalProtein / s,
      carbs_g: totalCarbs / s,
      fat_g: totalFat / s,
    },
    isPartial: linked < ingredients.length,
    contributions,
  };
}
