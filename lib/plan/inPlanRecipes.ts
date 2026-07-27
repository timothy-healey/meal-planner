import type { DayPlan } from '../../meal_plan.types';

/**
 * Recipe ids an imported plan references, via `batch_ref` inside `days_json`.
 *
 * Partial by nature: `batch_ref` only exists on batch-cooked meals. Non-batch
 * meals name a recipe by title string alone, which won't reliably match, so
 * they're skipped rather than guessed at. Self-built plans don't need this —
 * `plan_recipes` holds their ids explicitly.
 */
export function collectBatchRefs(days: DayPlan[]): Set<string> {
  const ids = new Set<string>();
  for (const day of days ?? []) {
    const meals = (day?.meals ?? {}) as Record<string, { batch_ref?: unknown } | undefined>;
    for (const meal of Object.values(meals)) {
      const ref = meal?.batch_ref;
      if (typeof ref === 'string' && ref) ids.add(ref);
    }
  }
  return ids;
}
