import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useCategoryOrder } from '../../hooks/useCategoryOrder';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('useCategoryOrder', () => {
  beforeEach(() => AsyncStorage.clear());

  it('returns empty prefs when nothing is stored', async () => {
    const { result } = renderHook(() => useCategoryOrder());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.prefs).toEqual({});
  });

  it('saves and returns category order prefs', async () => {
    const { result } = renderHook(() => useCategoryOrder());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.saveOrder({ 'Produce': 0, 'Dairy': 1, 'Meat': 2 });
    });

    expect(result.current.prefs).toEqual({ 'Produce': 0, 'Dairy': 1, 'Meat': 2 });
  });

  it('applies saved order to a list of category names', async () => {
    const { result } = renderHook(() => useCategoryOrder());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.saveOrder({ 'Frozen': 0, 'Dairy': 1, 'Produce': 2 });
    });

    const categories = ['Produce', 'Dairy', 'Frozen'];
    const sorted = result.current.applySavedOrder(categories);
    expect(sorted).toEqual(['Frozen', 'Dairy', 'Produce']);
  });

  it('puts unrecognised categories at the end in original order', async () => {
    const { result } = renderHook(() => useCategoryOrder());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.saveOrder({ 'Dairy': 0 });
    });

    const sorted = result.current.applySavedOrder(['Produce', 'Dairy', 'Frozen']);
    expect(sorted[0]).toBe('Dairy');
    expect(sorted.slice(1)).toEqual(expect.arrayContaining(['Produce', 'Frozen']));
  });
});
