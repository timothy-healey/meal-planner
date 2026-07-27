import { renderHook, act, waitFor } from '@testing-library/react-native';
import { reDeriveActivePlan } from '../../lib/plan/reDeriveActivePlan';
import { useRecipes } from '../../hooks/useRecipes';
import { useProducts } from '../../hooks/useProducts';
import { useRecipeIngredients } from '../../hooks/useRecipeIngredients';

jest.mock('../../lib/plan/reDeriveActivePlan', () => ({
  reDeriveActivePlan: jest.fn().mockResolvedValue(undefined),
}));

const RECIPE = {
  id: 'r1', title: 'Beef Ragu', meal_type: 'dinner', servings: 4,
  calories_per_serve: 480, protein_per_serve_g: 38, cook_method: 'stew',
  prep_minutes: 10, cook_minutes: 15,
  ingredients_json: JSON.stringify([{ item: 'Beef', amount: { kind: 'measured', value: 500, unit: 'g' } }]),
  method_steps_json: '[]', is_favourite: 0, source: 'imported',
  notes: null, created_at: '2026-07-01',
};

const mockDb = {
  getAllAsync: jest.fn().mockResolvedValue([RECIPE]),
  getFirstAsync: jest.fn().mockResolvedValue(RECIPE),
  runAsync: jest.fn().mockResolvedValue(undefined),
};
jest.mock('../../providers/DatabaseProvider', () => ({
  useDb: () => mockDb,
  usePlanVersion: () => ({ planVersion: 0, bumpPlanVersion: jest.fn() }),
}));

const mockReDerive = reDeriveActivePlan as jest.Mock;

/**
 * A missed trigger is this design's stated risk: the derived list would sit
 * silently out of step with the recipes. One test per site.
 */
describe('derivation trigger sites', () => {
  beforeEach(() => {
    mockReDerive.mockClear();
    mockDb.getAllAsync.mockReset().mockResolvedValue([RECIPE]);
    mockDb.getFirstAsync.mockReset().mockResolvedValue(RECIPE);
    mockDb.runAsync.mockReset().mockResolvedValue(undefined);
  });

  describe('Recipes', () => {
    it('updateServings re-derives — it changes the scale factor denominator', async () => {
      mockDb.getFirstAsync.mockResolvedValue(
        { servings: 4, calories_per_serve: 480, protein_per_serve_g: 38 });
      const { result } = renderHook(() => useRecipes());
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => { await result.current.updateServings('r1', 6); });
      expect(mockReDerive).toHaveBeenCalled();
    });

    it('addIngredient re-derives', async () => {
      const { result } = renderHook(() => useRecipeIngredients());
      await act(async () => {
        await result.current.addIngredient('r1',
          { item: 'Onion', amount: { kind: 'measured', value: 100, unit: 'g' } });
      });
      expect(mockReDerive).toHaveBeenCalled();
    });

    it('updateIngredient re-derives', async () => {
      const { result } = renderHook(() => useRecipeIngredients());
      await act(async () => {
        await result.current.updateIngredient('r1', 0,
          { item: 'Beef', amount: { kind: 'measured', value: 600, unit: 'g' } });
      });
      expect(mockReDerive).toHaveBeenCalled();
    });

    it('deleteIngredient re-derives', async () => {
      const { result } = renderHook(() => useRecipeIngredients());
      await act(async () => { await result.current.deleteIngredient('r1', 0); });
      expect(mockReDerive).toHaveBeenCalled();
    });
  });

  describe('Catalog — ItemKey is Catalog-owned, so its mutations invalidate it', () => {
    it('mergeProduct re-derives — product:A becomes product:B', async () => {
      mockDb.getFirstAsync.mockResolvedValue({
        id: 'a', brand: '', product_name: 'x', item_name: 'x', basis: 'per_100g',
        cal_per_basis: null, protein_per_basis: null, carbs_per_basis: null,
        fat_per_basis: null, updated_at: '2026-07-01',
      });
      mockDb.getAllAsync.mockResolvedValue([]);
      const { result } = renderHook(() => useProducts());
      await act(async () => { await result.current.mergeProduct('a', 'b'); });
      expect(mockReDerive).toHaveBeenCalled();
    });

    it('deleteProduct re-derives — product:A degrades to name:<...>', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);
      const { result } = renderHook(() => useProducts());
      await act(async () => { await result.current.deleteProduct('a'); });
      expect(mockReDerive).toHaveBeenCalled();
    });

    it('renaming through upsert re-derives — item_name is the display name', async () => {
      mockDb.getFirstAsync.mockResolvedValue({
        id: 'a', brand: 'Coles', product_name: 'Mince', item_name: 'old',
        basis: 'per_100g', cal_per_basis: null, protein_per_basis: null,
        carbs_per_basis: null, fat_per_basis: null, updated_at: '2026-07-01',
      });
      const { result } = renderHook(() => useProducts());
      await act(async () => {
        await result.current.upsert({
          brand: 'Coles', product_name: 'Mince', item_name: 'beef mince',
          basis: 'per_100g', cal_per_basis: null, protein_per_basis: null,
          carbs_per_basis: null, fat_per_basis: null,
        });
      });
      expect(mockReDerive).toHaveBeenCalled();
    });

    it('creating a brand-new product does not re-derive', async () => {
      // No ingredient references it yet, so no key can have changed.
      mockDb.getFirstAsync.mockResolvedValue(null);
      const { result } = renderHook(() => useProducts());
      await act(async () => {
        await result.current.upsert({
          brand: 'New', product_name: 'Thing', item_name: 'thing',
          basis: 'per_100g', cal_per_basis: null, protein_per_basis: null,
          carbs_per_basis: null, fat_per_basis: null,
        });
      });
      expect(mockReDerive).not.toHaveBeenCalled();
    });
  });
});
