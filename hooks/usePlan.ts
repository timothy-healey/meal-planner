import { useEffect, useState } from 'react';
import { useDb } from '../providers/DatabaseProvider';
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

  useEffect(() => { refresh(); }, []);

  return { plan, loading, refresh };
}
