import { useState, useEffect, useCallback } from 'react';
import { useDb } from '../providers/DatabaseProvider';
import { normalisePrice } from '../lib/normalisePrice';
import type { PricePoint, PurchaseHistoryRow, QtyUnit } from '../types/db';

type PurchaseWithChain = PurchaseHistoryRow & { chain: string };

export function usePriceHistory(
  brand: string | null,
  productName: string | null,
): { points: PricePoint[]; reload: () => void } {
  const db = useDb();
  const [points, setPoints] = useState<PricePoint[]>([]);

  const load = useCallback(async () => {
    if (!brand || !productName) {
      setPoints([]);
      return;
    }
    const rows = await db.getAllAsync<PurchaseWithChain>(
      `SELECT ph.*, s.chain
       FROM purchase_history ph
       JOIN stores s ON ph.store_id = s.id
       WHERE ph.brand = ? AND ph.product_name = ?
         AND ph.price IS NOT NULL
         AND ph.qty_amount IS NOT NULL
         AND ph.qty_unit IS NOT NULL
       ORDER BY ph.purchased_at ASC`,
      [brand, productName],
    );
    setPoints(
      rows.map(row => ({
        chain: row.chain,
        purchasedAt: row.purchased_at,
        normalisedPrice: normalisePrice(
          row.price!,
          row.qty_amount!,
          row.qty_unit! as QtyUnit,
        ),
        isOnSale: row.is_sale === 1,
      })),
    );
  }, [brand, productName, db]);

  useEffect(() => { load(); }, [load]);

  return { points, reload: load };
}
