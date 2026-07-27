import { useCallback } from 'react';
import { reDeriveActivePlan } from '../lib/plan/reDeriveActivePlan';
import { useDb } from '../providers/DatabaseProvider';
import { generateId } from '../lib/uuid';
import type { ProductRow } from '../types/db';
import type { Ingredient } from '../meal_plan.types';

export interface ProductInput {
  brand: string;
  product_name: string;
  item_name: string;
  basis: 'per_100g' | 'per_100mL' | 'per_unit';
  cal_per_basis: number | null;
  protein_per_basis: number | null;
  carbs_per_basis: number | null;
  fat_per_basis: number | null;
}

export function useProducts() {
  const db = useDb();

  const upsert = useCallback(async (input: ProductInput): Promise<string> => {
    const now = new Date().toISOString();
    const existing = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM products WHERE brand = ? AND product_name = ?',
      [input.brand, input.product_name],
    );
    if (existing) {
      await db.runAsync(
        `UPDATE products
         SET item_name = ?, basis = ?, cal_per_basis = ?, protein_per_basis = ?,
             carbs_per_basis = ?, fat_per_basis = ?, updated_at = ?
         WHERE id = ?`,
        [input.item_name, input.basis,
         input.cal_per_basis, input.protein_per_basis,
         input.carbs_per_basis, input.fat_per_basis, now, existing.id],
      );
      // item_name is the display name for product-keyed lines, so a rename
      // here restates them. The insert branch below cannot: a brand-new
      // product is referenced by no ingredient yet.
      await reDeriveActivePlan(db);
      return existing.id;
    }
    const id = generateId();
    await db.runAsync(
      `INSERT INTO products
         (id, brand, product_name, item_name, basis,
          cal_per_basis, protein_per_basis, carbs_per_basis, fat_per_basis, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.brand, input.product_name, input.item_name, input.basis,
       input.cal_per_basis, input.protein_per_basis,
       input.carbs_per_basis, input.fat_per_basis, now],
    );
    return id;
  }, [db]);

  const getById = useCallback(async (id: string): Promise<ProductRow | null> => {
    const row = await db.getFirstAsync<ProductRow>(
      'SELECT * FROM products WHERE id = ?',
      [id],
    );
    return row ?? null;
  }, [db]);

  const getByKey = useCallback(async (brand: string, product_name: string): Promise<ProductRow | null> => {
    const row = await db.getFirstAsync<ProductRow>(
      'SELECT * FROM products WHERE brand = ? AND product_name = ?',
      [brand, product_name],
    );
    return row ?? null;
  }, [db]);

  const getNutritionForIngredients = useCallback(
    async (ingredients: Ingredient[]): Promise<Record<number, ProductRow>> => {
      const idsByIndex: Array<[number, string]> = [];
      ingredients.forEach((ing, i) => {
        if (typeof ing.product_id === 'string') idsByIndex.push([i, ing.product_id]);
      });
      if (idsByIndex.length === 0) return {};

      const placeholders = idsByIndex.map(() => '?').join(',');
      const rows = await db.getAllAsync<ProductRow>(
        `SELECT * FROM products WHERE id IN (${placeholders})`,
        idsByIndex.map(([_, id]) => id),
      );
      const byId = new Map(rows.map(r => [r.id, r]));
      const result: Record<number, ProductRow> = {};
      for (const [index, id] of idsByIndex) {
        const row = byId.get(id);
        if (row) result[index] = row;
      }
      return result;
    },
    [db],
  );

  const getAll = useCallback(async (): Promise<ProductRow[]> => {
    return await db.getAllAsync<ProductRow>(
      'SELECT * FROM products ORDER BY item_name, product_name',
    );
  }, [db]);

  const deleteProduct = useCallback(async (productId: string): Promise<void> => {
    await db.runAsync('BEGIN');
    try {
      const affectedRecipes = await db.getAllAsync<{ id: string; ingredients_json: string }>(
        `SELECT DISTINCT r.id, r.ingredients_json
         FROM recipes r, json_each(r.ingredients_json) ing
         WHERE json_extract(ing.value, '$.product_id') = ?`,
        [productId],
      );
      for (const r of affectedRecipes) {
        const ingredients = JSON.parse(r.ingredients_json);
        const next = ingredients.map((ing: any) => {
          if (ing.product_id === productId) {
            const { product_id, ...rest } = ing;
            return rest;
          }
          return ing;
        });
        await db.runAsync(
          'UPDATE recipes SET ingredients_json = ? WHERE id = ?',
          [JSON.stringify(next), r.id],
        );
      }
      await db.runAsync(
        'UPDATE purchase_history SET product_id = NULL WHERE product_id = ?',
        [productId],
      );
      await db.runAsync('DELETE FROM products WHERE id = ?', [productId]);
      await db.runAsync('COMMIT');
      // product_id was stripped from ingredients, so those keys degrade from
      // product:<id> back to name:<...>.
      await reDeriveActivePlan(db);
    } catch (e) {
      await db.runAsync('ROLLBACK');
      throw e;
    }
  }, [db]);

  const mergeProduct = useCallback(async (
    sourceId: string,
    targetId: string,
  ): Promise<void> => {
    if (sourceId === targetId) return;

    const source = await db.getFirstAsync<ProductRow>(
      'SELECT * FROM products WHERE id = ?',
      [sourceId],
    );
    const target = await db.getFirstAsync<ProductRow>(
      'SELECT * FROM products WHERE id = ?',
      [targetId],
    );
    if (!source || !target) {
      throw new Error('Source or target product not found');
    }

    await db.runAsync('BEGIN');
    try {
      const sourceHasMacros =
        source.cal_per_basis != null || source.protein_per_basis != null ||
        source.carbs_per_basis != null || source.fat_per_basis != null;
      const targetHasMacros =
        target.cal_per_basis != null || target.protein_per_basis != null ||
        target.carbs_per_basis != null || target.fat_per_basis != null;

      const useSourceMacros =
        sourceHasMacros &&
        (!targetHasMacros || source.updated_at >= target.updated_at);

      if (useSourceMacros) {
        await db.runAsync(
          'UPDATE products SET basis = ?, cal_per_basis = ?, protein_per_basis = ?, carbs_per_basis = ?, fat_per_basis = ?, updated_at = ? WHERE id = ?',
          [source.basis,
           source.cal_per_basis, source.protein_per_basis,
           source.carbs_per_basis, source.fat_per_basis,
           new Date().toISOString(), targetId],
        );
      }

      await db.runAsync(
        'UPDATE purchase_history SET product_id = ? WHERE product_id = ?',
        [targetId, sourceId],
      );

      const affectedRecipes = await db.getAllAsync<{ id: string; ingredients_json: string }>(
        `SELECT DISTINCT r.id, r.ingredients_json
         FROM recipes r, json_each(r.ingredients_json) ing
         WHERE json_extract(ing.value, '$.product_id') = ?`,
        [sourceId],
      );
      for (const r of affectedRecipes) {
        const ingredients = JSON.parse(r.ingredients_json);
        const next = ingredients.map((ing: any) => {
          if (ing.product_id === sourceId) {
            return { ...ing, product_id: targetId };
          }
          return ing;
        });
        await db.runAsync(
          'UPDATE recipes SET ingredients_json = ? WHERE id = ?',
          [JSON.stringify(next), r.id],
        );
      }

      await db.runAsync('DELETE FROM products WHERE id = ?', [sourceId]);
      await db.runAsync('COMMIT');
      // Ingredients moved from product:source to product:target, so every line
      // keyed on the source is now stale.
      await reDeriveActivePlan(db);
    } catch (e) {
      await db.runAsync('ROLLBACK');
      throw e;
    }
  }, [db]);

  return { upsert, getById, getByKey, getNutritionForIngredients, getAll, deleteProduct, mergeProduct };
}
