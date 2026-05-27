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
  brand: string;
  product_name: string | null;
  item_name: string | null;
  food_nutrition_id: string | null;
  last_used_at: string;
}

const SQL = `
  SELECT brand, product_name, item_name, id AS food_nutrition_id, updated_at AS last_used_at
  FROM food_nutrition
  WHERE brand IS NOT NULL AND TRIM(brand) <> ''
  UNION ALL
  SELECT brand, product_name, NULL AS item_name, NULL AS food_nutrition_id,
         MAX(purchased_at) AS last_used_at
  FROM purchase_history
  WHERE brand IS NOT NULL AND TRIM(brand) <> ''
  GROUP BY brand, product_name
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
      foodNutritionId: r.food_nutrition_id,
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
          foodNutritionId: c.foodNutritionId,
          matches: [],
        }));

    const itemNameById = new Map<string, string>();
    for (const c of filtered) {
      if (c.foodNutritionId && c.itemName) itemNameById.set(c.foodNutritionId, c.itemName);
    }
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
