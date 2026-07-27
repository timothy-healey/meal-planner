/**
 * The app's own category vocabulary, fixed forever.
 *
 * Claude renames categories each week ("Pantry (this week)",
 * "One-offs (check pantry first)"), and `useCategoryOrder.applySavedOrder`
 * matches on exact strings — so imported plans quietly lose the saved
 * aisle-walking order between weeks. Self-built plans use these names instead,
 * so the order sticks.
 */
export const CATEGORIES = [
  'Meat & Poultry',
  'Fresh Produce',
  'Pantry',
  'Dairy & Fridge',
  'Frozen',
  'Drinks',
  'Household',
  'Unsorted',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const UNSORTED: Category = 'Unsorted';

export function categoryOrder(c: Category): number {
  return CATEGORIES.indexOf(c);
}

const ALIASES: Record<string, Category> = {
  'meat': 'Meat & Poultry',
  'poultry': 'Meat & Poultry',
  'meat and poultry': 'Meat & Poultry',
  'produce': 'Fresh Produce',
  'fruit & veg': 'Fresh Produce',
  'fruit and veg': 'Fresh Produce',
  'vegetables': 'Fresh Produce',
  'dairy': 'Dairy & Fridge',
  'fridge': 'Dairy & Fridge',
  'dairy and fridge': 'Dairy & Fridge',
  'freezer': 'Frozen',
  'drink': 'Drinks',
  'cleaning': 'Household',
};

/**
 * Map an arbitrary category name onto the fixed vocabulary, or null if it
 * won't map.
 *
 * Null matters. `useShoppingItems.updateItem` is plan-agnostic, so category
 * learning also fires on imported plans; storing a raw Claude name would feed
 * "Pantry (this week)" straight back into self-built plans — the exact drift
 * the fixed vocabulary exists to prevent. Unmappable names are discarded
 * rather than propagated.
 */
export function toCategory(raw: string): Category | null {
  const stripped = raw.replace(/\([^)]*\)/g, ' ').trim().replace(/\s+/g, ' ');
  const lower = stripped.toLowerCase();

  const exact = CATEGORIES.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;

  return ALIASES[lower] ?? null;
}
