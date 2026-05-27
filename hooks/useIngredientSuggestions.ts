import { useCallback, useRef } from 'react';
import { useDb } from '../providers/DatabaseProvider';
import {
  dedupCandidates,
  projectBrands,
  rankEmptyQuery,
  rankFuzzyQuery,
} from '../lib/suggestions/ranking';
import type { Candidate, QueryParams, Suggestion } from '../lib/suggestions/types';

interface Row {
  product_id: string;
  brand: string;
  product_name: string;
  item_name: string;
  has_nutrition: 0 | 1;
  last_used_at: string;
}

const SQL = `
  SELECT p.id AS product_id, p.brand, p.product_name, p.item_name,
         CASE WHEN p.cal_per_basis IS NOT NULL OR p.protein_per_basis IS NOT NULL
                OR p.carbs_per_basis IS NOT NULL OR p.fat_per_basis IS NOT NULL
              THEN 1 ELSE 0 END AS has_nutrition,
         COALESCE(MAX(ph.purchased_at), p.updated_at) AS last_used_at
  FROM products p
  LEFT JOIN purchase_history ph ON ph.product_id = p.id
  WHERE p.brand <> ''
  GROUP BY p.id
`;

export function useIngredientSuggestions() {
  const db = useDb();
  const cache = useRef<Candidate[] | null>(null);

  const fetchCandidates = useCallback(async (): Promise<Candidate[]> => {
    if (cache.current) return cache.current;
    const rows = await db.getAllAsync<Row>(SQL);
    const candidates: Candidate[] = rows.map(r => ({
      brand: r.brand,
      productName: r.product_name,
      itemName: r.item_name,
      productId: r.product_id,
      hasNutrition: r.has_nutrition === 1,
      lastUsedAt: r.last_used_at,
    }));
    const deduped = dedupCandidates(candidates);
    cache.current = deduped;
    return deduped;
  }, [db]);

  const query = useCallback(async (p: QueryParams): Promise<Suggestion[]> => {
    const all = await fetchCandidates();

    const filtered = p.field === 'product' && p.brandFilter && p.brandFilter.trim()
      ? all.filter(c => c.brand.trim().toLowerCase() === p.brandFilter!.trim().toLowerCase())
      : all;

    const targets: Suggestion[] = p.field === 'brand'
      ? projectBrands(filtered)
      : filtered.map(c => ({
          kind: 'product' as const,
          brand: c.brand,
          productName: c.productName,
          lastUsedAt: c.lastUsedAt,
          productId: c.productId,
          hasNutrition: c.hasNutrition,
          matches: [],
        }));

    const itemNameById = new Map<string, string>();
    for (const c of filtered) itemNameById.set(c.productId, c.itemName);
    const lookup = (id: string) => itemNameById.get(id) ?? null;

    if (p.text.trim() === '') {
      return rankEmptyQuery(targets, p.ingredientName, lookup);
    }
    return rankFuzzyQuery(targets, p.text, p.field, p.ingredientName, lookup);
  }, [fetchCandidates]);

  const invalidate = useCallback(() => {
    cache.current = null;
  }, []);

  return { query, invalidate };
}
