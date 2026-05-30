import { useState, useEffect, useCallback } from 'react';
import { useDb } from '../providers/DatabaseProvider';
import { normalisePrice } from '../lib/normalisePrice';
import type { ProductPricePoint, PurchaseHistoryRow, QtyUnit } from '../types/db';

type Row = PurchaseHistoryRow & {
  chain: string;
  brand: string;
  product_name: string;
};

export function usePriceHistory(
  itemName: string | null,
): { points: ProductPricePoint[]; reload: () => void } {
  const db = useDb();
  const [points, setPoints] = useState<ProductPricePoint[]>([]);

  const load = useCallback(async () => {
    if (!itemName) {
      setPoints([]);
      return;
    }
    const rows = await db.getAllAsync<Row>(
      `SELECT ph.*, s.chain, p.brand, p.product_name
       FROM purchase_history ph
       JOIN stores s ON ph.store_id = s.id
       JOIN products p ON p.id = ph.product_id
       WHERE LOWER(p.item_name) = LOWER(?)
         AND ph.price IS NOT NULL
         AND ph.qty_amount IS NOT NULL
         AND ph.qty_unit IS NOT NULL
         AND ph.status = 'confirmed'
       ORDER BY ph.purchased_at ASC`,
      [itemName],
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
        productId: row.product_id!,
        brand: row.brand,
        productName: row.product_name,
      })),
    );
  }, [itemName, db]);

  useEffect(() => { load(); }, [load]);

  return { points, reload: load };
}
