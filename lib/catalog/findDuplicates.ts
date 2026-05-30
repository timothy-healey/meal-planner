import Fuse from 'fuse.js';
import type { ProductRow } from '../../types/db';

export interface DuplicateMatch {
  product: ProductRow;
  twin: ProductRow;
}

function normaliseItemName(s: string): string {
  return s.trim().toLowerCase();
}

export function findDuplicateMatches(
  products: ProductRow[],
): Map<string, DuplicateMatch> {
  const result = new Map<string, DuplicateMatch>();

  const byItemName = new Map<string, ProductRow[]>();
  for (const p of products) {
    const key = normaliseItemName(p.item_name);
    if (!byItemName.has(key)) byItemName.set(key, []);
    byItemName.get(key)!.push(p);
  }

  for (const group of byItemName.values()) {
    if (group.length < 2) continue;
    const fuse = new Fuse(group, {
      keys: ['product_name'],
      threshold: 0.4,
      ignoreLocation: true,
    });
    for (const product of group) {
      const hits = fuse
        .search(product.product_name)
        .filter(h => h.item.id !== product.id);
      if (hits.length > 0) {
        result.set(product.id, { product, twin: hits[0].item });
      }
    }
  }
  return result;
}
