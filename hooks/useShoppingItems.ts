import { useEffect, useState, useCallback } from 'react';
import { useDb } from '../providers/DatabaseProvider';
import { generateId } from '../lib/uuid';
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

  const addItem = useCallback(async (data: {
    name: string;
    qty: string;
    estimatedPrice: number;
    category: string;
  }) => {
    if (!planId) return;
    const catItems = items.filter((i) => i.category === data.category);
    const existingCatItem = items.find((i) => i.category === data.category);
    const categoryOrder = existingCatItem?.category_order ??
      (items.length > 0 ? Math.max(...items.map((i) => i.category_order)) + 1 : 0);
    const itemOrder = catItems.length > 0
      ? Math.max(...catItems.map((i) => i.item_order)) + 1
      : 0;
    const id = generateId();
    await db.runAsync(
      `INSERT INTO shopping_items
         (id, plan_id, category, category_order, item_order, name, qty,
          estimated_price, is_oneoff, note, is_checked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, 0)`,
      [id, planId, data.category, categoryOrder, itemOrder,
       data.name, data.qty, data.estimatedPrice]
    );
    await load();
  }, [planId, items, db]);

  const deleteItem = useCallback(async (itemId: string) => {
    await db.runAsync('DELETE FROM shopping_items WHERE id = ?', [itemId]);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  }, [db]);

  return { items, loading, toggleItem, resetAll, addItem, deleteItem };
}
