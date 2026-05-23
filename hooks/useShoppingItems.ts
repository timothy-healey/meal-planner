import { useEffect, useState, useCallback } from 'react';
import { useDb } from '../providers/DatabaseProvider';
import type { ShoppingItemRow } from '../types/db';

export interface ShoppingItem extends ShoppingItemRow {
  isChecked: boolean;
}

export function useShoppingItems(planId: string | null) {
  const db = useDb();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!planId) { setItems([]); setLoading(false); return; }
    const rows = await db.getAllAsync<ShoppingItemRow>(
      'SELECT * FROM shopping_items WHERE plan_id = ? ORDER BY category_order, item_order',
      [planId]
    );
    setItems(rows.map((r) => ({ ...r, isChecked: r.is_checked === 1 })));
    setLoading(false);
  }

  useEffect(() => { load(); }, [planId]);

  const toggleItem = useCallback(async (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const next = item.isChecked ? 0 : 1;
    await db.runAsync('UPDATE shopping_items SET is_checked = ? WHERE id = ?', [next, itemId]);
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, isChecked: !i.isChecked, is_checked: next } : i))
    );
  }, [items, db]);

  const resetAll = useCallback(async () => {
    if (!planId) return;
    await db.runAsync('UPDATE shopping_items SET is_checked = 0 WHERE plan_id = ?', [planId]);
    setItems((prev) => prev.map((i) => ({ ...i, isChecked: false, is_checked: 0 })));
  }, [planId, db]);

  return { items, loading, toggleItem, resetAll };
}
