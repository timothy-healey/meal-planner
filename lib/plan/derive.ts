import type { Ingredient, Amount } from '../../meal_plan.types';
import { ItemKey } from '../catalog/itemKey';
import { scaleAmount, aggregateAmounts } from './aggregate';
import { categoryOrder, type Category } from './categories';

export interface PlanRecipeEntry {
  sortOrder: number;
  targetServes: number;
  recipe: { id: string; servings: number; ingredients: Ingredient[] };
}

export interface DeriveLookups {
  categoryFor: (key: ItemKey, name: string) => Category;
  /** `products.item_name` for a product-backed key, else null. */
  displayNameFor: (key: ItemKey) => string | null;
}

export interface PlannedLine {
  itemKey: ItemKey;
  name: string;
  qty: string;
  note: string | null;
  category: Category;
}

interface NameCandidate {
  raw: string;
  sortOrder: number;
  index: number;
}

interface Bucket {
  amounts: Amount[];
  names: NameCandidate[];
}

/**
 * Project a plan's recipes onto shopping lines.
 *
 * "Serves" here means *total serves to produce* — the opposite of the recipe
 * screen's stepper, which re-divides a fixed pot. Here the pot grows:
 * ingredients scale, per-serve macros don't.
 */
export function buildLines(
  entries: PlanRecipeEntry[],
  lookups: DeriveLookups,
): PlannedLine[] {
  const buckets = new Map<ItemKey, Bucket>();

  for (const { recipe, targetServes, sortOrder } of entries) {
    const target = Math.max(1, targetServes);
    const factor = recipe.servings > 0 ? target / recipe.servings : 1;

    recipe.ingredients.forEach((ing, index) => {
      const key = ItemKey.fromIngredient(ing);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { amounts: [], names: [] };
        buckets.set(key, bucket);
      }
      bucket.amounts.push(scaleAmount(ing.amount, factor));
      bucket.names.push({ raw: ing.item, sortOrder, index });
    });
  }

  const lines: PlannedLine[] = [];

  for (const [key, bucket] of buckets) {
    const { qty, note } = aggregateAmounts(bucket.amounts);
    const fallbackName = shortestName(bucket.names);
    lines.push({
      itemKey: key,
      name: lookups.displayNameFor(key) ?? fallbackName,
      qty,
      note,
      // Category keys off the item's own name, not the curated product name,
      // so a rename in Catalog can't silently move a line to a new aisle.
      category: lookups.categoryFor(key, fallbackName),
    });
  }

  lines.sort((a, b) =>
    categoryOrder(a.category) - categoryOrder(b.category) ||
    a.name.localeCompare(b.name));

  return lines;
}

/**
 * Shortest wins because shortest is reliably the least recipe-specific:
 * "Beef mince" over "Beef mince (lean, for ragu)". Ties break on the owning
 * recipe's position then the ingredient's index, so the chosen name is stable
 * across re-derivations rather than shuffling.
 */
function shortestName(candidates: NameCandidate[]): string {
  return [...candidates].sort((a, b) =>
    a.raw.length - b.raw.length ||
    a.sortOrder - b.sortOrder ||
    a.index - b.index)[0].raw;
}
