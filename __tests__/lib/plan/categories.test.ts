import { CATEGORIES, UNSORTED, categoryOrder, toCategory } from '../../../lib/plan/categories';

describe('categories', () => {
  it('exposes a stable ordered vocabulary ending in Unsorted', () => {
    expect(CATEGORIES[0]).toBe('Meat & Poultry');
    expect(CATEGORIES[CATEGORIES.length - 1]).toBe(UNSORTED);
  });

  it('orders by position in the vocabulary', () => {
    expect(categoryOrder('Meat & Poultry')).toBe(0);
    expect(categoryOrder(UNSORTED)).toBe(CATEGORIES.length - 1);
  });

  it('maps an exact name', () => {
    expect(toCategory('Fresh Produce')).toBe('Fresh Produce');
  });

  it('strips Claude week-specific suffixes', () => {
    // The reason the fixed vocabulary exists: applySavedOrder matches exact
    // strings, so "Pantry (this week)" loses the saved walking order weekly.
    expect(toCategory('Pantry (this week)')).toBe('Pantry');
  });

  it('is case- and space-insensitive', () => {
    expect(toCategory('  dairy & fridge ')).toBe('Dairy & Fridge');
  });

  it('maps known aliases', () => {
    expect(toCategory('Meat')).toBe('Meat & Poultry');
    expect(toCategory('Fruit & Veg')).toBe('Fresh Produce');
  });

  it('returns null for a name that will not map', () => {
    // "One-offs" is a purchase-mode flag, not a category — deliberately unmapped.
    expect(toCategory('One-offs (check pantry first)')).toBeNull();
    expect(toCategory('Blah')).toBeNull();
  });

  it('maps every category to itself', () => {
    for (const c of CATEGORIES) expect(toCategory(c)).toBe(c);
  });
});
