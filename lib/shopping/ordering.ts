/** The minimum a row needs for its position in the list to be computed. */
export interface Orderable {
  category: string;
  category_order: number;
  item_order: number;
}

export interface Orders {
  categoryOrder: number;
  itemOrder: number;
}

/**
 * Where a new row lands: joining an existing category keeps that category's
 * established position, a new category goes after every existing one.
 *
 * Extracted because `addItem` and `updateItem` each stated this rule
 * separately, and `applyDerivation` needs the same one. Three copies of a
 * positioning rule is three chances for the list to sort differently depending
 * on how a row arrived.
 *
 * Both figures come from `Math.max`, not a count — `deleteItem` leaves gaps,
 * and numbering from the count would collide with a surviving row.
 */
export function nextOrders(items: Orderable[], category: string): Orders {
  const inCategory = items.filter((i) => i.category === category);

  if (inCategory.length > 0) {
    return {
      categoryOrder: inCategory[0].category_order,
      itemOrder: Math.max(...inCategory.map((i) => i.item_order)) + 1,
    };
  }

  return {
    categoryOrder: items.length > 0
      ? Math.max(...items.map((i) => i.category_order)) + 1
      : 0,
    itemOrder: 0,
  };
}
