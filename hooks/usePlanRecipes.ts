import { useCallback, useEffect, useState } from 'react';
import { useDb, usePlanVersion } from '../providers/DatabaseProvider';
import { generateId } from '../lib/uuid';
import type { PlanRecipeRow } from '../types/db';
import { reDeriveActivePlan } from '../lib/plan/reDeriveActivePlan';

export function usePlanRecipes(planId: string | null) {
  const db = useDb();
  const { bumpPlanVersion } = usePlanVersion();
  const [rows, setRows] = useState<PlanRecipeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!planId) { setRows([]); setLoading(false); return; }
    setRows(await db.getAllAsync<PlanRecipeRow>(
      'SELECT * FROM plan_recipes WHERE plan_id = ? ORDER BY sort_order',
      [planId],
    ));
    setLoading(false);
  }, [planId, db]);

  useEffect(() => { load(); }, [load]);

  /** Delegates — there is one derivation implementation, not two. */
  const derivePlanList = useCallback(async () => {
    await reDeriveActivePlan(db);
    bumpPlanVersion();
  }, [db, bumpPlanVersion]);

  const addRecipe = useCallback(async (recipeId: string, targetServes: number) => {
    if (!planId) return;
    const sortOrder = rows.length > 0 ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 0;
    await db.runAsync(
      `INSERT OR REPLACE INTO plan_recipes (id, plan_id, recipe_id, target_serves, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [generateId(), planId, recipeId, Math.max(1, Math.round(targetServes)), sortOrder],
    );
    await load();
    await derivePlanList();
  }, [planId, rows, db, load, derivePlanList]);

  const setServes = useCallback(async (recipeId: string, targetServes: number) => {
    if (!planId) return;
    await db.runAsync(
      'UPDATE plan_recipes SET target_serves = ? WHERE plan_id = ? AND recipe_id = ?',
      [Math.max(1, Math.round(targetServes)), planId, recipeId],
    );
    await load();
    await derivePlanList();
  }, [planId, db, load, derivePlanList]);

  const removeRecipe = useCallback(async (recipeId: string) => {
    if (!planId) return;
    await db.runAsync(
      'DELETE FROM plan_recipes WHERE plan_id = ? AND recipe_id = ?',
      [planId, recipeId],
    );
    await load();
    await derivePlanList();
  }, [planId, db, load, derivePlanList]);

  return { rows, loading, addRecipe, setServes, removeRecipe, derivePlanList, reload: load };
}
