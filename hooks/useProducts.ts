import { useCallback } from 'react';
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

  return { upsert, getById, getByKey, getNutritionForIngredients };
}
