import { useCallback, useEffect, useState } from 'react';
import { useDb } from '../providers/DatabaseProvider';
import type { ItemCategoryMapRow } from '../types/db';
import type { ItemKey } from '../lib/catalog/itemKey';
import { normaliseItemName } from '../lib/catalog/normalise';
import { UNSORTED, toCategory, type Category } from '../lib/plan/categories';

export function useItemCategoryMap() {
  const db = useDb();
  const [map, setMap] = useState<Record<string, Category>>({});
  const [history, setHistory] = useState<Record<string, Category>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const rows = await db.getAllAsync<ItemCategoryMapRow>('SELECT * FROM item_category_map');
    const learned: Record<string, Category> = {};
    for (const r of rows) {
      const c = toCategory(r.category);
      if (c) learned[r.item_key] = c;
    }
    setMap(learned);

    // Second tier: what past shopping lists called this item. Measured at 47%
    // coverage on the sample plan — the reason normalisation exists at all.
    // One row per distinct name, most recent winning; unbounded otherwise.
    const past = await db.getAllAsync<{ name: string; category: string }>(
      `SELECT name, category FROM shopping_items
        WHERE rowid IN (SELECT MAX(rowid) FROM shopping_items GROUP BY name)`,
    );
    const byName: Record<string, Category> = {};
    for (const r of past) {
      const c = toCategory(r.category);
      if (c) byName[normaliseItemName(r.name)] = c;
    }
    setHistory(byName);

    setLoading(false);
  }, [db]);

  useEffect(() => { load(); }, [load]);

  /** Learned → historical → Unsorted. */
  const categoryFor = useCallback(
    (key: ItemKey, name: string): Category =>
      map[key] ?? history[normaliseItemName(name)] ?? UNSORTED,
    [map, history],
  );

  /**
   * Record a category against an item.
   *
   * The name is mapped onto the fixed vocabulary first and discarded if it
   * won't map. `useShoppingItems.updateItem` is plan-agnostic, so this also
   * fires on imported plans — storing the raw name would feed Claude's
   * "Pantry (this week)" into self-built plans.
   */
  const learn = useCallback(async (key: ItemKey, rawCategory: string) => {
    const category = toCategory(rawCategory);
    if (!category) return;
    await db.runAsync(
      'INSERT OR REPLACE INTO item_category_map (item_key, category, updated_at) VALUES (?, ?, ?)',
      [key, category, new Date().toISOString()],
    );
    setMap((prev) => ({ ...prev, [key]: category }));
  }, [db]);

  return { categoryFor, learn, loading, reload: load };
}
