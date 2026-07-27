import type { SQLiteDatabase } from 'expo-sqlite';
import type { ShoppingItemRow } from '../../types/db';
import { generateId } from '../uuid';
import { categoryOrder } from './categories';
import type { PlannedLine } from './derive';

/**
 * Reconcile the projection against stored rows.
 *
 * Rows the user has checked off are settled — their `qty` is never rewritten.
 * `planned_qty` still tracks what the recipes now call for, so
 * `item_key IS NOT NULL AND qty IS NOT planned_qty` marks a line that has
 * drifted from its recipe. Manual rows (`item_key IS NULL`) are untouched.
 */
export async function applyDerivation(
  db: SQLiteDatabase,
  planId: string,
  lines: PlannedLine[],
): Promise<void> {
  const storedRows = await db.getAllAsync<ShoppingItemRow>(
    'SELECT * FROM shopping_items WHERE plan_id = ? AND item_key IS NOT NULL',
    [planId],
  );
  const stored = new Map(storedRows.map((r) => [r.item_key as string, r]));
  const wanted = new Set(lines.map((l) => l.itemKey as string));

  for (const [index, l] of lines.entries()) {
    const row = stored.get(l.itemKey as string);

    if (!row) {
      await db.runAsync(
        `INSERT INTO shopping_items
           (id, plan_id, category, category_order, item_order, name, qty,
            estimated_price, is_oneoff, note, is_checked, item_key, planned_qty)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 0, ?, ?)`,
        [generateId(), planId, l.category, categoryOrder(l.category), index,
         l.name, l.qty, l.note, l.itemKey, l.qty],
      );
      continue;
    }

    if (row.is_checked === 1) {
      // Settled. Track what the plan now wants, but leave the line alone.
      await db.runAsync(
        'UPDATE shopping_items SET planned_qty = ? WHERE id = ?',
        [l.qty, row.id],
      );
      continue;
    }

    await db.runAsync(
      `UPDATE shopping_items
         SET name = ?, qty = ?, planned_qty = ?, category = ?, category_order = ?, note = ?
       WHERE id = ?`,
      [l.name, l.qty, l.qty, l.category, categoryOrder(l.category), l.note, row.id],
    );
  }

  for (const row of storedRows) {
    if (wanted.has(row.item_key as string)) continue;
    // An unchecked row that left the projection is simply gone. A checked row
    // was bought — but if Catalog merged its key away, keeping it would shadow
    // the new key with a permanent duplicate, so retire it too.
    await db.runAsync('DELETE FROM shopping_items WHERE id = ?', [row.id]);
  }
}
