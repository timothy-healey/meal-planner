import type { Candidate } from './types';

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
