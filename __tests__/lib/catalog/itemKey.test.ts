import { ItemKey } from '../../../lib/catalog/itemKey';
import type { Amount } from '../../../meal_plan.types';

const any: Amount = { kind: 'note', text: 'x' };

describe('ItemKey', () => {
  it('prefers product_id when the ingredient is tagged', () => {
    expect(ItemKey.fromIngredient({ item: 'Beef mince', amount: any, product_id: 'p1' }))
      .toBe('product:p1');
  });

  it('falls back to the normalised name when untagged', () => {
    expect(ItemKey.fromIngredient({ item: 'Beef mince (lean)', amount: any }))
      .toBe('name:beef mince');
  });

  it('builds a name key directly', () => {
    expect(ItemKey.fromName('Baby cos lettuce, shredded')).toBe('name:baby cos lettuce');
  });

  it('two ingredients naming the same item collapse to one key', () => {
    const a = ItemKey.fromIngredient({ item: 'Broccoli (for roast veg)', amount: any });
    const b = ItemKey.fromIngredient({ item: 'Broccoli, florets', amount: any });
    expect(a).toBe(b);
  });

  it('does not collapse a tagged and an untagged ingredient', () => {
    // Tagging an ingredient changes its key, which is why Catalog mutations
    // have to invalidate the derived list.
    const tagged = ItemKey.fromIngredient({ item: 'Beef mince', amount: any, product_id: 'p1' });
    const untagged = ItemKey.fromIngredient({ item: 'Beef mince', amount: any });
    expect(tagged).not.toBe(untagged);
  });

  it('reports whether a key is product-backed', () => {
    expect(ItemKey.isProduct(ItemKey.fromName('onion'))).toBe(false);
    expect(ItemKey.isProduct(ItemKey.parse('product:p1'))).toBe(true);
  });

  it('extracts the product id from a product key', () => {
    expect(ItemKey.productId(ItemKey.parse('product:p1'))).toBe('p1');
    expect(ItemKey.productId(ItemKey.fromName('onion'))).toBeNull();
  });

  it('round-trips through parse', () => {
    const k = ItemKey.fromName('Beef mince');
    expect(ItemKey.parse(String(k))).toBe(k);
  });
});
