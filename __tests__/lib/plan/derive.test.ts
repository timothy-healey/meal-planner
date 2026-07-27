import { buildLines } from '../../../lib/plan/derive';
import type { PlanRecipeEntry, DeriveLookups } from '../../../lib/plan/derive';
import type { Amount } from '../../../meal_plan.types';

const g = (value: number): Amount => ({ kind: 'measured', value, unit: 'g' });

const lookups: DeriveLookups = {
  categoryFor: () => 'Unsorted',
  displayNameFor: () => null,
};

function entry(over: Partial<PlanRecipeEntry> = {}): PlanRecipeEntry {
  return {
    sortOrder: 0,
    targetServes: 4,
    recipe: { id: 'r1', servings: 4, ingredients: [{ item: 'Beef mince', amount: g(500) }] },
    ...over,
  };
}

describe('buildLines', () => {
  it('passes ingredients through unscaled when target equals recipe servings', () => {
    const [line] = buildLines([entry()], lookups);
    expect(line.qty).toBe('500 g');
  });

  it('scales up when the target exceeds recipe servings', () => {
    const [line] = buildLines([entry({ targetServes: 6 })], lookups);
    expect(line.qty).toBe('750 g');
  });

  it('scales down when the target is below recipe servings', () => {
    const [line] = buildLines([entry({ targetServes: 2 })], lookups);
    expect(line.qty).toBe('250 g');
  });

  it('merges the same product across two recipes into one line', () => {
    const lines = buildLines([
      entry({ recipe: { id: 'r1', servings: 4, ingredients: [{ item: 'Mince', amount: g(500), product_id: 'p1' }] } }),
      entry({ sortOrder: 1, recipe: { id: 'r2', servings: 4, ingredients: [{ item: 'Beef mince lean', amount: g(300), product_id: 'p1' }] } }),
    ], lookups);
    expect(lines).toHaveLength(1);
    expect(lines[0].qty).toBe('800 g');
    expect(lines[0].itemKey).toBe('product:p1');
  });

  it('uses the shortest raw name for a name-keyed bucket', () => {
    const lines = buildLines([
      entry({ recipe: { id: 'r1', servings: 4, ingredients: [{ item: 'Beef mince (lean, for ragu)', amount: g(500) }] } }),
      entry({ sortOrder: 1, recipe: { id: 'r2', servings: 4, ingredients: [{ item: 'Beef mince', amount: g(300) }] } }),
    ], lookups);
    expect(lines[0].name).toBe('Beef mince');
  });

  it('breaks name ties deterministically on sort order then index', () => {
    const lines = buildLines([
      entry({ sortOrder: 1, recipe: { id: 'r2', servings: 4, ingredients: [{ item: 'Onion, red__', amount: g(100) }] } }),
      entry({ sortOrder: 0, recipe: { id: 'r1', servings: 4, ingredients: [{ item: 'Onion, brown', amount: g(100) }] } }),
    ], lookups);
    expect(lines[0].name).toBe('Onion, brown');
  });

  it('prefers the curated product name when one exists', () => {
    const lines = buildLines(
      [entry({ recipe: { id: 'r1', servings: 4, ingredients: [{ item: 'Mince', amount: g(500), product_id: 'p1' }] } })],
      { ...lookups, displayNameFor: (k) => (k === 'product:p1' ? 'Beef mince' : null) },
    );
    expect(lines[0].name).toBe('Beef mince');
  });

  it('applies the category lookup', () => {
    const lines = buildLines([entry()], { ...lookups, categoryFor: () => 'Meat & Poultry' });
    expect(lines[0].category).toBe('Meat & Poultry');
  });

  it('guards against a recipe with zero servings rather than dividing by zero', () => {
    const [line] = buildLines([entry({
      targetServes: 6,
      recipe: { id: 'r1', servings: 0, ingredients: [{ item: 'Beef', amount: g(500) }] },
    })], lookups);
    expect(line.qty).toBe('500 g');
  });

  it('clamps target serves to at least one', () => {
    const [line] = buildLines([entry({ targetServes: 0 })], lookups);
    expect(line.qty).toBe('125 g');
  });

  it('contributes no lines for a recipe with no ingredients', () => {
    expect(buildLines([entry({ recipe: { id: 'r1', servings: 4, ingredients: [] } })], lookups))
      .toEqual([]);
  });

  it('returns nothing for an empty plan', () => {
    expect(buildLines([], lookups)).toEqual([]);
  });

  it('sorts lines by category order then name', () => {
    const lines = buildLines([
      entry({ recipe: { id: 'r1', servings: 4, ingredients: [
        { item: 'Zucchini', amount: g(100) },
        { item: 'Apple', amount: g(100) },
      ] } }),
    ], { ...lookups, categoryFor: (_k, name) => (name === 'Apple' ? 'Fresh Produce' : 'Meat & Poultry') });
    expect(lines.map((l) => l.name)).toEqual(['Zucchini', 'Apple']);
  });

  it('carries a note amount through to the line note', () => {
    const lines = buildLines([entry({ recipe: { id: 'r1', servings: 4, ingredients: [
      { item: 'Olive oil', amount: { kind: 'measured', value: 30, unit: 'mL' } },
      { item: 'Olive oil', amount: { kind: 'note', text: 'to drizzle' } },
    ] } })], lookups);
    expect(lines).toHaveLength(1);
    expect(lines[0].qty).toBe('30 mL');
    expect(lines[0].note).toBe('to drizzle');
  });
});
