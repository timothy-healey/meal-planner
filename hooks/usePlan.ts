import { useEffect, useState } from 'react';
import { useDb, usePlanVersion } from '../providers/DatabaseProvider';
import { generateId } from '../lib/uuid';
import type { WeeklyPlanRow } from '../types/db';
import type { Meta, BatchStep, DayPlan, Strategy } from '../meal_plan.types';

export interface ActivePlan {
  row: WeeklyPlanRow;
  meta: Meta;
  strategy: Strategy;
  days: DayPlan[];
  batchSteps: BatchStep[];
}

export function usePlan() {
  const db = useDb();
  const { planVersion, bumpPlanVersion } = usePlanVersion();
  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const row = await db.getFirstAsync<WeeklyPlanRow>(
      'SELECT * FROM weekly_plans WHERE is_active = 1 LIMIT 1'
    );
    if (!row) { setPlan(null); setLoading(false); return; }
    setPlan({
      row,
      meta: JSON.parse(row.meta_json),
      strategy: JSON.parse(row.strategy_json),
      days: JSON.parse(row.days_json),
      batchSteps: JSON.parse(row.batch_plan_json),
    });
    setLoading(false);
  }

  useEffect(() => { refresh(); }, [planVersion]);

  /**
   * Start a plan built from the recipe library rather than imported.
   *
   * Every JSON column is NOT NULL and `refresh` parses all four
   * unconditionally, so this writes valid empty structures — an empty string
   * would throw on the next load.
   */
  async function createSelfBuiltPlan(weekStarting: string): Promise<string> {
    const id = generateId();
    const meta = {
      title: 'My plan', week_starting: weekStarting, currency: 'AUD',
      store: '', region: '', weekly_budget: 0,
      cooking_style: 'self-built', dinners_per_batch: 0, notes: '',
    };
    const strategy = {
      breakfast: '', lunch: '', dinner: '', snacks: '', weekend: '', drinks: '',
    };

    await db.runAsync('UPDATE weekly_plans SET is_active = 0 WHERE is_active = 1');
    await db.runAsync(
      `INSERT INTO weekly_plans
         (id, week_starting, is_active, meta_json, strategy_json,
          days_json, batch_plan_json, created_at, source)
       VALUES (?, ?, 1, ?, ?, '[]', '[]', ?, 'self_built')`,
      [id, weekStarting, JSON.stringify(meta), JSON.stringify(strategy),
       new Date().toISOString()],
    );
    bumpPlanVersion();
    return id;
  }

  return { plan, loading, refresh, createSelfBuiltPlan };
}
