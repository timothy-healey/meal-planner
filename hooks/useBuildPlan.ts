import { useCallback } from 'react';
import { Alert } from 'react-native';
import { usePlan } from './usePlan';
import { useShoppingItems } from './useShoppingItems';
import { describeOutgoingWork } from '../lib/plan/replaceWarning';

/** Sunday of the current week, as a local ISO date. */
function thisSunday(): string {
  const n = new Date();
  const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() - n.getDay());
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Start a self-built plan, interrupting only when the switch would strand work.
 *
 * Building deactivates the current plan and its shopping rows become
 * unreachable, so a checked-off or hand-added item is genuinely lost. Nothing
 * at stake means no dialog — the action is one tap from the Plan tab, and
 * nagging on an untouched plan would make it feel dangerous when it isn't.
 */
export function useBuildPlan(onDone?: () => void) {
  const { plan, createSelfBuiltPlan } = usePlan();
  const { items } = useShoppingItems(plan?.row.id ?? null);

  const buildPlan = useCallback(() => {
    const go = async () => {
      await createSelfBuiltPlan(thisSunday());
      onDone?.();
    };

    const warning = plan ? describeOutgoingWork(items) : null;
    if (!warning) { go(); return; }

    Alert.alert('Replace your current plan?', warning, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Replace', style: 'destructive', onPress: go },
    ]);
  }, [plan, items, createSelfBuiltPlan, onDone]);

  return { buildPlan };
}
