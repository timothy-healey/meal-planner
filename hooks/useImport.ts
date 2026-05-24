import { useCallback, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { useDb } from '../providers/DatabaseProvider';
import { validatePlan, ValidationError } from '../lib/import/validate';
import { transformPlan } from '../lib/import/transform';
import type { MealPlan } from '../meal_plan.types';

export type ImportStatus =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string };

export function useImport(onSuccess?: () => void) {
  const db = useDb();
  const [status, setStatus] = useState<ImportStatus>({ type: 'idle' });

  const importPlan = useCallback(async () => {
    setStatus({ type: 'loading' });

    // 1. Pick file
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
    if (result.canceled) { setStatus({ type: 'idle' }); return; }

    // 2. Read + parse
    // Copy to local cache first — content:// URIs from the picker can't be read directly on Android
    let data: unknown;
    try {
      const src = new File(result.assets[0].uri);
      const dest = new File(Paths.cache, 'meal_plan_import.json');
      await src.copy(dest, { overwrite: true });
      const raw = await dest.text();
      dest.delete();
      data = JSON.parse(raw);
    } catch {
      setStatus({ type: 'error', message: 'Could not read file — is it valid JSON?' });
      return;
    }

    // 3. Validate
    try {
      validatePlan(data);
    } catch (e) {
      if (e instanceof ValidationError) {
        setStatus({ type: 'error', message: e.message });
      } else {
        setStatus({ type: 'error', message: 'Unexpected validation error' });
      }
      return;
    }

    // 4. Transform + upsert
    const plan = data as MealPlan;
    const { weeklyPlan, recipes, shoppingItems } = transformPlan(plan);

    try {
      await db.runAsync('BEGIN');

      // Deactivate all plans
      await db.runAsync('UPDATE weekly_plans SET is_active = 0');

      // Upsert recipes (preserve is_favourite on conflict)
      for (const r of recipes) {
        await db.runAsync(
          `INSERT INTO recipes (id,title,meal_type,servings,calories_per_serve,protein_per_serve_g,
            cook_method,prep_minutes,cook_minutes,ingredients_json,method_steps_json,source,created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET
             title=excluded.title, meal_type=excluded.meal_type, servings=excluded.servings,
             calories_per_serve=excluded.calories_per_serve,
             protein_per_serve_g=excluded.protein_per_serve_g,
             cook_method=excluded.cook_method, prep_minutes=excluded.prep_minutes,
             cook_minutes=excluded.cook_minutes, ingredients_json=excluded.ingredients_json,
             method_steps_json=excluded.method_steps_json`,
          [r.id, r.title, r.meal_type, r.servings, r.calories_per_serve, r.protein_per_serve_g,
           r.cook_method, r.prep_minutes, r.cook_minutes, r.ingredients_json, r.method_steps_json,
           r.source, r.created_at]
        );
      }

      // Insert weekly plan
      await db.runAsync(
        `INSERT OR REPLACE INTO weekly_plans
           (id,week_starting,is_active,meta_json,strategy_json,days_json,batch_plan_json,created_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        [weeklyPlan.id, weeklyPlan.week_starting, 1, weeklyPlan.meta_json,
         weeklyPlan.strategy_json, weeklyPlan.days_json, weeklyPlan.batch_plan_json,
         weeklyPlan.created_at]
      );

      // Delete + re-insert shopping items
      await db.runAsync('DELETE FROM shopping_items WHERE plan_id = ?', [weeklyPlan.id]);
      for (const item of shoppingItems) {
        await db.runAsync(
          `INSERT INTO shopping_items
             (id,plan_id,category,category_order,item_order,name,qty,estimated_price,
              is_oneoff,note,is_checked)
           VALUES (?,?,?,?,?,?,?,?,?,?,0)`,
          [item.id, item.plan_id, item.category, item.category_order, item.item_order,
           item.name, item.qty, item.estimated_price, item.is_oneoff, item.note]
        );
      }

      await db.runAsync('COMMIT');
    } catch (e) {
      await db.runAsync('ROLLBACK');
      setStatus({ type: 'error', message: 'Database error — please try again' });
      return;
    }

    const itemCount = shoppingItems.length;
    const recipeCount = recipes.length;
    setStatus({ type: 'success', message: `Plan loaded — ${itemCount} items, ${recipeCount} recipes` });
    onSuccess?.();
  }, [db, onSuccess]);

  return { importPlan, status };
}
