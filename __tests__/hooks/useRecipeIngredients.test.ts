import { reindexLinksOnDelete } from '../../hooks/useRecipeIngredients';

describe('reindexLinksOnDelete', () => {
  it('removes the link at the deleted index', () => {
    const updates = reindexLinksOnDelete({ 0: 'a', 1: 'b', 2: 'c' }, 1);
    expect(updates.toDelete).toEqual([1]);
    expect(updates.toShift).toEqual([{ from: 2, to: 1 }]);
  });

  it('shifts every link with index > deleted index down by one', () => {
    const updates = reindexLinksOnDelete({ 0: 'a', 1: 'b', 2: 'c', 3: 'd' }, 0);
    expect(updates.toDelete).toEqual([0]);
    expect(updates.toShift).toEqual([
      { from: 1, to: 0 },
      { from: 2, to: 1 },
      { from: 3, to: 2 },
    ]);
  });

  it('is a no-op when no link exists at deleted index and nothing follows', () => {
    const updates = reindexLinksOnDelete({ 0: 'a' }, 1);
    expect(updates.toDelete).toEqual([]);
    expect(updates.toShift).toEqual([]);
  });

  it('handles sparse link maps', () => {
    const updates = reindexLinksOnDelete({ 0: 'a', 3: 'd' }, 1);
    expect(updates.toDelete).toEqual([]);  // nothing at index 1
    expect(updates.toShift).toEqual([{ from: 3, to: 2 }]);
  });
});
