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
    await act(async () => { await result.current.setMode('review', 'Coles Bondi'); });
    await act(async () => { await result.current.setMode('quick'); });
    expect(result.current.mode).toBe('quick');
    expect(result.current.activeStore).toBeNull();
  });

  it('setMode to review sets mode and active store', async () => {
    const { result } = renderHook(() => useShoppingMode('plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.setMode('review', 'Coles Bondi'); });
    expect(result.current.mode).toBe('review');
    expect(result.current.activeStore).toBe('Coles Bondi');
  });

  it('persists mode across hook remounts', async () => {
    const { result, unmount } = renderHook(() => useShoppingMode('plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.setMode('review', 'Woolworths'); });
    unmount();
    const { result: result2 } = renderHook(() => useShoppingMode('plan-1'));
    await waitFor(() => expect(result2.current.loading).toBe(false));
    expect(result2.current.mode).toBe('review');
    expect(result2.current.activeStore).toBe('Woolworths');
  });

  it('addStore saves a new store and updates savedStores', async () => {
    const { result } = renderHook(() => useShoppingMode('plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.addStore('Aldi Newtown'); });
    expect(result.current.savedStores.map(s => s.name)).toContain('Aldi Newtown');
  });

  it('savedStores are sorted by lastUsed descending', async () => {
    const { result } = renderHook(() => useShoppingMode('plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.setMode('review', 'Old Store'); });
    await act(async () => { await result.current.setMode('review', 'New Store'); });
    expect(result.current.savedStores[0].name).toBe('New Store');
  });
});
