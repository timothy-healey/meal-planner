import { nextOrders } from '../../../lib/shopping/ordering';

interface Row { category: string; category_order: number; item_order: number }

const rows: Row[] = [
  { category: 'Fresh Produce', category_order: 0, item_order: 0 },
  { category: 'Fresh Produce', category_order: 0, item_order: 1 },
  { category: 'Dairy & Fridge', category_order: 1, item_order: 0 },
];

describe('nextOrders', () => {
  it('places the first item of an empty list at the front', () => {
    expect(nextOrders([], 'Pantry')).toEqual({ categoryOrder: 0, itemOrder: 0 });
  });

  it('joins an existing category at its established order', () => {
    expect(nextOrders(rows, 'Fresh Produce')).toEqual({ categoryOrder: 0, itemOrder: 2 });
  });

  it('appends a new category after every existing one', () => {
    expect(nextOrders(rows, 'Pantry')).toEqual({ categoryOrder: 2, itemOrder: 0 });
  });

  it('keeps category_order 0 rather than treating it as absent', () => {
    // A guard against `||`: category_order 0 is a real position, not a missing one.
    expect(nextOrders(rows, 'Fresh Produce').categoryOrder).toBe(0);
  });

  it('takes the max item_order, not the count, so gaps do not collide', () => {
    const gappy: Row[] = [
      { category: 'Pantry', category_order: 0, item_order: 0 },
      { category: 'Pantry', category_order: 0, item_order: 7 },
    ];
    expect(nextOrders(gappy, 'Pantry').itemOrder).toBe(8);
  });

  it('takes the max category_order, not the count', () => {
    const gappy: Row[] = [{ category: 'Pantry', category_order: 5, item_order: 0 }];
    expect(nextOrders(gappy, 'Frozen').categoryOrder).toBe(6);
  });

  it('ignores items in other categories when numbering within one', () => {
    expect(nextOrders(rows, 'Dairy & Fridge')).toEqual({ categoryOrder: 1, itemOrder: 1 });
  });
});
