import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ShoppingMode = 'quick' | 'review';

export interface SavedStore {
  name: string;
  lastUsed: string; // ISO datetime
}

interface PersistedModeState {
  mode: ShoppingMode;
  store: string | null;
}

const STORES_KEY = 'shopping_stores';

function modeKey(planId: string) {
  return `shopping_mode_${planId}`;
}

export function useShoppingMode(planId: string | null) {
  const [mode, setModeState] = useState<ShoppingMode>('quick');
  const [activeStore, setActiveStore] = useState<string | null>(null);
  const [savedStores, setSavedStores] = useState<SavedStore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [modeRaw, storesRaw] = await Promise.all([
        planId ? AsyncStorage.getItem(modeKey(planId)) : null,
        AsyncStorage.getItem(STORES_KEY),
      ]);
      if (modeRaw) {
        const parsed: PersistedModeState = JSON.parse(modeRaw);
        setModeState(parsed.mode);
        setActiveStore(parsed.store);
      }
      if (storesRaw) {
        const stores: SavedStore[] = JSON.parse(storesRaw);
        setSavedStores(stores.sort((a, b) => b.lastUsed.localeCompare(a.lastUsed)));
      }
      setLoading(false);
    }
    load();
  }, [planId]);

  const addStore = useCallback(async (name: string) => {
    const now = new Date().toISOString();
    const existing: SavedStore[] = JSON.parse(await AsyncStorage.getItem(STORES_KEY) ?? '[]');
    const updated = [
      { name, lastUsed: now },
      ...existing.filter(s => s.name !== name),
    ].sort((a, b) => b.lastUsed.localeCompare(a.lastUsed));
    await AsyncStorage.setItem(STORES_KEY, JSON.stringify(updated));
    setSavedStores(updated);
  }, []);

  const setMode = useCallback(async (newMode: ShoppingMode, store?: string) => {
    const newStore = newMode === 'review' ? (store ?? null) : null;
    setModeState(newMode);
    setActiveStore(newStore);
    if (planId) {
      const state: PersistedModeState = { mode: newMode, store: newStore };
      await AsyncStorage.setItem(modeKey(planId), JSON.stringify(state));
    }
    if (newMode === 'review' && store) {
      await addStore(store);
    }
  }, [planId, addStore]);

  return { mode, activeStore, savedStores, loading, setMode, addStore };
}
