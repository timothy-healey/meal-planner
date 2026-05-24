import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Prefs = Record<string, number>;
const KEY = 'category_order_prefs';

export function useCategoryOrder() {
  const [prefs, setPrefs] = useState<Prefs>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    AsyncStorage.getItem(KEY).then((raw) => {
      setPrefs(raw ? JSON.parse(raw) : {});
      setLoading(false);
    });
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const saveOrder = useCallback(async (order: Prefs) => {
    await AsyncStorage.setItem(KEY, JSON.stringify(order));
    setPrefs(order);
  }, []);

  const applySavedOrder = useCallback(
    (categories: string[]): string[] => {
      const known = categories.filter((c) => c in prefs);
      const unknown = categories.filter((c) => !(c in prefs));
      known.sort((a, b) => prefs[a] - prefs[b]);
      return [...known, ...unknown];
    },
    [prefs]
  );

  return { prefs, loading, saveOrder, applySavedOrder, reload };
}
