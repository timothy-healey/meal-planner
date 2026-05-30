import { useEffect, useState, useCallback } from 'react';
import { useDb, usePlanVersion } from '../providers/DatabaseProvider';
import { findDuplicateMatches } from '../lib/catalog/findDuplicates';
import type { ProductRow } from '../types/db';

export type CatalogIssue = 'duplicate' | 'missing_nutrition' | 'unused' | null;

export interface CatalogRow {
  product: ProductRow;
  latest: { price: number; chain: string; purchased_at: string; qty: string } | null;
  purchase_count: number;
  recipe_count: number;
  last_used_at: string;
  issue: CatalogIssue;
  duplicate_of?: { id: string; brand: string; product_name: string };
}

export interface CatalogCounts {
  missingNutrition: number;
  unused: number;
  duplicates: number;
  total: number;
}

interface BaseRow extends ProductRow {
  purchase_count: number;
  latest_purchased_at: string | null;
  last_used_at: string;
}

interface LatestRow {
  product_id: string;
  price: number;
  chain: string;
  purchased_at: string;
  qty_amount: number;
  qty_unit: string;
}

function formatQty(amount: number, unit: string): string {
  if (unit === 'units') return amount === 1 ? '1 unit' : `${amount} units`;
  return `${amount}${unit}`;
}

function hasAnyMacro(p: ProductRow): boolean {
  return p.cal_per_basis != null || p.protein_per_basis != null ||
         p.carbs_per_basis != null || p.fat_per_basis != null;
}

export function useCatalog(): {
  rows: CatalogRow[];
  counts: CatalogCounts;
  loading: boolean;
  reload: () => void;
} {
  const db = useDb();
  const { planVersion } = usePlanVersion();
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [counts, setCounts] = useState<CatalogCounts>({
    missingNutrition: 0, unused: 0, duplicates: 0, total: 0,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    const base = await db.getAllAsync<BaseRow>(
      `SELECT
         p.*,
         COUNT(DISTINCT ph.id) AS purchase_count,
         MAX(ph.purchased_at) AS latest_purchased_at,
         COALESCE(MAX(ph.purchased_at), p.updated_at) AS last_used_at
       FROM products p
       LEFT JOIN purchase_history ph
         ON ph.product_id = p.id AND ph.status = 'confirmed'
       GROUP BY p.id`,
    );

    let latestByProduct: Map<string, LatestRow> = new Map();
    if (base.length > 0) {
      const latest = await db.getAllAsync<LatestRow>(
        `WITH latest_per_product AS (
           SELECT product_id, MAX(purchased_at) AS purchased_at
           FROM purchase_history
           WHERE status = 'confirmed' AND product_id IS NOT NULL
           GROUP BY product_id
         )
         SELECT ph.product_id, ph.price, s.chain, ph.purchased_at,
                ph.qty_amount, ph.qty_unit
         FROM purchase_history ph
         JOIN latest_per_product lp
           ON lp.product_id = ph.product_id AND lp.purchased_at = ph.purchased_at
         JOIN stores s ON s.id = ph.store_id
         WHERE ph.status = 'confirmed'`,
      );
      latestByProduct = new Map(latest.map(l => [l.product_id, l]));
    }

    const recipeRefs = await db.getAllAsync<{ product_id: string; recipe_count: number }>(
      `SELECT json_extract(ing.value, '$.product_id') AS product_id,
              COUNT(DISTINCT r.id) AS recipe_count
       FROM recipes r, json_each(r.ingredients_json) ing
       WHERE json_extract(ing.value, '$.product_id') IS NOT NULL
       GROUP BY product_id`,
    );
    const recipeCountById = new Map(recipeRefs.map(r => [r.product_id, r.recipe_count]));

    const products: ProductRow[] = base.map(r => ({
      id: r.id, brand: r.brand, product_name: r.product_name, item_name: r.item_name,
      basis: r.basis, cal_per_basis: r.cal_per_basis,
      protein_per_basis: r.protein_per_basis, carbs_per_basis: r.carbs_per_basis,
      fat_per_basis: r.fat_per_basis, updated_at: r.updated_at,
    }));

    const duplicates = findDuplicateMatches(products);

    const out: CatalogRow[] = base.map(r => {
      const product = products.find(p => p.id === r.id)!;
      const purchase_count = r.purchase_count;
      const recipe_count = recipeCountById.get(r.id) ?? 0;
      const dup = duplicates.get(r.id);

      let issue: CatalogIssue = null;
      if (dup) issue = 'duplicate';
      else if (!hasAnyMacro(product) && recipe_count > 0) issue = 'missing_nutrition';
      else if (purchase_count === 0 && recipe_count === 0) issue = 'unused';

      const latest = latestByProduct.get(r.id);
      const latestRecord = latest
        ? {
            price: latest.price,
            chain: latest.chain,
            purchased_at: latest.purchased_at,
            qty: formatQty(latest.qty_amount, latest.qty_unit),
          }
        : null;

      const row: CatalogRow = {
        product,
        latest: latestRecord,
        purchase_count,
        recipe_count,
        last_used_at: r.last_used_at,
        issue,
      };
      if (dup) {
        row.duplicate_of = {
          id: dup.twin.id,
          brand: dup.twin.brand,
          product_name: dup.twin.product_name,
        };
      }
      return row;
    }).sort((a, b) => b.last_used_at.localeCompare(a.last_used_at));

    const nextCounts: CatalogCounts = {
      missingNutrition: out.filter(r => r.issue === 'missing_nutrition').length,
      unused: out.filter(r => r.issue === 'unused').length,
      duplicates: out.filter(r => r.issue === 'duplicate').length,
      total: out.length,
    };

    setRows(out);
    setCounts(nextCounts);
    setLoading(false);
  }, [db]);

  useEffect(() => { load(); }, [load, planVersion]);

  return { rows, counts, loading, reload: load };
}
