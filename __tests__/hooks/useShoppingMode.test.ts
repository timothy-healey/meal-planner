import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useShoppingMode } from '../../hooks/useShoppingMode';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('useShoppingMode', () => {
  beforeEach(() => AsyncStorage.clear());

  it('defaults to quick mode with no store', async () => {
    const { result } = renderHook(() => useShoppingMode('plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.mode).toBe('quick');
    expect(result.current.activeStore).toBeNull();
  });

  it('setMode to quick clears the active store', async () => {
    const { result } = renderHook(() => useShoppingMode('plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.setMode('review', { chain: 'Coles', branch: 'Bondi' }); });
    await act(async () => { await result.current.setMode('quick'); });
    expect(result.current.mode).toBe('quick');
    expect(result.current.activeStore).toBeNull();
  });

  it('setMode to review sets mode and active store (chain + branch)', async () => {
    const { result } = renderHook(() => useShoppingMode('plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.setMode('review', { chain: 'Coles', branch: 'Bondi' }); });
    expect(result.current.mode).toBe('review');
    expect(result.current.activeStore).toEqual({ chain: 'Coles', branch: 'Bondi' });
  });

  it('persists mode across hook remounts', async () => {
    const { result, unmount } = renderHook(() => useShoppingMode('plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.setMode('review', { chain: 'Woolworths', branch: '' }); });
    unmount();
    const { result: result2 } = renderHook(() => useShoppingMode('plan-1'));
    await waitFor(() => expect(result2.current.loading).toBe(false));
    expect(result2.current.mode).toBe('review');
    expect(result2.current.activeStore).toEqual({ chain: 'Woolworths', branch: '' });
  });

  it('addStore saves a new store and updates savedStores', async () => {
    const { result } = renderHook(() => useShoppingMode('plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.addStore({ chain: 'Aldi', branch: 'Newtown' }); });
    expect(result.current.savedStores).toContainEqual(
      expect.objectContaining({ chain: 'Aldi', branch: 'Newtown' }),
    );
  });

  it('savedStores are sorted by lastUsed descending', async () => {
    const { result } = renderHook(() => useShoppingMode('plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.setMode('review', { chain: 'Old', branch: '' }); });
    await act(async () => { await result.current.setMode('review', { chain: 'New', branch: '' }); });
    expect(result.current.savedStores[0].chain).toBe('New');
  });

  it('migrates legacy single-name AsyncStorage entries on read', async () => {
    await AsyncStorage.setItem(
      'shopping_stores',
      JSON.stringify([{ name: 'Coles Bondi', lastUsed: '2026-05-01T00:00:00Z' }]),
    );
    const { result } = renderHook(() => useShoppingMode('plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.savedStores[0]).toEqual(
      expect.objectContaining({ chain: 'Coles Bondi', branch: '' }),
    );
  });
});
