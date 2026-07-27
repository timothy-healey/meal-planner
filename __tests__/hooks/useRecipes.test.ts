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

describe('useRecipes.updateServings', () => {
  beforeEach(() => {
    mockDb.getAllAsync.mockReset().mockResolvedValue([mockRecipeRow]);
    mockDb.runAsync.mockReset().mockResolvedValue(undefined);
    mockDb.getFirstAsync.mockReset().mockResolvedValue({
      servings: 3, calories_per_serve: 480, protein_per_serve_g: 38,
    });
    mockBumpPlanVersion.mockReset();
  });

  async function mounted() {
    const { result } = renderHook(() => useRecipes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    return result;
  }

  it('rescales the stored per-serve columns so the same pot is re-divided', async () => {
    const result = await mounted();
    await act(async () => { await result.current.updateServings('r1', 6); });

    // 3 serves × 480 kcal = 1440 total; over 6 serves that is 240.
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'UPDATE recipes SET servings = ?, calories_per_serve = ?, protein_per_serve_g = ? WHERE id = ?',
      [6, 240, 19, 'r1'],
    );
  });

  it('rounds the rescaled columns to integers', async () => {
    const result = await mounted();
    await act(async () => { await result.current.updateServings('r1', 4); });

    // 480 × 3/4 = 360; 38 × 3/4 = 28.5 → 29
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.any(String),
      [4, 360, 29, 'r1'],
    );
  });

  it('clamps to a minimum of one serve', async () => {
    const result = await mounted();
    await act(async () => { await result.current.updateServings('r1', 0); });

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.any(String),
      [1, 1440, 114, 'r1'],
    );
  });

  it('bumps the plan version so the screen re-reads the recipe', async () => {
    const result = await mounted();
    await act(async () => { await result.current.updateServings('r1', 6); });

    expect(mockBumpPlanVersion).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when the serves count is unchanged', async () => {
    const result = await mounted();
    await act(async () => { await result.current.updateServings('r1', 3); });

    expect(mockDb.runAsync).not.toHaveBeenCalled();
    expect(mockBumpPlanVersion).not.toHaveBeenCalled();
  });

  it('is a no-op when the recipe does not exist', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);
    const result = await mounted();
    await act(async () => { await result.current.updateServings('nope', 6); });

    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it('leaves the per-serve columns alone when the stored serves count is zero', async () => {
    mockDb.getFirstAsync.mockResolvedValue({
      servings: 0, calories_per_serve: 480, protein_per_serve_g: 38,
    });
    const result = await mounted();
    await act(async () => { await result.current.updateServings('r1', 4); });

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.any(String),
      [4, 480, 38, 'r1'],
    );
  });
});
