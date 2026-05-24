import { useEffect, useState, useCallback } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useDb } from '../providers/DatabaseProvider';
import { generateId } from '../lib/uuid';
import type { PurchaseHistoryRow, QtyUnit } from '../types/db';

export interface AddPurchaseData {
  plan_id: string | null;
  item_name: string;
  store: string;
  branch?: string;
  brand: string | null;
  product_name: string | null;
  qty_amount: number | null;
  qty_unit: QtyUnit | null;
  price: number | null;
  is_sale: 0 | 1;
  barcode: string | null;
  purchased_at: string;
}

async function resolveOrCreateStore(
  db: SQLiteDatabase,
  chainName: string,
  branchName: string = '',
): Promise<string> {
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM stores WHERE LOWER(chain) = LOWER(?) AND LOWER(branch) = LOWER(?)',
    [chainName, branchName],
  );
  if (existing) return existing.id;
  const id = generateId();
  await db.runAsync(
    'INSERT INTO stores (id, chain, branch, created_at) VALUES (?, ?, ?, ?)',
    [id, chainName, branchName, new Date().toISOString()],
  );
  return id;
}

export function usePurchaseHistory(planId: string | null) {
  const db = useDb();
  const [records, setRecords] = useState<PurchaseHistoryRow[]>([]);
  const [pendingRecords, setPendingRecords] = useState<PurchaseHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!planId) {
      setRecords([]); setPendingRecords([]); setLoading(false); return;
    }
    const [confirmed, pending] = await Promise.all([
      db.getAllAsync<PurchaseHistoryRow>(
        "SELECT * FROM purchase_history WHERE plan_id = ? AND status = 'confirmed' ORDER BY purchased_at DESC",
        [planId],
      ),
      db.getAllAsync<PurchaseHistoryRow>(
        "SELECT * FROM purchase_history WHERE plan_id = ? AND status = 'pending' ORDER BY purchased_at ASC",
        [planId],
      ),
    ]);
    setRecords(confirmed);
    setPendingRecords(pending);
    setLoading(false);
  }, [planId, db]);

  useEffect(() => { load(); }, [load]);

  const addRecord = useCallback(async (
    data: AddPurchaseData,
    status: 'pending' | 'confirmed' = 'confirmed',
  ) => {
    const id = generateId();
    const storeId = await resolveOrCreateStore(db, data.store, data.branch ?? '');
    await db.runAsync(
      `INSERT INTO purchase_history
         (id, plan_id, item_name, store_id, brand, product_name,
          qty_amount, qty_unit, price, is_sale, barcode, purchased_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.plan_id, data.item_name, storeId, data.brand,
       data.product_name, data.qty_amount, data.qty_unit, data.price,
       data.is_sale, data.barcode, data.purchased_at, status]
    );
    await load();
  }, [db, load]);

  const getLatestForItem = useCallback(async (itemName: string): Promise<PurchaseHistoryRow | null> => {
    const rows = await db.getAllAsync<PurchaseHistoryRow>(
      `SELECT * FROM purchase_history
       WHERE LOWER(item_name) = LOWER(?) AND is_sale = 0 AND status = 'confirmed'
       ORDER BY purchased_at DESC LIMIT 1`,
      [itemName]
    );
    if (rows.length > 0) return rows[0];
    const saleRows = await db.getAllAsync<PurchaseHistoryRow>(
      `SELECT * FROM purchase_history
       WHERE LOWER(item_name) = LOWER(?) AND status = 'confirmed'
       ORDER BY purchased_at DESC LIMIT 1`,
      [itemName]
    );
    return saleRows[0] ?? null;
  }, [db]);

  const getLatestForBarcode = useCallback(async (barcode: string): Promise<PurchaseHistoryRow | null> => {
    const rows = await db.getAllAsync<PurchaseHistoryRow>(
      `SELECT * FROM purchase_history
       WHERE barcode = ? AND status = 'confirmed'
       ORDER BY purchased_at DESC LIMIT 1`,
      [barcode]
    );
    return rows[0] ?? null;
  }, [db]);

  const deletePending = useCallback(async (planIdArg: string, itemName: string) => {
    await db.runAsync(
      `DELETE FROM purchase_history
       WHERE plan_id = ? AND LOWER(item_name) = LOWER(?) AND status = 'pending'`,
      [planIdArg, itemName],
    );
    await load();
  }, [db, load]);

  const updatePending = useCallback(async (id: string, data: AddPurchaseData) => {
    const storeId = await resolveOrCreateStore(db, data.store, data.branch ?? '');
    await db.runAsync(
      `UPDATE purchase_history
       SET item_name = ?, store_id = ?, brand = ?, product_name = ?,
           qty_amount = ?, qty_unit = ?, price = ?, is_sale = ?,
           barcode = ?, purchased_at = ?
       WHERE id = ? AND status = 'pending'`,
      [
        data.item_name, storeId, data.brand, data.product_name,
        data.qty_amount, data.qty_unit, data.price, data.is_sale,
        data.barcode, data.purchased_at, id,
      ],
    );
    await load();
  }, [db, load]);

  const confirmShop = useCallback(async (planIdArg: string) => {
    await db.runAsync('BEGIN');
    try {
      await db.runAsync(
        "UPDATE purchase_history SET status = 'confirmed' WHERE plan_id = ? AND status = 'pending'",
        [planIdArg],
      );
      await db.runAsync(
        'DELETE FROM shopping_items WHERE plan_id = ? AND is_checked = 1',
        [planIdArg],
      );
      await db.runAsync('COMMIT');
    } catch (e) {
      await db.runAsync('ROLLBACK');
      throw e;
    }
    await load();
  }, [db, load]);

  return {
    records, pendingRecords, loading,
    addRecord, deletePending, updatePending, confirmShop,
    getLatestForItem, getLatestForBarcode,
  };
}
