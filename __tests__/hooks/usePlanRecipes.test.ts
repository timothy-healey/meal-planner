import { renderHook, act, waitFor } from '@testing-library/react-native';
import { usePlanRecipes } from '../../hooks/usePlanRecipes';
import { reDeriveActivePlan } from '../../lib/plan/reDeriveActivePlan';

jest.mock('../../lib/plan/reDeriveActivePlan', () => ({
  reDeriveActivePlan: jest.fn().mockResolvedValue(undefined),
}));

const mockDb = {
  getAllAsync: jest.fn().mockResolvedValue([]),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  runAsync: jest.fn().mockResolvedValue(undefined),
};
const mockBump = jest.fn();
jest.mock('../../providers/DatabaseProvider', () => ({
  useDb: () => mockDb,
  usePlanVersion: () => ({ planVersion: 0, bumpPlanVersion: mockBump }),
}));

async function mounted(planId: string | null = 'p1') {
  const { result } = renderHook(() => usePlanRecipes(planId));
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result;
}

describe('usePlanRecipes', () => {
  beforeEach(() => {
    mockDb.getAllAsync.mockReset().mockResolvedValue([]);
    mockDb.runAsync.mockReset().mockResolvedValue(undefined);
    mockBump.mockReset();
    (reDeriveActivePlan as jest.Mock).mockClear();
  });

  it('adds a recipe with the given target serves', async () => {
    const result = await mounted();
    await act(async () => { await result.current.addRecipe('r1', 4); });
    const insert = mockDb.runAsync.mock.calls
      .find((c) => String(c[0]).includes('INSERT OR REPLACE INTO plan_recipes'));
    expect(insert?.[1]).toEqual(expect.arrayContaining(['p1', 'r1', 4]));
  });

  it('clamps target serves to at least one', async () => {
    const result = await mounted();
    await act(async () => { await result.current.setServes('r1', 0); });
    const update = mockDb.runAsync.mock.calls
      .find((c) => String(c[0]).includes('UPDATE plan_recipes'));
    expect(update?.[1][0]).toBe(1);
  });

  it('rounds a fractional target', async () => {
    const result = await mounted();
    await act(async () => { await result.current.setServes('r1', 4.6); });
    const update = mockDb.runAsync.mock.calls
      .find((c) => String(c[0]).includes('UPDATE plan_recipes'));
    expect(update?.[1][0]).toBe(5);
  });

  it('removes a recipe from the plan', async () => {
    const result = await mounted();
    await act(async () => { await result.current.removeRecipe('r1'); });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'DELETE FROM plan_recipes WHERE plan_id = ? AND recipe_id = ?', ['p1', 'r1']);
  });

  it('re-derives after every mutation', async () => {
    const result = await mounted();
    await act(async () => { await result.current.addRecipe('r1', 4); });
    await act(async () => { await result.current.setServes('r1', 6); });
    await act(async () => { await result.current.removeRecipe('r1'); });
    expect(reDeriveActivePlan).toHaveBeenCalledTimes(3);
  });

  it('bumps the plan version so consumers re-read', async () => {
    const result = await mounted();
    await act(async () => { await result.current.derivePlanList(); });
    expect(mockBump).toHaveBeenCalled();
  });

  it('appends new recipes after existing ones', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      { id: 'pr1', plan_id: 'p1', recipe_id: 'r1', target_serves: 4, sort_order: 0 },
      { id: 'pr2', plan_id: 'p1', recipe_id: 'r2', target_serves: 4, sort_order: 1 },
    ]);
    const result = await mounted();
    await act(async () => { await result.current.addRecipe('r3', 2); });
    const insert = mockDb.runAsync.mock.calls
      .find((c) => String(c[0]).includes('INSERT OR REPLACE INTO plan_recipes'));
    expect(insert?.[1][4]).toBe(2);
  });

  it('is inert without a plan', async () => {
    const result = await mounted(null);
    await act(async () => { await result.current.addRecipe('r1', 4); });
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });
});
