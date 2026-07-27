import { useEffect, useState } from 'react';
import { useDb, usePlanVersion } from '../providers/DatabaseProvider';
import type { RecipeRow } from '../types/db';
import type { Ingredient } from '../meal_plan.types';
import { parseAmountString } from '../lib/amount';
import { reDeriveActivePlan } from '../lib/plan/reDeriveActivePlan';

export interface Recipe {
  id: string;
  title: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  servings: number;
  calories_per_serve: number;
  protein_per_serve_g: number;
  cook_method: string;
  prep_minutes: number;
  cook_minutes: number;
  ingredients: Ingredient[];
  method_steps: string[];
  is_favourite: boolean;
  notes: string | null;
}

function coerceIngredient(raw: { item: string; amount: unknown }): Ingredient {
  if (typeof raw.amount === 'string') {
    return { item: raw.item, amount: parseAmountString(raw.amount) };
  }
  return raw as Ingredient;
}

function parseRecipe(row: RecipeRow): Recipe {
  const rawIngredients = JSON.parse(row.ingredients_json);
  return {
    ...row,
    ingredients: rawIngredients.map(coerceIngredient),
    method_steps: JSON.parse(row.method_steps_json),
    is_favourite: row.is_favourite === 1,
    notes: row.notes ?? null,
  };
}

export function useRecipes() {
  const db = useDb();
  const { planVersion, bumpPlanVersion } = usePlanVersion();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.getAllAsync<RecipeRow>('SELECT * FROM recipes ORDER BY meal_type, title')
      .then((rows) => { setRecipes(rows.map(parseRecipe)); setLoading(false); });
  }, [planVersion]);

  async function getById(id: string): Promise<Recipe | null> {
    const row = await db.getFirstAsync<RecipeRow>('SELECT * FROM recipes WHERE id = ?', [id]);
    return row ? parseRecipe(row) : null;
  }

  async function updateNotes(recipeId: string, notes: string | null): Promise<void> {
    await db.runAsync(
      'UPDATE recipes SET notes = ? WHERE id = ?',
      [notes, recipeId],
    );
    bumpPlanVersion();
  }

  // Changing serves at cook time re-divides a fixed pot: ingredient amounts stay
  // put, per-serve numbers move. `rollupMacros` derives per-serve from the tagged
  // ingredients, but an untagged recipe falls back to the stored per-serve columns —
  // so those get rescaled here too, or they'd sit stale and wrong.
  async function updateServings(recipeId: string, servings: number): Promise<void> {
    const next = Math.max(1, Math.round(servings));
    const row = await db.getFirstAsync<RecipeRow>(
      'SELECT servings, calories_per_serve, protein_per_serve_g FROM recipes WHERE id = ?',
      [recipeId],
    );
    if (!row || row.servings === next) return;

    const ratio = row.servings > 0 ? row.servings / next : 1;
    await db.runAsync(
      'UPDATE recipes SET servings = ?, calories_per_serve = ?, protein_per_serve_g = ? WHERE id = ?',
      [
        next,
        Math.round(row.calories_per_serve * ratio),
        Math.round(row.protein_per_serve_g * ratio),
        recipeId,
      ],
    );
    // Re-dividing a recipe changes what one serve means, so a self-built plan
    // wanting N serves now needs a different amount of it.
    await reDeriveActivePlan(db);
    bumpPlanVersion();
  }

  return { recipes, loading, getById, updateNotes, updateServings };
}
