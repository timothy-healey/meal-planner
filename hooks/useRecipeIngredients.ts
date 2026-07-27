import { useCallback } from 'react';
import { reDeriveActivePlan } from '../lib/plan/reDeriveActivePlan';
import { useDb, usePlanVersion } from '../providers/DatabaseProvider';
import type { Ingredient } from '../meal_plan.types';
import type { RecipeRow } from '../types/db';
import { parseAmountString } from '../lib/amount';

function coerceIngredient(raw: { item: string; amount: unknown }): Ingredient {
  if (typeof raw.amount === 'string') {
    return { item: raw.item, amount: parseAmountString(raw.amount) };
  }
  return raw as Ingredient;
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
    await reDeriveActivePlan(db);
    bumpPlanVersion();
  }, [readIngredients, writeIngredients, bumpPlanVersion, db]);

  const addIngredient = useCallback(async (
    recipeId: string,
    ingredient: Ingredient,
  ): Promise<number> => {
    const current = await readIngredients(recipeId);
    const next = [...current, ingredient];
    await writeIngredients(recipeId, next);
    await reDeriveActivePlan(db);
    bumpPlanVersion();
    return next.length - 1;
  }, [readIngredients, writeIngredients, bumpPlanVersion, db]);

  const deleteIngredient = useCallback(async (
    recipeId: string,
    index: number,
  ) => {
    const current = await readIngredients(recipeId);
    if (index < 0 || index >= current.length) return;
    const next = current.filter((_, i) => i !== index);
    await writeIngredients(recipeId, next);
    await reDeriveActivePlan(db);
    bumpPlanVersion();
  }, [readIngredients, writeIngredients, bumpPlanVersion, db]);

  return { updateIngredient, addIngredient, deleteIngredient };
}
