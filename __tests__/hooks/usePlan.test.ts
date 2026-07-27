import { renderHook, act, waitFor } from '@testing-library/react-native';
import { usePlan } from '../../hooks/usePlan';

const mockDb = {
  getFirstAsync: jest.fn().mockResolvedValue(null),
  runAsync: jest.fn().mockResolvedValue(undefined),
};
const mockBump = jest.fn();
jest.mock('../../providers/DatabaseProvider', () => ({
  useDb: () => mockDb,
  usePlanVersion: () => ({ planVersion: 0, bumpPlanVersion: mockBump }),
}));

async function mounted() {
  const { result } = renderHook(() => usePlan());
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result;
}

function insertCall() {
  return mockDb.runAsync.mock.calls
    .find((c) => String(c[0]).includes('INSERT INTO weekly_plans'));
}

describe('usePlan.createSelfBuiltPlan', () => {
  beforeEach(() => {
    mockDb.getFirstAsync.mockReset().mockResolvedValue(null);
    mockDb.runAsync.mockReset().mockResolvedValue(undefined);
    mockBump.mockReset();
  });

  it('marks the plan self_built', async () => {
    const result = await mounted();
    await act(async () => { await result.current.createSelfBuiltPlan('2026-08-03'); });
    expect(String(insertCall()![0])).toContain("'self_built'");
  });

  it('writes valid JSON into every JSON column', async () => {
    // usePlan.refresh JSON.parses all four unconditionally; '' would throw.
    const result = await mounted();
    await act(async () => { await result.current.createSelfBuiltPlan('2026-08-03'); });
    const sql = String(insertCall()![0]);
    expect(sql).toContain("'[]', '[]'");          // days_json, batch_plan_json
    for (const p of insertCall()![1] as string[]) {
      if (typeof p === 'string' && (p.startsWith('{') || p.startsWith('['))) {
        expect(() => JSON.parse(p)).not.toThrow();
      }
    }
  });

  it('writes a meta object the Plan tab can read', async () => {
    const result = await mounted();
    await act(async () => { await result.current.createSelfBuiltPlan('2026-08-03'); });
    const meta = JSON.parse((insertCall()![1] as string[])[2]);
    expect(meta.week_starting).toBe('2026-08-03');
  });

  it('deactivates the previous plan first', async () => {
    const result = await mounted();
    await act(async () => { await result.current.createSelfBuiltPlan('2026-08-03'); });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'UPDATE weekly_plans SET is_active = 0 WHERE is_active = 1');
  });

  it('bumps the plan version so consumers re-read', async () => {
    const result = await mounted();
    await act(async () => { await result.current.createSelfBuiltPlan('2026-08-03'); });
    expect(mockBump).toHaveBeenCalled();
  });

  it('returns the new plan id', async () => {
    const result = await mounted();
    let id = '';
    await act(async () => { id = await result.current.createSelfBuiltPlan('2026-08-03'); });
    expect(id).toBeTruthy();
    expect((insertCall()![1] as string[])[0]).toBe(id);
  });
});
