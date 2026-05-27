import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useRecipes } from '../../hooks/useRecipes';

const mockRecipeRow = {
  id: 'r1',
  title: 'Chicken Stir-fry',
  meal_type: 'dinner',
  servings: 3,
  calories_per_serve: 480,
  protein_per_serve_g: 38,
  cook_method: 'stir-fry',
  prep_minutes: 10,
  cook_minutes: 15,
  ingredients_json: JSON.stringify([{ item: 'Chicken', amount: { kind: 'measured', value: 500, unit: 'g' } }]),
  method_steps_json: JSON.stringify(['Brown the chicken.']),
  is_favourite: 0,
  source: 'imported',
  notes: null,
  created_at: '2026-05-24',
};

const mockBumpPlanVersion = jest.fn();
const mockDb = {
  getAllAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  runAsync: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../providers/DatabaseProvider', () => ({
  useDb: () => mockDb,
  usePlanVersion: () => ({ planVersion: 0, bumpPlanVersion: mockBumpPlanVersion }),
}));

describe('useRecipes', () => {
  beforeEach(() => {
    mockDb.getAllAsync.mockReset().mockResolvedValue([mockRecipeRow]);
    mockDb.runAsync.mockReset().mockResolvedValue(undefined);
    mockBumpPlanVersion.mockReset();
  });

  it('exposes parsed recipes including the notes field', async () => {
    const { result } = renderHook(() => useRecipes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.recipes[0].notes).toBeNull();
  });

  it('updateNotes issues UPDATE with the provided id and value', async () => {
    const { result } = renderHook(() => useRecipes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.updateNotes('r1', 'sauce too thin'); });

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'UPDATE recipes SET notes = ? WHERE id = ?',
      ['sauce too thin', 'r1'],
    );
  });

  it('updateNotes accepts null to clear the field', async () => {
    const { result } = renderHook(() => useRecipes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.updateNotes('r1', null); });

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'UPDATE recipes SET notes = ? WHERE id = ?',
      [null, 'r1'],
    );
  });

  it('updateNotes calls bumpPlanVersion after the write to invalidate the cache', async () => {
    const { result } = renderHook(() => useRecipes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.updateNotes('r1', 'note'); });

    expect(mockBumpPlanVersion).toHaveBeenCalledTimes(1);
  });
});
