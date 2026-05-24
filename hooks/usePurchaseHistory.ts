import { useEffect, useState, useCallback } from 'react';
import { useDb } from '../providers/DatabaseProvider';
import { generateId } from '../lib/uuid';
import type { PurchaseHistoryRow, QtyUnit } from '../types/db';

export interface AddPurchaseData {
  plan_id: string;
  item_name: string;
  store: string;
  brand: string | null;
  product_name: string | null;
  qty_amount: number | null;
  qty_unit: QtyUnit | null;
  price: number | null;
  is_sale: 0 | 1;
  barcode: string | null;
  purchased_at: string;
}

export function usePurchaseHistory(planId: string | null) {
  const db = useDb();
  const [records, setRecords] = useState<PurchaseHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!planId) { setRecords([]); setLoading(false); return; }
    const rows = await db.getAllAsync<PurchaseHistoryRow>(
      'SELECT * FROM purchase_history WHERE plan_id = ? ORDER BY purchased_at DESC',
      [planId]
    );
    setRecords(rows);
    setLoading(false);
  }, [planId, db]);

  useEffect(() => { load(); }, [load]);

  const addRecord = useCallback(async (data: AddPurchaseData) => {
    const id = generateId();
    await db.runAsync(
      `INSERT INTO purchase_history
         (id, plan_id, item_name, store, brand, product_name,
          qty_amount, qty_unit, price, is_sale, barcode, purchased_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.plan_id, data.item_name, data.store, data.brand,
       data.product_name, data.qty_amount, data.qty_unit, data.price,
       data.is_sale, data.barcode, data.purchased_at]
    );
    await load();
  }, [db, load]);

  const getLatestForItem = useCallback(async (itemName: string): Promise<PurchaseHistoryRow | null> => {
    const rows = await db.getAllAsync<PurchaseHistoryRow>(
      `SELECT * FROM purchase_history
       WHERE LOWER(item_name) = LOWER(?) AND is_sale = 0
       ORDER BY purchased_at DESC LIMIT 1`,
      [itemName]
    );
    if (rows.length > 0) return rows[0];
    const saleRows = await db.getAllAsync<PurchaseHistoryRow>(
      `SELECT * FROM purchase_history
       WHERE LOWER(item_name) = LOWER(?)
       ORDER BY purchased_at DESC LIMIT 1`,
      [itemName]
    );
    return saleRows[0] ?? null;
  }, [db]);

  const getLatestForBarcode = useCallback(async (barcode: string): Promise<PurchaseHistoryRow | null> => {
    const rows = await db.getAllAsync<PurchaseHistoryRow>(
      `SELECT * FROM purchase_history
       WHERE barcode = ?
       ORDER BY purchased_at DESC LIMIT 1`,
      [barcode]
    );
    return rows[0] ?? null;
  }, [db]);

  return { records, loading, addRecord, getLatestForItem, getLatestForBarcode };
}
