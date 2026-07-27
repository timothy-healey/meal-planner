import { useEffect, useState, useCallback } from 'react';
import { useDb } from '../providers/DatabaseProvider';
import { generateId } from '../lib/uuid';
import { nextOrders } from '../lib/shopping/ordering';
import { ItemKey } from '../lib/catalog/itemKey';
import { toCategory } from '../lib/plan/categories';
import type { ShoppingItemRow } from '../types/db';

export interface ShoppingItem extends ShoppingItemRow {
  isChecked: boolean;
}

export function useShoppingItems(planId: string | null) {
  const db = useDb();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!planId) { setItems([]); setLoading(false); return; }
    const rows = await db.getAllAsync<ShoppingItemRow>(
      'SELECT * FROM shopping_items WHERE plan_id = ? ORDER BY category_order, item_order',
      [planId]
    );
    setItems(rows.map((r) => ({ ...r, isChecked: r.is_checked === 1 })));
    setLoading(false);
  }, [planId, db]);

  useEffect(() => { load(); }, [load]);

  const toggleItem = useCallback(async (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const next = item.isChecked ? 0 : 1;
    await db.runAsync('UPDATE shopping_items SET is_checked = ? WHERE id = ?', [next, itemId]);
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, isChecked: !i.isChecked, is_checked: next } : i))
    );
  }, [items, db]);

  const deleteChecked = useCallback(async () => {
    if (!planId) return;
    await db.runAsync(
      'DELETE FROM shopping_items WHERE plan_id = ? AND is_checked = 1',
      [planId],
    );
    setItems((prev) => prev.filter((i) => i.isChecked === false));
  }, [planId, db]);

  const addItem = useCallback(async (data: {
    name: string;
    qty: string;
    estimatedPrice: number;
    category: string;
    note?: string | null;
  }) => {
    if (!planId) return;
    const { categoryOrder, itemOrder } = nextOrders(items, data.category);
    const id = generateId();
    await db.runAsync(
      `INSERT INTO shopping_items
         (id, plan_id, category, category_order, item_order, name, qty,
          estimated_price, is_oneoff, note, is_checked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0)`,
      [id, planId, data.category, categoryOrder, itemOrder,
       data.name, data.qty, data.estimatedPrice, data.note ?? null]
    );
    await load();
  }, [planId, items, db, load]);

  const deleteItem = useCallback(async (itemId: string) => {
    await db.runAsync('DELETE FROM shopping_items WHERE id = ?', [itemId]);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  }, [db]);

  const updateItem = useCallback(async (itemId: string, data: {
    name: string;
    qty: string;
    estimatedPrice: number;
    category: string;
    note: string | null;
  }) => {
    const existing = items.find((i) => i.id === itemId);
    if (!existing) return;

    // Staying in the same category keeps the row where it is; moving category
    // re-positions it as if newly added there.
    const { categoryOrder, itemOrder } = data.category === existing.category
      ? { categoryOrder: existing.category_order, itemOrder: existing.item_order }
      : nextOrders(items, data.category);

    await db.runAsync(
      `UPDATE shopping_items
       SET name = ?, qty = ?, estimated_price = ?, category = ?,
           category_order = ?, item_order = ?, note = ?
       WHERE id = ?`,
      [data.name, data.qty, data.estimatedPrice, data.category,
       categoryOrder, itemOrder, data.note, itemId]
    );

    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              name: data.name,
              qty: data.qty,
              estimated_price: data.estimatedPrice,
              category: data.category,
              category_order: categoryOrder,
              item_order: itemOrder,
              note: data.note,
            }
          : i
      )
    );

    // Learn the placement. The name is mapped onto the fixed vocabulary and
    // dropped if it won't map — this fires on imported plans too, and storing
    // Claude's "Pantry (this week)" would feed that drift into self-built plans.
    if (data.category !== existing.category) {
      const key = existing.item_key
        ? ItemKey.parse(existing.item_key)
        : ItemKey.fromName(existing.name);
      const category = toCategory(data.category);
      if (category) {
        await db.runAsync(
          'INSERT OR REPLACE INTO item_category_map (item_key, category, updated_at) VALUES (?, ?, ?)',
          [key, category, new Date().toISOString()],
        );
      }
    }
  }, [items, db]);

  return { items, loading, reload: load, toggleItem, deleteChecked, addItem, updateItem, deleteItem };
}
