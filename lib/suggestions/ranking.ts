import Fuse from 'fuse.js';
import type { Candidate, Suggestion } from './types';

const DAY_MS = 86_400_000;

export function recencyMultiplier(lastUsedAtIso: string, now: number = Date.now()): number {
  const days = Math.max(0, (now - Date.parse(lastUsedAtIso)) / DAY_MS);
  return 1 - 0.2 * Math.exp(-days / 30);
}

export function itemNameMatches(candidateItemName: string | null, ingredientName: string): boolean {
  if (!candidateItemName || !ingredientName.trim()) return false;
  const fuse = new Fuse([candidateItemName], { threshold: 0.4, ignoreLocation: true });
  return fuse.search(ingredientName).length > 0;
}


function normKey(brand: string, productName: string | null): string {
  return `${brand.trim().toLowerCase()}::${(productName ?? '').trim().toLowerCase()}`;
}

export function dedupCandidates(rows: Candidate[]): Candidate[] {
  const byKey = new Map<string, Candidate>();
  for (const row of rows) {
    const key = normKey(row.brand, row.productName);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }
    const winningId = existing.foodNutritionId ?? row.foodNutritionId;
    const winningItem = existing.itemName ?? row.itemName;
    const merged: Candidate = {
      brand: existing.brand,
      productName: existing.productName,
      itemName: winningItem,
      foodNutritionId: winningId,
      lastUsedAt:
        existing.lastUsedAt >= row.lastUsedAt ? existing.lastUsedAt : row.lastUsedAt,
    };
    byKey.set(key, merged);
  }
  return Array.from(byKey.values());
}

export function projectBrands(candidates: Candidate[]): Suggestion[] {
  const byBrand = new Map<string, {
    brand: string;
    products: Set<string>;
    latestProductName: string | null;
    lastUsedAt: string;
  }>();
  for (const c of candidates) {
    const key = c.brand.trim().toLowerCase();
    const existing = byBrand.get(key);
    if (!existing) {
      byBrand.set(key, {
        brand: c.brand,
        products: new Set(c.productName ? [c.productName] : []),
        latestProductName: c.productName,
        lastUsedAt: c.lastUsedAt,
      });
      continue;
    }
    if (c.productName) existing.products.add(c.productName);
    if (c.lastUsedAt > existing.lastUsedAt) {
      existing.lastUsedAt = c.lastUsedAt;
      existing.latestProductName = c.productName;
    }
  }
  return Array.from(byBrand.values()).map<Suggestion>(b => ({
    kind: 'brand',
    brand: b.brand,
    productName: null,
    productCount: b.products.size,
    latestProductName: b.latestProductName,
    lastUsedAt: b.lastUsedAt,
    foodNutritionId: null,
    matches: [],
  }));
}

export function rankEmptyQuery(
  targets: Suggestion[],
  ingredientName: string,
  lookupItemName: (foodNutritionId: string) => string | null,
): Suggestion[] {
  const scored = targets.map(t => {
    const itemName = t.foodNutritionId ? lookupItemName(t.foodNutritionId) : null;
    const isMatch = itemNameMatches(itemName, ingredientName);
    return { t, matchRank: isMatch ? 0 : 1 };
  });
  scored.sort((a, b) => {
    if (a.matchRank !== b.matchRank) return a.matchRank - b.matchRank;
    return b.t.lastUsedAt.localeCompare(a.t.lastUsedAt);
  });
  return scored.slice(0, 5).map(s => ({ ...s.t, matches: [] }));
}
