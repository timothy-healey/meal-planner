import { renderHook, waitFor } from '@testing-library/react-native';
import { useInPlanRecipes } from '../../hooks/useInPlanRecipes';
import type { ActivePlan } from '../../hooks/usePlan';

const mockDb = { getAllAsync: jest.fn().mockResolvedValue([]) };
jest.mock('../../providers/DatabaseProvider', () => ({
  useDb: () => mockDb,
  usePlanVersion: () => ({ planVersion: 0, bumpPlanVersion: jest.fn() }),
}));

function plan(source: 'imported' | 'self_built', days: unknown[] = []): ActivePlan {
  return {
    row: { id: 'p1', source } as never,
    meta: {} as never,
    strategy: {} as never,
    days: days as never,
    batchSteps: [],
  };
}

describe('useInPlanRecipes', () => {
  beforeEach(() => { mockDb.getAllAsync.mockReset().mockResolvedValue([]); });

  it('is empty with no active plan', () => {
    const { result } = renderHook(() => useInPlanRecipes(null));
    expect(result.current.size).toBe(0);
  });

  it('reads plan_recipes for a self-built plan — the explicit relation', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ recipe_id: 'r1' }, { recipe_id: 'r2' }]);
    const { result } = renderHook(() => useInPlanRecipes(plan('self_built')));
    await waitFor(() => expect(result.current.size).toBe(2));
    expect(result.current.has('r1')).toBe(true);
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('FROM plan_recipes'), ['p1']);
  });

  it('walks batch_ref for an imported plan, without touching the database', () => {
    const { result } = renderHook(() => useInPlanRecipes(plan('imported', [
      { meals: { dinner: { batch_ref: 'r9' } } },
    ])));
    expect(result.current.has('r9')).toBe(true);
    expect(mockDb.getAllAsync).not.toHaveBeenCalled();
  });

  it('covers imported plans only partially — non-batch meals have no ref', () => {
    // Inherent, not a bug: an imported plan never recorded which recipe a
    // non-batch meal meant.
    const { result } = renderHook(() => useInPlanRecipes(plan('imported', [
      { meals: { dinner: { batch_ref: 'r1' }, lunch: { name: 'Salad' } } },
    ])));
    expect(result.current.size).toBe(1);
  });
});

describe('useInPlanRecipes — render stability', () => {
  beforeEach(() => { mockDb.getAllAsync.mockReset().mockResolvedValue([]); });

  it('does not loop when the caller passes a fresh plan object each render', () => {
    // The first version keyed its effect on the plan object and set a new Set
    // every run, so this spun until the process died.
    let renders = 0;
    const { rerender } = renderHook(() => {
      renders++;
      return useInPlanRecipes(plan('imported', [{ meals: { dinner: { batch_ref: 'r1' } } }]));
    });
    rerender({});
    rerender({});
    expect(renders).toBeLessThan(10);
  });

  it('does not query for an imported plan, however many times it renders', () => {
    const { rerender } = renderHook(() =>
      useInPlanRecipes(plan('imported', [{ meals: { dinner: { batch_ref: 'r1' } } }])));
    rerender({});
    rerender({});
    expect(mockDb.getAllAsync).not.toHaveBeenCalled();
  });

  it('queries once for a stable self-built plan across re-renders', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ recipe_id: 'r1' }]);
    const stable = plan('self_built');
    const { result, rerender } = renderHook(() => useInPlanRecipes(stable));
    await waitFor(() => expect(result.current.size).toBe(1));
    rerender({});
    rerender({});
    expect(mockDb.getAllAsync).toHaveBeenCalledTimes(1);
  });
});
