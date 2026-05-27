import { renderHook, act } from '@testing-library/react-native';
import { useRecipeIngredients } from '../../hooks/useRecipeIngredients';

const mockDb = {
  getFirstAsync: jest.fn(),
  runAsync: jest.fn(),
};

const mockBumpPlanVersion = jest.fn();

jest.mock('../../providers/DatabaseProvider', () => ({
  useDb: () => mockDb,
  usePlanVersion: () => ({ planVersion: 0, bumpPlanVersion: mockBumpPlanVersion }),
}));

beforeEach(() => {
  mockDb.getFirstAsync.mockReset();
  mockDb.runAsync.mockReset();
  mockBumpPlanVersion.mockReset();
});

describe('useRecipeIngredients.deleteIngredient', () => {
  it('removes the ingredient at the given index and writes the array back', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      ingredients_json: JSON.stringify([
        { item: 'a', amount: { kind: 'measured', value: 1, unit: 'g' }, product_id: 'p-a' },
        { item: 'b', amount: { kind: 'measured', value: 2, unit: 'g' }, product_id: 'p-b' },
        { item: 'c', amount: { kind: 'measured', value: 3, unit: 'g' }, product_id: 'p-c' },
      ]),
    });
    const { result } = renderHook(() => useRecipeIngredients());
    await act(async () => {
      await result.current.deleteIngredient('r1', 1);
    });
    const writeCall = mockDb.runAsync.mock.calls.find(
      c => typeof c[0] === 'string' && c[0].startsWith('UPDATE recipes'),
    );
    expect(writeCall).toBeDefined();
    const writtenIngredients = JSON.parse(writeCall![1][0]);
    expect(writtenIngredients.map((i: any) => i.item)).toEqual(['a', 'c']);
    expect(writtenIngredients.map((i: any) => i.product_id)).toEqual(['p-a', 'p-c']);
    expect(mockBumpPlanVersion).toHaveBeenCalled();
  });

  it('is a no-op when index is out of range', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      ingredients_json: JSON.stringify([{ item: 'a', amount: { kind: 'measured', value: 1, unit: 'g' } }]),
    });
    const { result } = renderHook(() => useRecipeIngredients());
    await act(async () => {
      await result.current.deleteIngredient('r1', 5);
    });
    expect(mockDb.runAsync).not.toHaveBeenCalledWith(
      expect.stringMatching(/UPDATE recipes/),
      expect.anything(),
    );
    expect(mockBumpPlanVersion).not.toHaveBeenCalled();
  });
});

describe('useRecipeIngredients.updateIngredient', () => {
  it('replaces the entry at the index and preserves others', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      ingredients_json: JSON.stringify([
        { item: 'a', amount: { kind: 'measured', value: 1, unit: 'g' } },
        { item: 'b', amount: { kind: 'measured', value: 2, unit: 'g' } },
      ]),
    });
    const { result } = renderHook(() => useRecipeIngredients());
    await act(async () => {
      await result.current.updateIngredient('r1', 0, {
        item: 'A!', amount: { kind: 'measured', value: 5, unit: 'g' }, product_id: 'p1',
      });
    });
    const written = JSON.parse(
      mockDb.runAsync.mock.calls.find(c => (c[0] as string).startsWith('UPDATE recipes'))![1][0],
    );
    expect(written[0].item).toBe('A!');
    expect(written[0].product_id).toBe('p1');
    expect(written[1].item).toBe('b');
  });
});

describe('useRecipeIngredients.addIngredient', () => {
  it('appends and returns the new index', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      ingredients_json: JSON.stringify([
        { item: 'a', amount: { kind: 'measured', value: 1, unit: 'g' } },
      ]),
    });
    const { result } = renderHook(() => useRecipeIngredients());
    let newIndex = -1;
    await act(async () => {
      newIndex = await result.current.addIngredient('r1', {
        item: 'b', amount: { kind: 'measured', value: 2, unit: 'g' },
      });
    });
    expect(newIndex).toBe(1);
  });
});
