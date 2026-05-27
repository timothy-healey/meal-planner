import { useCallback } from 'react';
import { useDb, usePlanVersion } from '../providers/DatabaseProvider';
import type { Ingredient } from '../meal_plan.types';
import type { RecipeRow } from '../types/db';
import { parseAmountString } from '../lib/amount';

// Coerce legacy v1.1 string amounts. Mirrors useRecipes.coerceIngredient.
function coerceIngredient(raw: { item: string; amount: unknown }): Ingredient {
  if (typeof raw.amount === 'string') {
    return { item: raw.item, amount: parseAmountString(raw.amount) };
  }
  return raw as Ingredient;
}

// Pure helper, exported for unit testing.
export function reindexLinksOnDelete(
  linkIndices: Record<number, unknown>,
  deletedIndex: number,
): { toDelete: number[]; toShift: { from: number; to: number }[] } {
  const indices = Object.keys(linkIndices).map(Number).sort((a, b) => a - b);
  const toDelete: number[] = [];
  const toShift: { from: number; to: number }[] = [];
  for (const i of indices) {
    if (i === deletedIndex) toDelete.push(i);
    else if (i > deletedIndex) toShift.push({ from: i, to: i - 1 });
  }
  return { toDelete, toShift };
}

export function useRecipeIngredients() {
  const db = useDb();
  const { bumpPlanVersion } = usePlanVersion();

  const readIngredients = useCallback(async (recipeId: string): Promise<Ingredient[]> => {
    const row = await db.getFirstAsync<Pick<RecipeRow, 'ingredients_json'>>(
      'SELECT ingredients_json FROM recipes WHERE id = ?',
      [recipeId],
    );
    if (!row) return [];
    const raw = JSON.parse(row.ingredients_json);
    return raw.map(coerceIngredient);
  }, [db]);

  const writeIngredients = useCallback(async (recipeId: string, ingredients: Ingredient[]) => {
    await db.runAsync(
      'UPDATE recipes SET ingredients_json = ? WHERE id = ?',
      [JSON.stringify(ingredients), recipeId],
    );
  }, [db]);

  const updateIngredient = useCallback(async (
    recipeId: string,
    index: number,
    ingredient: Ingredient,
  ) => {
    const current = await readIngredients(recipeId);
    if (index < 0 || index >= current.length) return;
    const next = [...current];
    next[index] = ingredient;
    await writeIngredients(recipeId, next);
    bumpPlanVersion();
  }, [readIngredients, writeIngredients, bumpPlanVersion]);

  const addIngredient = useCallback(async (
    recipeId: string,
    ingredient: Ingredient,
  ): Promise<number> => {
    const current = await readIngredients(recipeId);
    const next = [...current, ingredient];
    await writeIngredients(recipeId, next);
    bumpPlanVersion();
    return next.length - 1;
  }, [readIngredients, writeIngredients, bumpPlanVersion]);

  const deleteIngredient = useCallback(async (
    recipeId: string,
    index: number,
  ) => {
    const current = await readIngredients(recipeId);
    if (index < 0 || index >= current.length) return;
    const next = current.filter((_, i) => i !== index);

    await db.withTransactionAsync(async () => {
      await writeIngredients(recipeId, next);
      const links = await db.getAllAsync<{ ingredient_index: number }>(
        'SELECT ingredient_index FROM ingredient_nutrition_link WHERE recipe_id = ?',
        [recipeId],
      );
      const linkMap: Record<number, true> = {};
      for (const l of links) linkMap[l.ingredient_index] = true;
      const plan = reindexLinksOnDelete(linkMap, index);
      for (const i of plan.toDelete) {
        await db.runAsync(
          'DELETE FROM ingredient_nutrition_link WHERE recipe_id = ? AND ingredient_index = ?',
          [recipeId, i],
        );
      }
      // Shift downward — apply in ascending order to avoid colliding with unmoved rows.
      for (const { from, to } of plan.toShift) {
        await db.runAsync(
          'UPDATE ingredient_nutrition_link SET ingredient_index = ? WHERE recipe_id = ? AND ingredient_index = ?',
          [to, recipeId, from],
        );
      }
    });
    bumpPlanVersion();
  }, [readIngredients, writeIngredients, bumpPlanVersion, db]);

  return { updateIngredient, addIngredient, deleteIngredient };
}
