import { useEffect, useMemo, useState } from 'react';
import { useDb, usePlanVersion } from '../providers/DatabaseProvider';
import type { PlanRecipeRow } from '../types/db';
import type { ActivePlan } from './usePlan';
import { collectBatchRefs } from '../lib/plan/inPlanRecipes';

/**
 * The set of recipe ids the active plan is cooking.
 *
 * Self-built plans answer this exactly — `plan_recipes` is the explicit
 * relation. Imported plans fall back to walking `days_json` for `batch_ref`,
 * which covers batch-cooked meals only, so their coverage is partial. That
 * asymmetry is inherent: an imported plan never recorded which recipe a
 * non-batch meal meant.
 *
 * The effect keys on primitives, never on the `plan` object's identity. An
 * earlier version depended on `plan` and set a fresh Set on every run, so a
 * caller passing a new object each render span the render loop until the
 * process died.
 */
export function useInPlanRecipes(plan: ActivePlan | null): Set<string> {
  const db = useDb();
  const { planVersion } = usePlanVersion();

  const planId = plan?.row.id ?? null;
  const isSelfBuilt = plan?.row.source === 'self_built';

  // Imported plans need no query — the refs are already in memory.
  const fromDays = useMemo(
    () => (plan && !isSelfBuilt ? collectBatchRefs(plan.days) : new Set<string>()),
    [plan, isSelfBuilt],
  );

  const [fromTable, setFromTable] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!planId || !isSelfBuilt) return;
    let cancelled = false;
    db.getAllAsync<PlanRecipeRow>(
      'SELECT recipe_id FROM plan_recipes WHERE plan_id = ?',
      [planId],
    ).then((rows) => {
      if (!cancelled) setFromTable(new Set(rows.map((r) => r.recipe_id)));
    });
    return () => { cancelled = true; };
  }, [planId, isSelfBuilt, db, planVersion]);

  return isSelfBuilt ? fromTable : fromDays;
}
