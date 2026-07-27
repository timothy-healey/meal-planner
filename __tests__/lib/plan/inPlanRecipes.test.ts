import { collectBatchRefs } from '../../../lib/plan/inPlanRecipes';
import type { DayPlan } from '../../../meal_plan.types';

const day = (meals: Record<string, unknown>) => ({ meals } as unknown as DayPlan);

describe('collectBatchRefs', () => {
  it('collects a batch_ref from any meal slot', () => {
    const ids = collectBatchRefs([
      day({ dinner: { name: 'Ragu', batch_ref: 'r1' } }),
      day({ lunch: { name: 'Wrap', batch_ref: 'r2' } }),
      day({ breakfast: { name: 'Oats', batch_ref: 'r3' } }),
    ]);
    expect([...ids].sort()).toEqual(['r1', 'r2', 'r3']);
  });

  it('deduplicates a recipe cooked on several days', () => {
    const ids = collectBatchRefs([
      day({ dinner: { batch_ref: 'r1' } }),
      day({ dinner: { batch_ref: 'r1' } }),
    ]);
    expect([...ids]).toEqual(['r1']);
  });

  it('skips meals with no batch_ref — those name a recipe by title only', () => {
    const ids = collectBatchRefs([
      day({ dinner: { name: 'Takeaway' }, lunch: { name: 'Salad', batch_ref: 'r2' } }),
    ]);
    expect([...ids]).toEqual(['r2']);
  });

  it('ignores a non-string batch_ref', () => {
    expect(collectBatchRefs([day({ dinner: { batch_ref: 42 } })]).size).toBe(0);
  });

  it('ignores an empty batch_ref', () => {
    expect(collectBatchRefs([day({ dinner: { batch_ref: '' } })]).size).toBe(0);
  });

  it('survives a day with no meals object', () => {
    expect(collectBatchRefs([{} as DayPlan]).size).toBe(0);
  });

  it('survives an empty or absent day list', () => {
    expect(collectBatchRefs([]).size).toBe(0);
    expect(collectBatchRefs(undefined as never).size).toBe(0);
  });
});
