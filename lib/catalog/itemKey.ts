import type { Ingredient } from '../../meal_plan.types';
import { normaliseItemName } from './normalise';

/**
 * Identity of "a thing you might buy" — a Catalog product where the ingredient
 * is tagged, a normalised name where it isn't.
 *
 * Branded so it can't be confused with an arbitrary string.
 *
 * Catalog owns this. Merging, deleting or renaming a product changes what a key
 * resolves to, so Catalog is responsible for invalidating anything derived from
 * it — rather than every consumer having to remember that it might.
 */
export type ItemKey = string & { readonly __brand: 'ItemKey' };

export const ItemKey = {
  fromIngredient(ing: Ingredient): ItemKey {
    return ing.product_id
      ? (`product:${ing.product_id}` as ItemKey)
      : ItemKey.fromName(ing.item);
  },

  fromName(name: string): ItemKey {
    return `name:${normaliseItemName(name)}` as ItemKey;
  },

  parse(s: string): ItemKey {
    return s as ItemKey;
  },

  isProduct(key: ItemKey): boolean {
    return key.startsWith('product:');
  },

  productId(key: ItemKey): string | null {
    return key.startsWith('product:') ? key.slice('product:'.length) : null;
  },
};
