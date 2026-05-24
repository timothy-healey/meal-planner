import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ShoppingMode = 'quick' | 'review';

export interface StoreLocation {
  chain: string;
  branch: string;
}

export interface SavedStore extends StoreLocation {
  lastUsed: string; // ISO datetime
}

interface PersistedModeState {
  mode: ShoppingMode;
  store: StoreLocation | null;
}

// Legacy on-disk shape (before chain/branch split) stored `store` as a string.
interface LegacyPersistedModeState {
  mode: ShoppingMode;
  store: string | null;
}

function migrateModeState(raw: PersistedModeState | LegacyPersistedModeState): PersistedModeState {
  if (raw.store == null) return { mode: raw.mode, store: null };
  if (typeof raw.store === 'string') {
    return { mode: raw.mode, store: { chain: raw.store, branch: '' } };
  }
  return { mode: raw.mode, store: raw.store };
}

interface LegacyOrCurrentSavedStore {
  name?: string;        // legacy
  chain?: string;
  branch?: string;
  lastUsed: string;
}

const STORES_KEY = 'shopping_stores';

function modeKey(planId: string) {
  return `shopping_mode_${planId}`;
}

function migrateStore(entry: LegacyOrCurrentSavedStore): SavedStore {
  if (entry.chain != null) {
    return { chain: entry.chain, branch: entry.branch ?? '', lastUsed: entry.lastUsed };
  }
  return { chain: entry.name ?? '', branch: '', lastUsed: entry.lastUsed };
}

function sameStore(a: StoreLocation, b: StoreLocation): boolean {
  return a.chain === b.chain && a.branch === b.branch;
}

export function useShoppingMode(planId: string | null) {
  const [mode, setModeState] = useState<ShoppingMode>('quick');
  const [activeStore, setActiveStore] = useState<StoreLocation | null>(null);
  const [savedStores, setSavedStores] = useState<SavedStore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [modeRaw, storesRaw] = await Promise.all([
        planId ? AsyncStorage.getItem(modeKey(planId)) : null,
        AsyncStorage.getItem(STORES_KEY),
      ]);
      if (modeRaw) {
        const parsed = migrateModeState(JSON.parse(modeRaw));
        setModeState(parsed.mode);
        setActiveStore(parsed.store);
        // Rewrite migrated shape so subsequent reads are clean.
        if (planId) {
          await AsyncStorage.setItem(modeKey(planId), JSON.stringify(parsed));
        }
      }
      if (storesRaw) {
        const raw: LegacyOrCurrentSavedStore[] = JSON.parse(storesRaw);
        const migrated = raw.map(migrateStore);
        setSavedStores(migrated.sort((a, b) => b.lastUsed.localeCompare(a.lastUsed)));
      }
      setLoading(false);
    }
    load();
  }, [planId]);

  const addStore = useCallback(async (store: StoreLocation) => {
    const now = new Date().toISOString();
    const existingRaw = await AsyncStorage.getItem(STORES_KEY);
    const existing: SavedStore[] = existingRaw
      ? (JSON.parse(existingRaw) as LegacyOrCurrentSavedStore[]).map(migrateStore)
      : [];
    const updated = [
      { ...store, lastUsed: now },
      ...existing.filter(s => !sameStore(s, store)),
    ].sort((a, b) => b.lastUsed.localeCompare(a.lastUsed));
    await AsyncStorage.setItem(STORES_KEY, JSON.stringify(updated));
    setSavedStores(updated);
  }, []);

  const setMode = useCallback(async (newMode: ShoppingMode, store?: StoreLocation) => {
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
