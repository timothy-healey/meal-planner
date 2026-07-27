import type { SQLiteDatabase } from 'expo-sqlite';
import type { PlanRecipeRow, RecipeRow, WeeklyPlanRow } from '../../types/db';
import type { Ingredient } from '../../meal_plan.types';
import { buildLines, type PlanRecipeEntry } from './derive';
import { applyDerivation } from './applyDerivation';
import { ItemKey } from '../catalog/itemKey';
import { normaliseItemName } from '../catalog/normalise';
import { UNSORTED, toCategory, type Category } from './categories';

/**
 * Re-derive the active plan's shopping list, if it is self-built.
 *
 * The single derivation implementation — `usePlanRecipes.derivePlanList`
 * delegates here rather than repeating it, so the two can't drift.
 *
 * Called from every mutation that can invalidate the projection, including
 * Catalog's merge, delete and rename: those change what an `ItemKey` resolves
 * to. A no-op for imported plans.
 */
export async function reDeriveActivePlan(db: SQLiteDatabase): Promise<void> {
  const plan = await db.getFirstAsync<WeeklyPlanRow>(
    'SELECT * FROM weekly_plans WHERE is_active = 1 LIMIT 1',
  );
  if (!plan || plan.source !== 'self_built') return;

  const planRecipes = await db.getAllAsync<PlanRecipeRow>(
    'SELECT * FROM plan_recipes WHERE plan_id = ? ORDER BY sort_order',
    [plan.id],
  );

  // One query, not one per recipe. Guard the empty case: `IN ()` is a syntax
  // error, and an empty plan is normal — you just removed the last recipe.
  const ids = planRecipes.map((pr) => pr.recipe_id);
  const recipes = ids.length
    ? await db.getAllAsync<RecipeRow>(
        `SELECT * FROM recipes WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids,
      )
    : [];
  const recipeById = new Map(recipes.map((r) => [r.id, r]));

  const entries: PlanRecipeEntry[] = [];
  for (const pr of planRecipes) {
    const recipe = recipeById.get(pr.recipe_id);
    // FKs are not enforced — a deleted recipe leaves the join row behind.
    if (!recipe) continue;
    entries.push({
      sortOrder: pr.sort_order,
      targetServes: pr.target_serves,
      recipe: {
        id: recipe.id,
        servings: recipe.servings,
        ingredients: JSON.parse(recipe.ingredients_json) as Ingredient[],
      },
    });
  }

  const learned = await db.getAllAsync<{ item_key: string; category: string }>(
    'SELECT item_key, category FROM item_category_map',
  );
  const byKey = new Map<string, Category>();
  for (const r of learned) {
    const c = toCategory(r.category);
    if (c) byKey.set(r.item_key, c);
  }

  // One row per distinct name, most recent winning. Unbounded otherwise — this
  // would scan every shopping item from every plan ever, on every derivation.
  const past = await db.getAllAsync<{ name: string; category: string }>(
    `SELECT name, category FROM shopping_items
      WHERE rowid IN (SELECT MAX(rowid) FROM shopping_items GROUP BY name)`,
  );
  const byName = new Map<string, Category>();
  for (const r of past) {
    const c = toCategory(r.category);
    if (c) byName.set(normaliseItemName(r.name), c);
  }

  const products = await db.getAllAsync<{ id: string; item_name: string }>(
    'SELECT id, item_name FROM products',
  );
  const nameById = new Map(products.map((p) => [p.id, p.item_name]));

  const lines = buildLines(entries, {
    // Learned, then history, then Unsorted.
    categoryFor: (key, name) =>
      byKey.get(key) ?? byName.get(normaliseItemName(name)) ?? UNSORTED,
    displayNameFor: (key) => {
      const id = ItemKey.productId(key);
      return id ? (nameById.get(id) ?? null) : null;
    },
  });

  await applyDerivation(db, plan.id, lines);
}
