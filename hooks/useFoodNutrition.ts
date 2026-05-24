import { useCallback } from 'react';
import { useDb } from '../providers/DatabaseProvider';
import { generateId } from '../lib/uuid';
import type { FoodNutritionRow } from '../types/db';

export interface FoodNutritionData {
  item_name: string;
  brand: string | null;
  product_name: string | null;
  basis: 'per_100g' | 'per_100mL' | 'per_unit';
  cal_per_basis: number | null;
  protein_per_basis: number | null;
  carbs_per_basis: number | null;
  fat_per_basis: number | null;
}

export function useFoodNutrition() {
  const db = useDb();

  const getById = useCallback(async (id: string): Promise<FoodNutritionRow | null> => {
    const row = await db.getFirstAsync<FoodNutritionRow>(
      'SELECT * FROM food_nutrition WHERE id = ?',
      [id]
    );
    return row ?? null;
  }, [db]);

  const getByName = useCallback(async (name: string): Promise<FoodNutritionRow | null> => {
    const row = await db.getFirstAsync<FoodNutritionRow>(
      `SELECT * FROM food_nutrition
       WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?))
       ORDER BY updated_at DESC LIMIT 1`,
      [name]
    );
    return row ?? null;
  }, [db]);

  const upsert = useCallback(async (
    data: FoodNutritionData & { id?: string }
  ): Promise<string> => {
    const id = data.id ?? generateId();
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO food_nutrition
         (id, item_name, brand, product_name, basis,
          cal_per_basis, protein_per_basis, carbs_per_basis, fat_per_basis, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         item_name = excluded.item_name,
         brand = excluded.brand,
         product_name = excluded.product_name,
         basis = excluded.basis,
         cal_per_basis = excluded.cal_per_basis,
         protein_per_basis = excluded.protein_per_basis,
         carbs_per_basis = excluded.carbs_per_basis,
         fat_per_basis = excluded.fat_per_basis,
         updated_at = excluded.updated_at`,
      [id, data.item_name, data.brand, data.product_name, data.basis,
       data.cal_per_basis, data.protein_per_basis, data.carbs_per_basis,
       data.fat_per_basis, now]
    );
    return id;
  }, [db]);

  const linkIngredient = useCallback(async (
    recipeId: string,
    ingredientIndex: number,
    foodNutritionId: string,
  ): Promise<void> => {
    await db.runAsync(
      `INSERT INTO ingredient_nutrition_link (recipe_id, ingredient_index, food_nutrition_id)
       VALUES (?, ?, ?)
       ON CONFLICT(recipe_id, ingredient_index) DO UPDATE SET
         food_nutrition_id = excluded.food_nutrition_id`,
      [recipeId, ingredientIndex, foodNutritionId]
    );
  }, [db]);

  const getLinksForRecipe = useCallback(async (
    recipeId: string,
  ): Promise<Record<number, FoodNutritionRow>> => {
    const rows = await db.getAllAsync<{ ingredient_index: number } & FoodNutritionRow>(
      `SELECT l.ingredient_index, fn.*
       FROM ingredient_nutrition_link l
       JOIN food_nutrition fn ON fn.id = l.food_nutrition_id
       WHERE l.recipe_id = ?`,
      [recipeId]
    );
    const result: Record<number, FoodNutritionRow> = {};
    for (const row of rows) {
      result[row.ingredient_index] = row;
    }
    return result;
  }, [db]);

  return { getById, getByName, upsert, linkIngredient, getLinksForRecipe };
}
