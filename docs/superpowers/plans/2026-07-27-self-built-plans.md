# Self-Built Plans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user pick recipes from their library, set how many serves to produce of each, and get a shopping list derived from `recipes.ingredients_json` that stays a live projection of those recipes.

**Architecture:** A pure derivation core (`ItemKey` → bucket → aggregate → `PlannedLine[]`) with a thin DB diff layer that reconciles those lines against `shopping_items`, protecting rows the user has checked off. `ItemKey` is a Catalog-owned value object, so Catalog mutations (merge, delete, rename) invalidate the projection alongside Planning and Recipes edits — seven trigger sites in all.

**Tech Stack:** TypeScript · React Native 0.85 / Expo SDK 56 · expo-sqlite · Jest + @testing-library/react-native

**Spec:** `docs/superpowers/specs/2026-07-27-self-built-plans-design.md`
**Vet:** `docs/vet-self-built-plans-2026-07-27.md`

---

## Conventions for this codebase

Read these before Task 1. They are not obvious from the files you'll touch.

- **No `crypto`.** Hermes has no `crypto.randomUUID` or `crypto.getRandomValues` — both throw at runtime. Use `generateId()` from `lib/uuid.ts`.
- **Icons, not emoji.** Use Ionicons from `@expo/vector-icons`; the font is already loaded in `app/_layout.tsx`.
- **Never hard-code colours, sizes or fonts.** Import from `constants/tokens.ts`. Orange is verbs and headline numbers; terracotta is labels. See `DESIGN.md`.
- **Expo has changed.** Check `https://docs.expo.dev/versions/v56.0.0/` before using an Expo API. SDK 56 differs from most examples online.
- **Test commands.** Full suite: `npm test`. Single file: `npm test -- <path>`. Typecheck: `npx tsc --noEmit`. Both must pass before every commit.
- **Migrations are forward-only**, keyed on `PRAGMA user_version`. Add a new numbered block; never edit an old one. Fresh installs get columns via `SCHEMA_SQL`, so every `ALTER` is wrapped in `try/catch` — see `lib/db/migrations.ts:120-129` for the established shape.

---

## File Structure

| File | Status | Responsibility |
| --- | --- | --- |
| `lib/catalog/normalise.ts` | create | name → normalised form |
| `lib/catalog/itemKey.ts` | create | `ItemKey` value object (Catalog-owned) |
| `lib/plan/categories.ts` | create | fixed category vocabulary, order, and mapping onto it |
| `lib/plan/aggregate.ts` | create | scale + sum amounts → `{qty, note}` |
| `lib/plan/derive.ts` | create | `(entries, lookups) → PlannedLine[]` — pure |
| `lib/plan/applyDerivation.ts` | create | diff `PlannedLine[]` against stored rows |
| `lib/db/schema.ts` | modify | new tables + columns for fresh installs |
| `lib/db/migrations.ts` | modify | v7 block |
| `types/db.ts` | modify | `PlanSource`, `RecipeSource`, `PlanRecipeRow`, row updates |
| `hooks/usePlanRecipes.ts` | create | add / remove / setServes + trigger |
| `hooks/useItemCategoryMap.ts` | create | learned category map read/write |
| `hooks/useBackup.ts` | modify | harden `insertRows`; wire new tables/columns |
| `hooks/useShoppingItems.ts` | modify | learn category on `updateItem` |
| `hooks/useRecipes.ts` | modify | trigger on `updateServings` |
| `hooks/useRecipeIngredients.ts` | modify | trigger on add/update/delete |
| `hooks/useProducts.ts` | modify | trigger on merge/delete/rename |
| `app/(tabs)/plan.tsx` | modify | branch on `plan.row.source` |
| `components/PlanRecipeList.tsx` | create | self-built plan's recipe set + serves steppers |
| `components/RecipePickerSheet.tsx` | create | pick recipes from the library |
| `components/ShoppingItem.tsx` | modify | hide `$0.00`; staleness marker |

---

## Phase 0 — Prerequisite refactor (separate `remediate` pass)

### Task 0: Extract Shopping's write surface

> **This is vet finding F4 and is NOT part of this feature.** It is existing-code cleanup, run as its own `/ddd-council remediate` pass. It **blocks Task 9** — `applyDerivation` must not become the third independent writer into `shopping_items`.
>
> Everything up to Task 8 can proceed without it.

**Why:** `shopping_items` already has two writers with their own column lists and ordering rules — `hooks/useImport.ts:98` (inline INSERT) and `hooks/useShoppingItems.ts:62` (`addItem`). `category_order` and `item_order` must agree across writers or the list sorts differently depending on how a row arrived.

**Outcome required before Task 9:** one module owning `shopping_items` inserts and the `category_order` / `item_order` rules, with Import and manual-add routed through it.

- [ ] **Step 1: Run the remediate pass**

```
/ddd-council remediate docs/vet-self-built-plans-2026-07-27.md
```

Address F4 only. Leave F1/F2/F3/F5/F6 alone — those are already amended into the spec and are implemented by Tasks 1-16 below.

- [ ] **Step 2: Confirm the seam exists**

Run: `npm test && npx tsc --noEmit`
Expected: PASS. There is now a single module that inserts `shopping_items` rows and computes ordering, and `useImport` no longer contains an inline INSERT.

---

## Phase 1 — Pure derivation core (no DB)

### Task 1: Normalise ingredient names

**Files:**
- Create: `lib/catalog/normalise.ts`
- Test: `__tests__/lib/catalog/normalise.test.ts`

Recipe ingredient names carry prep instructions and recipe-specific asides. Normalisation strips those so the same underlying item matches across recipes and against shopping history. Measured on `meal_plan.json`, it lifts category-lookup hits from 10/45 to 21/45.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/catalog/normalise.test.ts
import { normaliseItemName } from '../../../lib/catalog/normalise';

describe('normaliseItemName', () => {
  it('lowercases and trims', () => {
    expect(normaliseItemName('  Beef Mince  ')).toBe('beef mince');
  });

  it('drops parentheticals', () => {
    expect(normaliseItemName('Broccoli (for roast veg)')).toBe('broccoli');
  });

  it('takes only the text before the first comma', () => {
    expect(normaliseItemName('Baby cos lettuce, shredded')).toBe('baby cos lettuce');
  });

  it('strips punctuation and collapses whitespace', () => {
    expect(normaliseItemName('Beef chuck/gravy   beef')).toBe('beef chuck gravy beef');
  });

  it('handles a parenthetical before a comma', () => {
    expect(normaliseItemName('Chicken thigh fillets (boneless), diced'))
      .toBe('chicken thigh fillets');
  });

  it('returns an empty string for a name that is entirely punctuation', () => {
    expect(normaliseItemName('---')).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/lib/catalog/normalise.test.ts`
Expected: FAIL — `Cannot find module '../../../lib/catalog/normalise'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/catalog/normalise.ts

/**
 * Reduce an ingredient or shopping-item name to a comparable form.
 *
 * Recipe names carry prep instructions ("cubed") and recipe-specific asides
 * ("reserve ~400g for wraps"); shopping names carry buying detail ("(lean)").
 * Stripping both lets the two vocabularies meet.
 */
export function normaliseItemName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')   // drop parentheticals
    .split(',')[0]                 // prep detail follows the first comma
    .replace(/[^a-z0-9 ]/g, ' ')   // strip punctuation
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/lib/catalog/normalise.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add lib/catalog/normalise.ts __tests__/lib/catalog/normalise.test.ts
git commit -m "feat(catalog): normalise item names for cross-vocabulary matching"
```

---

### Task 2: The `ItemKey` value object

**Files:**
- Create: `lib/catalog/itemKey.ts`
- Test: `__tests__/lib/catalog/itemKey.test.ts`

Catalog owns this because the concept is *a thing you might buy* — product identity, degraded to a normalised name when the ingredient isn't tagged. Planning and Shopping both depend on it; Catalog depends on neither.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/catalog/itemKey.test.ts
import { ItemKey } from '../../../lib/catalog/itemKey';

describe('ItemKey', () => {
  it('prefers product_id when the ingredient is tagged', () => {
    const k = ItemKey.fromIngredient({ item: 'Beef mince', amount: { kind: 'note', text: 'x' }, product_id: 'p1' });
    expect(k).toBe('product:p1');
  });

  it('falls back to the normalised name when untagged', () => {
    const k = ItemKey.fromIngredient({ item: 'Beef mince (lean)', amount: { kind: 'note', text: 'x' } });
    expect(k).toBe('name:beef mince');
  });

  it('builds a name key directly', () => {
    expect(ItemKey.fromName('Baby cos lettuce, shredded')).toBe('name:baby cos lettuce');
  });

  it('two ingredients naming the same item collapse to one key', () => {
    const a = ItemKey.fromIngredient({ item: 'Broccoli (for roast veg)', amount: { kind: 'note', text: 'x' } });
    const b = ItemKey.fromIngredient({ item: 'Broccoli, florets', amount: { kind: 'note', text: 'x' } });
    expect(a).toBe(b);
  });

  it('reports whether a key is product-backed', () => {
    expect(ItemKey.isProduct(ItemKey.fromName('onion'))).toBe(false);
    expect(ItemKey.isProduct(ItemKey.parse('product:p1'))).toBe(true);
  });

  it('extracts the product id from a product key', () => {
    expect(ItemKey.productId(ItemKey.parse('product:p1'))).toBe('p1');
    expect(ItemKey.productId(ItemKey.fromName('onion'))).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/lib/catalog/itemKey.test.ts`
Expected: FAIL — `Cannot find module '../../../lib/catalog/itemKey'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/catalog/itemKey.ts
import type { Ingredient } from '../../meal_plan.types';
import { normaliseItemName } from './normalise';

/**
 * Identity of "a thing you might buy" — a Catalog product where the ingredient
 * is tagged, a normalised name where it isn't.
 *
 * Branded so it can't be confused with an arbitrary string. Catalog owns this:
 * Catalog mutations (merge, delete, rename) change what a key resolves to, so
 * Catalog is responsible for invalidating anything derived from it.
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/lib/catalog/itemKey.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add lib/catalog/itemKey.ts __tests__/lib/catalog/itemKey.test.ts
git commit -m "feat(catalog): ItemKey value object owning buy-item identity"
```

---

### Task 3: Fixed category vocabulary

**Files:**
- Create: `lib/plan/categories.ts`
- Test: `__tests__/lib/plan/categories.test.ts`

The app owns these names so the saved aisle-walking order persists. `applySavedOrder` (`app/(tabs)/shop.tsx:90`) matches category names as exact strings, and Claude emits week-specific suffixes — `Pantry (this week)` — so imported names drift every week.

`toCategory` is what stops that drift leaking into learned data (vet F2).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/plan/categories.test.ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/lib/plan/categories.test.ts`
Expected: FAIL — `Cannot find module '../../../lib/plan/categories'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/plan/categories.ts

/**
 * The app's own category vocabulary, fixed forever.
 *
 * Claude renames categories each week ("Pantry (this week)"), and
 * `useCategoryOrder.applySavedOrder` matches on exact strings — so imported
 * plans lose the saved walking order between weeks. Self-built plans use these
 * names instead, so the order sticks.
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
 * Null matters: `useShoppingItems.updateItem` is plan-agnostic, so category
 * learning also fires on imported plans. Storing a raw Claude name would feed
 * "Pantry (this week)" back into self-built plans — the exact drift the fixed
 * vocabulary exists to prevent (vet F2). Unmappable names are discarded.
 */
export function toCategory(raw: string): Category | null {
  const stripped = raw.replace(/\([^)]*\)/g, ' ').trim().replace(/\s+/g, ' ');
  const lower = stripped.toLowerCase();

  const exact = CATEGORIES.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;

  return ALIASES[lower] ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/lib/plan/categories.test.ts`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add lib/plan/categories.ts __tests__/lib/plan/categories.test.ts
git commit -m "feat(plan): fixed category vocabulary with mapping onto it"
```

---

### Task 4: Scale and aggregate amounts

**Files:**
- Create: `lib/plan/aggregate.ts`
- Test: `__tests__/lib/plan/aggregate.test.ts`

The `Amount` union is in `meal_plan.types.ts:97`:

```ts
type Amount =
  | { kind: 'measured'; value: number; unit: 'g'|'kg'|'mL'|'L'|'unit' }
  | { kind: 'custom';   value: number; unit: string }
  | { kind: 'note';     text: string };
```

Formatting reuses `formatAmount` from `lib/amount.ts` so derived lines read like the rest of the app.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/plan/aggregate.test.ts
import { scaleAmount, aggregateAmounts } from '../../../lib/plan/aggregate';
import type { Amount } from '../../../meal_plan.types';

const g = (value: number): Amount => ({ kind: 'measured', value, unit: 'g' });
const kg = (value: number): Amount => ({ kind: 'measured', value, unit: 'kg' });
const mL = (value: number): Amount => ({ kind: 'measured', value, unit: 'mL' });
const unit = (value: number): Amount => ({ kind: 'measured', value, unit: 'unit' });
const custom = (value: number, u: string): Amount => ({ kind: 'custom', value, unit: u });
const note = (text: string): Amount => ({ kind: 'note', text });

describe('scaleAmount', () => {
  it('scales a measured value', () => {
    expect(scaleAmount(g(500), 1.5)).toEqual(g(750));
  });

  it('scales a custom value', () => {
    expect(scaleAmount(custom(2, 'cloves'), 3)).toEqual(custom(6, 'cloves'));
  });

  it('passes a note through unscaled — a note cannot be multiplied', () => {
    expect(scaleAmount(note('to taste'), 4)).toEqual(note('to taste'));
  });
});

describe('aggregateAmounts', () => {
  it('sums grams', () => {
    expect(aggregateAmounts([g(300), g(450)]).qty).toBe('750 g');
  });

  it('normalises kg into the gram total', () => {
    expect(aggregateAmounts([g(300), kg(1)]).qty).toBe('1.3 kg');
  });

  it('renders as kg once the total reaches 1000 g', () => {
    expect(aggregateAmounts([g(600), g(400)]).qty).toBe('1 kg');
  });

  it('sums millilitres and renders as L past 1000', () => {
    expect(aggregateAmounts([mL(750), mL(500)]).qty).toBe('1.25 L');
  });

  it('sums counts', () => {
    expect(aggregateAmounts([unit(2), unit(3)]).qty).toBe('5');
  });

  it('sums custom units only on an exact match', () => {
    expect(aggregateAmounts([custom(2, 'cloves'), custom(3, 'cloves')]).qty).toBe('5 cloves');
  });

  it('treats differing custom units as incompatible', () => {
    expect(aggregateAmounts([custom(2, 'cloves'), custom(1, 'bunch')]).qty)
      .toBe('1 bunch + 2 cloves');
  });

  it('joins incompatible families with " + " rather than guessing', () => {
    expect(aggregateAmounts([g(150), unit(2)]).qty).toBe('150 g + 2');
  });

  it('attaches notes to the note field, not as extra lines', () => {
    const result = aggregateAmounts([mL(30), note('to drizzle')]);
    expect(result.qty).toBe('30 mL');
    expect(result.note).toBe('to drizzle');
  });

  it('uses the note text as qty when there is nothing summable', () => {
    const result = aggregateAmounts([note('to taste')]);
    expect(result.qty).toBe('to taste');
    expect(result.note).toBeNull();
  });

  it('joins multiple notes', () => {
    expect(aggregateAmounts([note('to taste'), note('optional')]).qty)
      .toBe('to taste, optional');
  });

  it('rounds away floating-point noise from scaling', () => {
    expect(aggregateAmounts([scaleAmount(g(100), 1 / 3)]).qty).toBe('33.33 g');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/lib/plan/aggregate.test.ts`
Expected: FAIL — `Cannot find module '../../../lib/plan/aggregate'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/plan/aggregate.ts
import type { Amount } from '../../meal_plan.types';
import { formatAmount } from '../amount';

export interface AggregatedAmount {
  qty: string;
  note: string | null;
}

/** Scaling a note is meaningless — "to taste" doesn't double. */
export function scaleAmount(a: Amount, factor: number): Amount {
  if (a.kind === 'note') return a;
  return { ...a, value: a.value * factor };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Sum a bucket's amounts into one displayable quantity.
 *
 * Amounts only combine within a compatible unit family. Anything left over
 * joins with " + " — "150 g + 2" for 150g of onion plus 2 onions. That reads
 * oddly, which is the point: it's visibly unresolved rather than silently wrong.
 */
export function aggregateAmounts(amounts: Amount[]): AggregatedAmount {
  let grams = 0;
  let millilitres = 0;
  let counts = 0;
  const customs = new Map<string, { unit: string; value: number }>();
  const notes: string[] = [];

  for (const a of amounts) {
    if (a.kind === 'note') {
      if (a.text.trim()) notes.push(a.text.trim());
      continue;
    }
    if (a.kind === 'custom') {
      const key = a.unit.trim().toLowerCase();
      const entry = customs.get(key);
      if (entry) entry.value += a.value;
      else customs.set(key, { unit: a.unit.trim(), value: a.value });
      continue;
    }
    switch (a.unit) {
      case 'g':    grams += a.value; break;
      case 'kg':   grams += a.value * 1000; break;
      case 'mL':   millilitres += a.value; break;
      case 'L':    millilitres += a.value * 1000; break;
      case 'unit': counts += a.value; break;
    }
  }

  const parts: string[] = [];

  if (grams > 0) {
    parts.push(grams >= 1000
      ? formatAmount({ kind: 'measured', value: round2(grams / 1000), unit: 'kg' })
      : formatAmount({ kind: 'measured', value: round2(grams), unit: 'g' }));
  }
  if (millilitres > 0) {
    parts.push(millilitres >= 1000
      ? formatAmount({ kind: 'measured', value: round2(millilitres / 1000), unit: 'L' })
      : formatAmount({ kind: 'measured', value: round2(millilitres), unit: 'mL' }));
  }
  if (counts > 0) {
    parts.push(formatAmount({ kind: 'measured', value: round2(counts), unit: 'unit' }));
  }
  for (const key of [...customs.keys()].sort()) {
    const c = customs.get(key)!;
    parts.push(formatAmount({ kind: 'custom', value: round2(c.value), unit: c.unit }));
  }

  const joinedNotes = notes.join(', ');

  // Nothing summable: the note *is* the quantity.
  if (parts.length === 0) {
    return { qty: joinedNotes, note: null };
  }
  return { qty: parts.join(' + '), note: joinedNotes || null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/lib/plan/aggregate.test.ts`
Expected: PASS, 15 tests

- [ ] **Step 5: Commit**

```bash
git add lib/plan/aggregate.ts __tests__/lib/plan/aggregate.test.ts
git commit -m "feat(plan): scale and aggregate ingredient amounts by unit family"
```

---

### Task 5: Build planned lines from recipes

**Files:**
- Create: `lib/plan/derive.ts`
- Test: `__tests__/lib/plan/derive.test.ts`

Pure: takes data, returns lines. No database, so the whole aggregation path is testable without a mock.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/plan/derive.test.ts
import { buildLines } from '../../../lib/plan/derive';
import type { PlanRecipeEntry, DeriveLookups } from '../../../lib/plan/derive';
import { ItemKey } from '../../../lib/catalog/itemKey';
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
    expect(line.qty).toBe('750 g');   // 500 × 6/4
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
      entry({ sortOrder: 1, recipe: { id: 'r2', servings: 4, ingredients: [{ item: 'Onion, red', amount: g(100) }] } }),
      entry({ sortOrder: 0, recipe: { id: 'r1', servings: 4, ingredients: [{ item: 'Onion, brown', amount: g(100) }] } }),
    ], lookups);
    // Both normalise to "onion" and both raw names are 11 chars — sortOrder 0 wins.
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
    const [line] = buildLines([entry({ targetServes: 6, recipe: { id: 'r1', servings: 0, ingredients: [{ item: 'Beef', amount: g(500) }] } })], lookups);
    expect(line.qty).toBe('500 g');   // factor forced to 1
  });

  it('clamps target serves to at least one', () => {
    const [line] = buildLines([entry({ targetServes: 0 })], lookups);
    expect(line.qty).toBe('125 g');   // 500 × 1/4
  });

  it('contributes no lines for a recipe with no ingredients', () => {
    expect(buildLines([entry({ recipe: { id: 'r1', servings: 4, ingredients: [] } })], lookups)).toEqual([]);
  });

  it('sorts lines by category order then name', () => {
    const lines = buildLines([
      entry({ recipe: { id: 'r1', servings: 4, ingredients: [
        { item: 'Zucchini', amount: g(100) },
        { item: 'Apple', amount: g(100) },
      ] } }),
    ], { ...lookups, categoryFor: (_k, name) => (name === 'Apple' ? 'Fresh Produce' : 'Meat & Poultry') });
    expect(lines.map((l) => l.name)).toEqual(['Zucchini', 'Apple']);  // Meat(0) before Produce(1)
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/lib/plan/derive.test.ts`
Expected: FAIL — `Cannot find module '../../../lib/plan/derive'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/plan/derive.ts
import type { Ingredient, Amount } from '../../meal_plan.types';
import { ItemKey } from '../catalog/itemKey';
import { scaleAmount, aggregateAmounts } from './aggregate';
import { categoryOrder, type Category } from './categories';

export interface PlanRecipeEntry {
  sortOrder: number;
  targetServes: number;
  recipe: { id: string; servings: number; ingredients: Ingredient[] };
}

export interface DeriveLookups {
  categoryFor: (key: ItemKey, name: string) => Category;
  /** `products.item_name` for a product-backed key, else null. */
  displayNameFor: (key: ItemKey) => string | null;
}

export interface PlannedLine {
  itemKey: ItemKey;
  name: string;
  qty: string;
  note: string | null;
  category: Category;
}

interface NameCandidate {
  raw: string;
  sortOrder: number;
  index: number;
}

interface Bucket {
  amounts: Amount[];
  names: NameCandidate[];
}

/**
 * Project a plan's recipes onto shopping lines.
 *
 * "Serves" here means *total serves to produce* — the opposite of the recipe
 * screen's stepper, which re-divides a fixed pot. Here the pot grows:
 * ingredients scale, per-serve macros don't.
 */
export function buildLines(
  entries: PlanRecipeEntry[],
  lookups: DeriveLookups,
): PlannedLine[] {
  const buckets = new Map<ItemKey, Bucket>();

  for (const { recipe, targetServes, sortOrder } of entries) {
    const target = Math.max(1, targetServes);
    const factor = recipe.servings > 0 ? target / recipe.servings : 1;

    recipe.ingredients.forEach((ing, index) => {
      const key = ItemKey.fromIngredient(ing);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { amounts: [], names: [] };
        buckets.set(key, bucket);
      }
      bucket.amounts.push(scaleAmount(ing.amount, factor));
      bucket.names.push({ raw: ing.item, sortOrder, index });
    });
  }

  const lines: PlannedLine[] = [];

  for (const [key, bucket] of buckets) {
    const { qty, note } = aggregateAmounts(bucket.amounts);
    lines.push({
      itemKey: key,
      name: lookups.displayNameFor(key) ?? shortestName(bucket.names),
      qty,
      note,
      category: lookups.categoryFor(key, shortestName(bucket.names)),
    });
  }

  lines.sort((a, b) =>
    categoryOrder(a.category) - categoryOrder(b.category) ||
    a.name.localeCompare(b.name));

  return lines;
}

/**
 * Shortest wins because shortest is reliably the least recipe-specific:
 * "Beef mince" over "Beef mince (lean, for ragu)". Ties break on the owning
 * recipe's position then the ingredient's index, so the chosen name is stable
 * across re-derivations rather than shuffling.
 */
function shortestName(candidates: NameCandidate[]): string {
  return [...candidates].sort((a, b) =>
    a.raw.length - b.raw.length ||
    a.sortOrder - b.sortOrder ||
    a.index - b.index)[0].raw;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/lib/plan/derive.test.ts`
Expected: PASS, 12 tests

- [ ] **Step 5: Commit**

```bash
git add lib/plan/derive.ts __tests__/lib/plan/derive.test.ts
git commit -m "feat(plan): derive shopping lines from a plan's recipes"
```

---

## Phase 2 — Schema and backup

### Task 6: Migration v7

**Files:**
- Modify: `lib/db/schema.ts`
- Modify: `lib/db/migrations.ts:140-142`
- Modify: `types/db.ts:19-42`
- Test: `__tests__/lib/db/migrations.test.ts`

Follow the existing `try/catch` ALTER shape from `migrations.ts:120-129` — fresh installs already have the columns via `SCHEMA_SQL`, so each ALTER must be a no-op when re-run.

- [ ] **Step 1: Write the failing test**

```ts
// append to __tests__/lib/db/migrations.test.ts
  it('creates plan_recipes and item_category_map for fresh installs', async () => {
    await runMigrations(mockDb as any);
    const sql: string = mockDb.execAsync.mock.calls[0][0];
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS plan_recipes');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS item_category_map');
  });

  it('v7 adds source, item_key and planned_qty to existing installs', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ user_version: 6 }]);
    await runMigrations(mockDb as any);
    const all = mockDb.execAsync.mock.calls.map((c: any[]) => c[0]).join('\n');
    expect(all).toContain('ALTER TABLE weekly_plans ADD COLUMN source');
    expect(all).toContain('ALTER TABLE shopping_items ADD COLUMN item_key');
    expect(all).toContain('ALTER TABLE shopping_items ADD COLUMN planned_qty');
    expect(all).toContain('PRAGMA user_version = 7');
  });

  it("defaults weekly_plans.source to 'imported' so existing plans stay imported", async () => {
    mockDb.getAllAsync.mockResolvedValue([{ user_version: 6 }]);
    await runMigrations(mockDb as any);
    const all = mockDb.execAsync.mock.calls.map((c: any[]) => c[0]).join('\n');
    expect(all).toMatch(/ALTER TABLE weekly_plans ADD COLUMN source TEXT NOT NULL DEFAULT 'imported'/);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/lib/db/migrations.test.ts`
Expected: FAIL — 3 new tests fail; `plan_recipes` not found in SQL

- [ ] **Step 3: Add the tables to `SCHEMA_SQL`**

Append inside the template literal in `lib/db/schema.ts`, before the closing backtick:

```sql
  CREATE TABLE IF NOT EXISTS plan_recipes (
    id            TEXT PRIMARY KEY,
    plan_id       TEXT NOT NULL REFERENCES weekly_plans(id),
    recipe_id     TEXT NOT NULL REFERENCES recipes(id),
    target_serves INTEGER NOT NULL,
    sort_order    INTEGER NOT NULL,
    UNIQUE (plan_id, recipe_id)
  );

  CREATE TABLE IF NOT EXISTS item_category_map (
    item_key   TEXT PRIMARY KEY,
    category   TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_shopping_item_key
    ON shopping_items(plan_id, item_key) WHERE item_key IS NOT NULL;
```

Also add the three columns to the existing `CREATE TABLE` statements so fresh installs match: `source TEXT NOT NULL DEFAULT 'imported'` on `weekly_plans`, and `item_key TEXT` plus `planned_qty TEXT` on `shopping_items`.

- [ ] **Step 4: Write the v7 migration block**

Replace `lib/db/migrations.ts:140-142` with:

```ts
  if (version < 6) {
    await db.execAsync('PRAGMA user_version = 6');
  }

  if (version < 7) {
    // Fresh installs already get these via SCHEMA_SQL — try/catch makes the
    // ALTERs no-ops there. `source` MUST carry a DEFAULT: restoring a 2.0
    // backup passes an explicit NULL, and only a DEFAULT saves it.
    try {
      await db.execAsync(
        "ALTER TABLE weekly_plans ADD COLUMN source TEXT NOT NULL DEFAULT 'imported'"
      );
    } catch {}
    try {
      await db.execAsync('ALTER TABLE shopping_items ADD COLUMN item_key TEXT');
    } catch {}
    try {
      await db.execAsync('ALTER TABLE shopping_items ADD COLUMN planned_qty TEXT');
    } catch {}
    await db.execAsync('PRAGMA user_version = 7');
  }
```

- [ ] **Step 5: Update the row types**

In `types/db.ts`, add above `WeeklyPlanRow`:

```ts
export type PlanSource = 'imported' | 'self_built';
export type RecipeSource = 'imported' | 'user';

export interface PlanRecipeRow {
  id: string;
  plan_id: string;
  recipe_id: string;
  target_serves: number;
  sort_order: number;
}

export interface ItemCategoryMapRow {
  item_key: string;
  category: string;
  updated_at: string;
}
```

Add `source: PlanSource;` to `WeeklyPlanRow`. Add `item_key: string | null;` and `planned_qty: string | null;` to `ShoppingItemRow`. Change `RecipeRow.source` from its inline union to `RecipeSource`.

The two named unions exist because `weekly_plans.source` and `recipes.source` share a column name but not a vocabulary — `'imported'` means the same in both while the second value differs, so a crossed literal would otherwise type-check as a bare string (vet F6).

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS. Fix any call site the new non-optional `source` field breaks.

- [ ] **Step 7: Commit**

```bash
git add lib/db/schema.ts lib/db/migrations.ts types/db.ts __tests__/lib/db/migrations.test.ts
git commit -m "feat(db): migration v7 — plan_recipes, item_category_map, plan source"
```

---

### Task 7: Backup the new tables, and harden `insertRows`

**Files:**
- Modify: `hooks/useBackup.ts`
- Test: `__tests__/hooks/useBackup.test.ts`

Each omission here is a silent data-loss bug. The `tables` delete list is the worst: without it, restoring an old backup replaces every `weekly_plans` row while leaving current `plan_recipes` rows pointing at plans that no longer exist — and FKs are off, so nothing catches it.

- [ ] **Step 1: Write the failing test**

```ts
// append to __tests__/hooks/useBackup.test.ts
describe('useBackup — v7 tables', () => {
  it('exports plan_recipes and item_category_map', async () => {
    const result = await mounted();
    await act(async () => { await result.current.shareBackup(); });
    const written = JSON.parse((mockWrite.mock.calls[0]?.[0]) ?? '{}');
    expect(written).toHaveProperty('plan_recipes');
    expect(written).toHaveProperty('item_category_map');
    expect(written.backup_version).toBe('2.1');
  });

  it('clears plan_recipes and item_category_map before restoring', async () => {
    // Guards the dangling-row trap: an old backup has no plan_recipes, so if the
    // delete list omits them, stale rows survive a restore that replaced their plans.
    const deletes = mockDb.runAsync.mock.calls
      .map((c: any[]) => String(c[0]))
      .filter((s: string) => s.startsWith('DELETE FROM'));
    expect(deletes.join('\n')).toContain('DELETE FROM plan_recipes');
    expect(deletes.join('\n')).toContain('DELETE FROM item_category_map');
  });
});

describe('insertRows hardening', () => {
  it('omits columns absent from the source row so the schema DEFAULT applies', () => {
    const [[sql, params]] = insertRows('weekly_plans', [{ id: 'p1', week_starting: '2026-07-20' }],
      ['id', 'week_starting', 'source']);
    expect(sql).not.toContain('source');
    expect(params).toEqual(['p1', '2026-07-20']);
  });

  it('keeps an explicit null for a column that is present', () => {
    const [[sql, params]] = insertRows('shopping_items', [{ id: 'i1', note: null }], ['id', 'note']);
    expect(sql).toContain('note');
    expect(params).toEqual(['i1', null]);
  });
});
```

Export `insertRows` from `hooks/useBackup.ts` so the test can reach it, and import it in the test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/hooks/useBackup.test.ts`
Expected: FAIL — `insertRows` is not exported; `plan_recipes` missing from the payload

- [ ] **Step 3: Harden `insertRows`**

Replace the function at the bottom of `hooks/useBackup.ts`:

```ts
/**
 * Build INSERTs, omitting columns the source row doesn't have.
 *
 * Old backups predate newer columns. Passing an explicit NULL for a NOT NULL
 * column only survives because `INSERT OR REPLACE` substitutes the column
 * DEFAULT — and a NOT NULL column *without* a default aborts the whole restore.
 * Omitting absent columns lets the schema DEFAULT apply directly, so future
 * column additions are backwards-compatible by construction rather than by
 * accident.
 */
export function insertRows(
  table: string,
  rows: any[],
  cols: string[],
): Array<[string, any[]]> {
  return rows.map((row) => {
    const present = cols.filter((c) => row[c] !== undefined);
    const sql = `INSERT OR REPLACE INTO ${table} (${present.join(',')}) ` +
                `VALUES (${present.map(() => '?').join(',')})`;
    return [sql, present.map((c) => row[c] ?? null)] as [string, any[]];
  });
}
```

- [ ] **Step 4: Wire the new tables through export and restore**

In `buildBackup`, add two queries to the `Promise.all` and two keys to the returned object:

```ts
        db.getAllAsync('SELECT * FROM plan_recipes'),
        db.getAllAsync('SELECT * FROM item_category_map'),
```

```ts
      backup_version: '2.1',
      ...
      plan_recipes: planRecipes,
      item_category_map: itemCategoryMap,
```

In `executeRestore`, add both to the `tables` delete list — `plan_recipes` first, since it references the others:

```ts
      const tables = [
        'plan_recipes', 'item_category_map',
        'item_aisle_map', 'store_aisles', 'shopping_items', 'purchase_history',
        'barcode_nutrition', 'barcode_stores', 'weekly_plans', 'recipes',
        'products', 'stores',
      ];
```

Add `'source'` to the `weekly_plans` column list and `'item_key'`, `'planned_qty'` to `shopping_items`, then append two `insertRows` calls **after** `weekly_plans` and `recipes` so referenced rows exist first:

```ts
        ...insertRows('plan_recipes', backup.plan_recipes ?? [],
          ['id','plan_id','recipe_id','target_serves','sort_order']),
        ...insertRows('item_category_map', backup.item_category_map ?? [],
          ['item_key','category','updated_at']),
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add hooks/useBackup.ts __tests__/hooks/useBackup.test.ts
git commit -m "feat(backup): cover v7 tables; harden insertRows against missing columns"
```

---

## Phase 3 — Persistence and triggers

### Task 8: The learned category map

**Files:**
- Create: `hooks/useItemCategoryMap.ts`
- Test: `__tests__/hooks/useItemCategoryMap.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/hooks/useItemCategoryMap.test.ts
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useItemCategoryMap } from '../../hooks/useItemCategoryMap';
import { ItemKey } from '../../lib/catalog/itemKey';

const mockDb = {
  getAllAsync: jest.fn().mockResolvedValue([]),
  runAsync: jest.fn().mockResolvedValue(undefined),
};
jest.mock('../../providers/DatabaseProvider', () => ({ useDb: () => mockDb }));

describe('useItemCategoryMap', () => {
  beforeEach(() => {
    mockDb.getAllAsync.mockReset().mockResolvedValue([]);
    mockDb.runAsync.mockReset().mockResolvedValue(undefined);
  });

  it('loads the stored map', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ item_key: 'name:beef mince', category: 'Meat & Poultry' }]);
    const { result } = renderHook(() => useItemCategoryMap());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categoryFor(ItemKey.fromName('Beef mince'), 'Beef mince')).toBe('Meat & Poultry');
  });

  it('falls back to shopping history when the key is unlearned', async () => {
    // This fallback is the 47% hit rate the spec measured — without it, every
    // item lands in Unsorted until the user has corrected it by hand once.
    mockDb.getAllAsync
      .mockResolvedValueOnce([])   // item_category_map
      .mockResolvedValueOnce([{ name: 'Beef mince (lean)', category: 'Meat & Poultry' }]);
    const { result } = renderHook(() => useItemCategoryMap());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categoryFor(ItemKey.fromName('Beef mince'), 'Beef mince'))
      .toBe('Meat & Poultry');
  });

  it('prefers a learned category over a historical match', async () => {
    mockDb.getAllAsync
      .mockResolvedValueOnce([{ item_key: 'name:beef mince', category: 'Frozen' }])
      .mockResolvedValueOnce([{ name: 'Beef mince', category: 'Meat & Poultry' }]);
    const { result } = renderHook(() => useItemCategoryMap());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categoryFor(ItemKey.fromName('Beef mince'), 'Beef mince')).toBe('Frozen');
  });

  it('discards an unmappable historical category rather than propagating drift', async () => {
    mockDb.getAllAsync
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ name: 'Beef mince', category: 'One-offs (check pantry first)' }]);
    const { result } = renderHook(() => useItemCategoryMap());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categoryFor(ItemKey.fromName('Beef mince'), 'Beef mince')).toBe('Unsorted');
  });

  it('falls back to Unsorted for an unknown key', async () => {
    const { result } = renderHook(() => useItemCategoryMap());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categoryFor(ItemKey.fromName('Nope'), 'Nope')).toBe('Unsorted');
  });

  it('learns a category, mapping it onto the fixed vocabulary first', async () => {
    const { result } = renderHook(() => useItemCategoryMap());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.learn(ItemKey.fromName('Beef mince'), 'Pantry (this week)'); });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO item_category_map'),
      ['name:beef mince', 'Pantry', expect.any(String)],
    );
  });

  it('discards a category that will not map, rather than storing Claude drift', async () => {
    const { result } = renderHook(() => useItemCategoryMap());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.learn(ItemKey.fromName('Beef'), 'One-offs (check pantry first)'); });
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/hooks/useItemCategoryMap.test.ts`
Expected: FAIL — `Cannot find module '../../hooks/useItemCategoryMap'`

- [ ] **Step 3: Write the implementation**

```ts
// hooks/useItemCategoryMap.ts
import { useCallback, useEffect, useState } from 'react';
import { useDb } from '../providers/DatabaseProvider';
import type { ItemCategoryMapRow } from '../types/db';
import type { ItemKey } from '../lib/catalog/itemKey';
import { UNSORTED, toCategory, type Category } from '../lib/plan/categories';
import { normaliseItemName } from '../lib/catalog/normalise';

export function useItemCategoryMap() {
  const db = useDb();
  const [map, setMap] = useState<Record<string, Category>>({});
  const [history, setHistory] = useState<Record<string, Category>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const rows = await db.getAllAsync<ItemCategoryMapRow>('SELECT * FROM item_category_map');
    const next: Record<string, Category> = {};
    for (const r of rows) {
      const c = toCategory(r.category);
      if (c) next[r.item_key] = c;
    }
    setMap(next);

    // Second tier: what past shopping lists called this item. Measured at 47%
    // coverage on the sample plan — the reason normalisation exists at all.
    // Names that won't map onto the fixed vocabulary are dropped, not stored.
    const past = await db.getAllAsync<{ name: string; category: string }>(
      'SELECT name, category FROM shopping_items');
    const byName: Record<string, Category> = {};
    for (const r of past) {
      const c = toCategory(r.category);
      if (c) byName[normaliseItemName(r.name)] = c;
    }
    setHistory(byName);

    setLoading(false);
  }, [db]);

  useEffect(() => { load(); }, [load]);

  /** Learned → historical → Unsorted. */
  const categoryFor = useCallback(
    (key: ItemKey, name: string): Category =>
      map[key] ?? history[normaliseItemName(name)] ?? UNSORTED,
    [map, history],
  );

  /**
   * Record a category against an item.
   *
   * The name is mapped onto the fixed vocabulary first and discarded if it
   * won't map. `useShoppingItems.updateItem` is plan-agnostic, so this also
   * fires on imported plans — storing the raw name would feed Claude's
   * "Pantry (this week)" into self-built plans (vet F2).
   */
  const learn = useCallback(async (key: ItemKey, rawCategory: string) => {
    const category = toCategory(rawCategory);
    if (!category) return;
    await db.runAsync(
      'INSERT OR REPLACE INTO item_category_map (item_key, category, updated_at) VALUES (?, ?, ?)',
      [key, category, new Date().toISOString()],
    );
    setMap((prev) => ({ ...prev, [key]: category }));
  }, [db]);

  return { categoryFor, learn, loading, reload: load };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/hooks/useItemCategoryMap.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add hooks/useItemCategoryMap.ts __tests__/hooks/useItemCategoryMap.test.ts
git commit -m "feat(plan): learned item-to-category map, gated on the fixed vocabulary"
```

---

### Task 9: Apply the derivation — the diff

> **Blocked by Task 0.** Route inserts through Shopping's extracted write surface rather than adding a third independent writer.

**Files:**
- Create: `lib/plan/applyDerivation.ts`
- Test: `__tests__/lib/plan/applyDerivation.test.ts`

One test per row of the diff table, plus the merge-behind-a-checked-line case the vet asked for.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/plan/applyDerivation.test.ts
import { applyDerivation } from '../../../lib/plan/applyDerivation';
import type { PlannedLine } from '../../../lib/plan/derive';
import { ItemKey } from '../../../lib/catalog/itemKey';

function line(over: Partial<PlannedLine> = {}): PlannedLine {
  return {
    itemKey: ItemKey.fromName('Beef mince'),
    name: 'Beef mince', qty: '750 g', note: null, category: 'Meat & Poultry',
    ...over,
  };
}

function stored(over: Record<string, unknown> = {}) {
  return {
    id: 'i1', plan_id: 'p1', item_key: 'name:beef mince',
    name: 'Beef mince', qty: '500 g', planned_qty: '500 g',
    category: 'Meat & Poultry', category_order: 0, item_order: 0,
    estimated_price: 0, is_oneoff: 0, note: null, is_checked: 0,
    ...over,
  };
}

const mockDb = { getAllAsync: jest.fn(), runAsync: jest.fn().mockResolvedValue(undefined) };

describe('applyDerivation', () => {
  beforeEach(() => {
    mockDb.getAllAsync.mockReset().mockResolvedValue([]);
    mockDb.runAsync.mockReset().mockResolvedValue(undefined);
  });

  it('inserts a line that has no stored row', async () => {
    await applyDerivation(mockDb as any, 'p1', [line()]);
    const inserts = mockDb.runAsync.mock.calls.filter((c) => String(c[0]).includes('INSERT'));
    expect(inserts).toHaveLength(1);
  });

  it('updates an unchecked planned row', async () => {
    mockDb.getAllAsync.mockResolvedValue([stored()]);
    await applyDerivation(mockDb as any, 'p1', [line()]);
    const update = mockDb.runAsync.mock.calls.find((c) => String(c[0]).includes('UPDATE'));
    expect(update?.[1]).toEqual(expect.arrayContaining(['750 g', '750 g', 'i1']));
  });

  it('updates only planned_qty on a checked row, leaving qty stale', async () => {
    mockDb.getAllAsync.mockResolvedValue([stored({ is_checked: 1 })]);
    await applyDerivation(mockDb as any, 'p1', [line()]);
    const update = mockDb.runAsync.mock.calls.find((c) => String(c[0]).includes('UPDATE'));
    expect(String(update?.[0])).toContain('planned_qty');
    expect(String(update?.[0])).not.toMatch(/\bqty = \?/);
  });

  it('deletes an unchecked planned row that left the projection', async () => {
    mockDb.getAllAsync.mockResolvedValue([stored()]);
    await applyDerivation(mockDb as any, 'p1', []);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'DELETE FROM shopping_items WHERE id = ?', ['i1']);
  });

  it('keeps a checked row that left the projection — it was bought', async () => {
    mockDb.getAllAsync.mockResolvedValue([stored({ is_checked: 1 })]);
    await applyDerivation(mockDb as any, 'p1', []);
    const deletes = mockDb.runAsync.mock.calls.filter((c) => String(c[0]).includes('DELETE'));
    expect(deletes).toHaveLength(0);
  });

  it('never touches a manual row', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);   // query filters item_key IS NOT NULL
    await applyDerivation(mockDb as any, 'p1', []);
    const query = String(mockDb.getAllAsync.mock.calls[0][0]);
    expect(query).toContain('item_key IS NOT NULL');
  });

  it('does not duplicate a line when a product merges behind a checked row', async () => {
    // The checked row is keyed product:A. Catalog merged A into B, so the
    // projection now emits product:B for the same item (vet F1).
    mockDb.getAllAsync.mockResolvedValue([stored({ item_key: 'product:A', is_checked: 1 })]);
    await applyDerivation(mockDb as any, 'p1', [line({ itemKey: ItemKey.parse('product:B') })]);
    const inserts = mockDb.runAsync.mock.calls.filter((c) => String(c[0]).includes('INSERT'));
    const deletes = mockDb.runAsync.mock.calls.filter((c) => String(c[0]).includes('DELETE'));
    // The bought row is retired rather than left to shadow the new key.
    expect(inserts).toHaveLength(1);
    expect(deletes).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/lib/plan/applyDerivation.test.ts`
Expected: FAIL — `Cannot find module '../../../lib/plan/applyDerivation'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/plan/applyDerivation.ts
import type { SQLiteDatabase } from 'expo-sqlite';
import type { ShoppingItemRow } from '../../types/db';
import { generateId } from '../uuid';
import { categoryOrder } from './categories';
import type { PlannedLine } from './derive';

/**
 * Reconcile the projection against stored rows.
 *
 * Rows the user has checked off are settled — their `qty` is never rewritten.
 * `planned_qty` still tracks what the recipes now call for, so
 * `item_key IS NOT NULL AND qty IS NOT planned_qty` marks a line that has
 * drifted from its recipe. Manual rows (`item_key IS NULL`) are untouched.
 */
export async function applyDerivation(
  db: SQLiteDatabase,
  planId: string,
  lines: PlannedLine[],
): Promise<void> {
  const storedRows = await db.getAllAsync<ShoppingItemRow>(
    'SELECT * FROM shopping_items WHERE plan_id = ? AND item_key IS NOT NULL',
    [planId],
  );
  const stored = new Map(storedRows.map((r) => [r.item_key as string, r]));
  const wanted = new Set(lines.map((l) => l.itemKey as string));

  for (const [index, l] of lines.entries()) {
    const row = stored.get(l.itemKey as string);

    if (!row) {
      await db.runAsync(
        `INSERT INTO shopping_items
           (id, plan_id, category, category_order, item_order, name, qty,
            estimated_price, is_oneoff, note, is_checked, item_key, planned_qty)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 0, ?, ?)`,
        [generateId(), planId, l.category, categoryOrder(l.category), index,
         l.name, l.qty, l.note, l.itemKey, l.qty],
      );
      continue;
    }

    if (row.is_checked === 1) {
      // Settled. Track what the plan now wants, but leave the line alone.
      await db.runAsync(
        'UPDATE shopping_items SET planned_qty = ? WHERE id = ?',
        [l.qty, row.id],
      );
      continue;
    }

    await db.runAsync(
      `UPDATE shopping_items
         SET name = ?, qty = ?, planned_qty = ?, category = ?, category_order = ?, note = ?
       WHERE id = ?`,
      [l.name, l.qty, l.qty, l.category, categoryOrder(l.category), l.note, row.id],
    );
  }

  for (const row of storedRows) {
    if (wanted.has(row.item_key as string)) continue;
    // An unchecked row that left the projection is simply gone. A checked row
    // was bought — but if its key was merged away by Catalog, leaving it would
    // shadow the new key with a permanent duplicate (vet F1), so retire it too.
    await db.runAsync('DELETE FROM shopping_items WHERE id = ?', [row.id]);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/lib/plan/applyDerivation.test.ts`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add lib/plan/applyDerivation.ts __tests__/lib/plan/applyDerivation.test.ts
git commit -m "feat(plan): reconcile derived lines against stored shopping items"
```

---

### Task 10: `usePlanRecipes` and the derivation entry point

**Files:**
- Create: `hooks/usePlanRecipes.ts`
- Test: `__tests__/hooks/usePlanRecipes.test.ts`

This hook owns the plan's recipe set and exposes `derivePlanList`, the single entry point every trigger site calls.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/hooks/usePlanRecipes.test.ts
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { usePlanRecipes } from '../../hooks/usePlanRecipes';

const mockDb = {
  getAllAsync: jest.fn().mockResolvedValue([]),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  runAsync: jest.fn().mockResolvedValue(undefined),
};
const mockBump = jest.fn();
jest.mock('../../providers/DatabaseProvider', () => ({
  useDb: () => mockDb,
  usePlanVersion: () => ({ planVersion: 0, bumpPlanVersion: mockBump }),
}));

describe('usePlanRecipes', () => {
  beforeEach(() => {
    mockDb.getAllAsync.mockReset().mockResolvedValue([]);
    mockDb.runAsync.mockReset().mockResolvedValue(undefined);
    mockBump.mockReset();
  });

  it('adds a recipe with its own servings as the default target', async () => {
    const { result } = renderHook(() => usePlanRecipes('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.addRecipe('r1', 4); });
    const insert = mockDb.runAsync.mock.calls.find((c) => String(c[0]).includes('INSERT INTO plan_recipes'));
    expect(insert?.[1]).toEqual(expect.arrayContaining(['p1', 'r1', 4]));
  });

  it('clamps target serves to at least one', async () => {
    const { result } = renderHook(() => usePlanRecipes('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.setServes('r1', 0); });
    const update = mockDb.runAsync.mock.calls.find((c) => String(c[0]).includes('UPDATE plan_recipes'));
    expect(update?.[1][0]).toBe(1);
  });

  it('removes a recipe from the plan', async () => {
    const { result } = renderHook(() => usePlanRecipes('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.removeRecipe('r1'); });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'DELETE FROM plan_recipes WHERE plan_id = ? AND recipe_id = ?', ['p1', 'r1']);
  });

  it('skips a dangling plan_recipes row whose recipe was deleted', async () => {
    // FKs are not enforced, so a deleted recipe leaves the join row behind.
    mockDb.getAllAsync
      .mockResolvedValueOnce([{ id: 'pr1', plan_id: 'p1', recipe_id: 'gone', target_serves: 4, sort_order: 0 }])
      .mockResolvedValueOnce([]);   // no matching recipes
    const { result } = renderHook(() => usePlanRecipes('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.derivePlanList(); });
    expect(mockBump).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/hooks/usePlanRecipes.test.ts`
Expected: FAIL — `Cannot find module '../../hooks/usePlanRecipes'`

- [ ] **Step 3: Write the single derivation implementation**

This is the *only* implementation. `usePlanRecipes` delegates to it, and every
trigger site in Task 11 calls it. An earlier draft of this plan had two copies —
they drifted on the category-history tier, so the same item could land in
different categories depending on which path ran.

```ts
// lib/plan/reDeriveActivePlan.ts
import type { SQLiteDatabase } from 'expo-sqlite';
import type { PlanRecipeRow, RecipeRow, WeeklyPlanRow } from '../../types/db';
import type { Ingredient } from '../../meal_plan.types';
import { buildLines, type PlanRecipeEntry } from './derive';
import { applyDerivation } from './applyDerivation';
import { ItemKey } from '../catalog/itemKey';
import { normaliseItemName } from '../catalog/normalise';
import { UNSORTED, toCategory, type Category } from './categories';

/**
 * Re-derive the active plan's shopping list, if it is self-built.
 *
 * Called from every mutation that can invalidate the projection — including
 * Catalog's merge, delete and rename, which change what an ItemKey resolves to
 * (vet F1). A no-op for imported plans.
 */
export async function reDeriveActivePlan(db: SQLiteDatabase): Promise<void> {
  const plan = await db.getFirstAsync<WeeklyPlanRow>(
    'SELECT * FROM weekly_plans WHERE is_active = 1 LIMIT 1');
  if (!plan || plan.source !== 'self_built') return;

  const planRecipes = await db.getAllAsync<PlanRecipeRow>(
    'SELECT * FROM plan_recipes WHERE plan_id = ? ORDER BY sort_order', [plan.id]);

  // One query, not one per recipe. Guard the empty case: `IN ()` is a syntax
  // error, and an empty plan is normal — you just removed the last recipe.
  const ids = planRecipes.map((pr) => pr.recipe_id);
  const recipes = ids.length
    ? await db.getAllAsync<RecipeRow>(
        `SELECT * FROM recipes WHERE id IN (${ids.map(() => '?').join(',')})`, ids)
    : [];
  const recipeById = new Map(recipes.map((r) => [r.id, r]));

  const entries: PlanRecipeEntry[] = [];
  for (const pr of planRecipes) {
    const recipe = recipeById.get(pr.recipe_id);
    // FKs are not enforced — a deleted recipe leaves the join row behind.
    if (!recipe) continue;
    entries.push({
      sortOrder: pr.sort_order,
      targetServes: pr.target_serves,
      recipe: {
        id: recipe.id,
        servings: recipe.servings,
        ingredients: JSON.parse(recipe.ingredients_json) as Ingredient[],
      },
    });
  }

  const learned = await db.getAllAsync<{ item_key: string; category: string }>(
    'SELECT item_key, category FROM item_category_map');
  const byKey = new Map<string, Category>();
  for (const r of learned) {
    const c = toCategory(r.category);
    if (c) byKey.set(r.item_key, c);
  }

  // One row per distinct name, most recent wins. Unbounded otherwise — this
  // would scan every shopping item from every plan ever, on every derivation.
  const past = await db.getAllAsync<{ name: string; category: string }>(
    `SELECT name, category FROM shopping_items
      WHERE rowid IN (SELECT MAX(rowid) FROM shopping_items GROUP BY name)`);
  const byName = new Map<string, Category>();
  for (const r of past) {
    const c = toCategory(r.category);
    if (c) byName.set(normaliseItemName(r.name), c);
  }

  const products = await db.getAllAsync<{ id: string; item_name: string }>(
    'SELECT id, item_name FROM products');
  const nameById = new Map(products.map((p) => [p.id, p.item_name]));

  const lines = buildLines(entries, {
    // Learned, then history, then Unsorted.
    categoryFor: (key, name) =>
      byKey.get(key) ?? byName.get(normaliseItemName(name)) ?? UNSORTED,
    displayNameFor: (key) => {
      const id = ItemKey.productId(key);
      return id ? (nameById.get(id) ?? null) : null;
    },
  });

  await applyDerivation(db, plan.id, lines);
}
```

- [ ] **Step 4: Write the hook**

```ts
// hooks/usePlanRecipes.ts
import { useCallback, useEffect, useState } from 'react';
import { useDb, usePlanVersion } from '../providers/DatabaseProvider';
import { generateId } from '../lib/uuid';
import type { PlanRecipeRow } from '../types/db';
import { reDeriveActivePlan } from '../lib/plan/reDeriveActivePlan';

export function usePlanRecipes(planId: string | null) {
  const db = useDb();
  const { bumpPlanVersion } = usePlanVersion();
  const [rows, setRows] = useState<PlanRecipeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!planId) { setRows([]); setLoading(false); return; }
    setRows(await db.getAllAsync<PlanRecipeRow>(
      'SELECT * FROM plan_recipes WHERE plan_id = ? ORDER BY sort_order', [planId]));
    setLoading(false);
  }, [planId, db]);

  useEffect(() => { load(); }, [load]);

  /** Delegates — there is one derivation implementation, not two. */
  const derivePlanList = useCallback(async () => {
    await reDeriveActivePlan(db);
    bumpPlanVersion();
  }, [db, bumpPlanVersion]);

  const addRecipe = useCallback(async (recipeId: string, targetServes: number) => {
    if (!planId) return;
    const sortOrder = rows.length > 0 ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 0;
    await db.runAsync(
      `INSERT OR REPLACE INTO plan_recipes (id, plan_id, recipe_id, target_serves, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [generateId(), planId, recipeId, Math.max(1, Math.round(targetServes)), sortOrder]);
    await load();
    await derivePlanList();
  }, [planId, rows, db, load, derivePlanList]);

  const setServes = useCallback(async (recipeId: string, targetServes: number) => {
    if (!planId) return;
    await db.runAsync(
      'UPDATE plan_recipes SET target_serves = ? WHERE plan_id = ? AND recipe_id = ?',
      [Math.max(1, Math.round(targetServes)), planId, recipeId]);
    await load();
    await derivePlanList();
  }, [planId, db, load, derivePlanList]);

  const removeRecipe = useCallback(async (recipeId: string) => {
    if (!planId) return;
    await db.runAsync(
      'DELETE FROM plan_recipes WHERE plan_id = ? AND recipe_id = ?', [planId, recipeId]);
    await load();
    await derivePlanList();
  }, [planId, db, load, derivePlanList]);

  return { rows, loading, addRecipe, setServes, removeRecipe, derivePlanList, reload: load };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- __tests__/hooks/usePlanRecipes.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 6: Commit**

```bash
git add lib/plan/reDeriveActivePlan.ts hooks/usePlanRecipes.ts __tests__/hooks/usePlanRecipes.test.ts
git commit -m "feat(plan): usePlanRecipes owns the recipe set and derivation entry point"
```

---

### Task 11: Wire the remaining trigger sites

**Files:**
- Modify: `hooks/useRecipes.ts` (`updateServings`)
- Modify: `hooks/useRecipeIngredients.ts` (add/update/delete)
- Modify: `hooks/useProducts.ts` (`mergeProduct`, `deleteProduct`, rename)
- Test: `__tests__/hooks/derivationTriggers.test.ts`

A missed trigger is this design's stated risk, so every site gets a test. Sites 1 and 4 are already covered by Task 10; this task covers 2, 3, 5, 6 and 7.

Rather than importing `usePlanRecipes` into six hooks, add a shared helper `lib/plan/reDeriveActivePlan.ts` that looks up the active self-built plan and re-derives it. Hooks call that.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/hooks/derivationTriggers.test.ts
import { reDeriveActivePlan } from '../../lib/plan/reDeriveActivePlan';

const mockDb = {
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn().mockResolvedValue([]),
  runAsync: jest.fn().mockResolvedValue(undefined),
};

describe('reDeriveActivePlan', () => {
  beforeEach(() => {
    mockDb.getFirstAsync.mockReset();
    mockDb.getAllAsync.mockReset().mockResolvedValue([]);
    mockDb.runAsync.mockReset().mockResolvedValue(undefined);
  });

  it('does nothing when there is no active plan', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);
    await reDeriveActivePlan(mockDb as any);
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it('does nothing when the active plan is imported', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ id: 'p1', source: 'imported' });
    await reDeriveActivePlan(mockDb as any);
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it('re-derives when the active plan is self-built', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ id: 'p1', source: 'self_built' });
    await reDeriveActivePlan(mockDb as any);
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('FROM plan_recipes'), ['p1']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/hooks/derivationTriggers.test.ts`
Expected: FAIL — `Cannot find module '../../lib/plan/reDeriveActivePlan'`

- [ ] **Step 3: Confirm the helper exists**

`lib/plan/reDeriveActivePlan.ts` was created in Task 10 — it is the single
derivation implementation. This task only adds call sites. Skip to Step 4.

<details><summary>Reference: the helper written in Task 10</summary>

```ts
// lib/plan/reDeriveActivePlan.ts
import type { SQLiteDatabase } from 'expo-sqlite';
import type { PlanRecipeRow, RecipeRow, WeeklyPlanRow } from '../../types/db';
import type { Ingredient } from '../../meal_plan.types';
import { buildLines, type PlanRecipeEntry } from './derive';
import { applyDerivation } from './applyDerivation';
import { ItemKey } from '../catalog/itemKey';
import { UNSORTED, toCategory, type Category } from './categories';
import { normaliseItemName } from '../catalog/normalise';

/**
 * Re-derive the active plan's shopping list, if it is self-built.
 *
 * Called from every mutation that can invalidate the projection — including
 * Catalog's merge, delete and rename, which change what an ItemKey resolves to
 * (vet F1). A no-op for imported plans.
 */
export async function reDeriveActivePlan(db: SQLiteDatabase): Promise<void> {
  const plan = await db.getFirstAsync<WeeklyPlanRow>(
    'SELECT * FROM weekly_plans WHERE is_active = 1 LIMIT 1');
  if (!plan || plan.source !== 'self_built') return;

  const planRecipes = await db.getAllAsync<PlanRecipeRow>(
    'SELECT * FROM plan_recipes WHERE plan_id = ? ORDER BY sort_order', [plan.id]);

  const entries: PlanRecipeEntry[] = [];
  for (const pr of planRecipes) {
    const recipe = await db.getFirstAsync<RecipeRow>(
      'SELECT * FROM recipes WHERE id = ?', [pr.recipe_id]);
    if (!recipe) continue;
    entries.push({
      sortOrder: pr.sort_order,
      targetServes: pr.target_serves,
      recipe: {
        id: recipe.id,
        servings: recipe.servings,
        ingredients: JSON.parse(recipe.ingredients_json) as Ingredient[],
      },
    });
  }

  const learned = await db.getAllAsync<{ item_key: string; category: string }>(
    'SELECT item_key, category FROM item_category_map');
  const byKey = new Map<string, Category>();
  for (const r of learned) {
    const c = toCategory(r.category);
    if (c) byKey.set(r.item_key, c);
  }

  const products = await db.getAllAsync<{ id: string; item_name: string }>(
    'SELECT id, item_name FROM products');
  const nameById = new Map(products.map((p) => [p.id, p.item_name]));

  const past = await db.getAllAsync<{ name: string; category: string }>(
    'SELECT name, category FROM shopping_items');
  const byName = new Map<string, Category>();
  for (const r of past) {
    const c = toCategory(r.category);
    if (c) byName.set(normaliseItemName(r.name), c);
  }

  const lines = buildLines(entries, {
    // Same two tiers as useItemCategoryMap: learned, then history, then Unsorted.
    categoryFor: (key, name) => byKey.get(key) ?? byName.get(normaliseItemName(name)) ?? UNSORTED,
    displayNameFor: (key) => {
      const id = ItemKey.productId(key);
      return id ? (nameById.get(id) ?? null) : null;
    },
  });

  await applyDerivation(db, plan.id, lines);
}
```

</details>

- [ ] **Step 4: Call it from the five remaining sites**

In `hooks/useRecipes.ts`, inside `updateServings`, after the UPDATE and before `bumpPlanVersion()`:

```ts
    await reDeriveActivePlan(db);
```

In `hooks/useRecipeIngredients.ts`, add the same line at the end of each of `addIngredient`, `updateIngredient` and `deleteIngredient`, before their cache invalidation.

In `hooks/useProducts.ts`, add it after the `COMMIT` in both `mergeProduct` and `deleteProduct`, and after the rename UPDATE. Merge and delete rewrite `product_id` inside `recipes.ingredients_json` (`:179-197` and `:107-120`); rename changes `products.item_name`, which is the display name for product-keyed buckets.

Import in each file:

```ts
import { reDeriveActivePlan } from '../lib/plan/reDeriveActivePlan';
```

- [ ] **Step 5: Add a test per site**

```ts
// append to __tests__/hooks/derivationTriggers.test.ts
jest.mock('../../lib/plan/reDeriveActivePlan', () => ({
  reDeriveActivePlan: jest.fn().mockResolvedValue(undefined),
}));

import { reDeriveActivePlan as mockReDerive } from '../../lib/plan/reDeriveActivePlan';
import { useRecipes } from '../../hooks/useRecipes';
import { useProducts } from '../../hooks/useProducts';
import { renderHook, act, waitFor } from '@testing-library/react-native';

describe('trigger sites', () => {
  beforeEach(() => (mockReDerive as jest.Mock).mockClear());

  it('useRecipes.updateServings re-derives', async () => {
    const { result } = renderHook(() => useRecipes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.updateServings('r1', 6); });
    expect(mockReDerive).toHaveBeenCalled();
  });

  it('useProducts.mergeProduct re-derives', async () => {
    const { result } = renderHook(() => useProducts());
    await act(async () => { await result.current.mergeProduct('a', 'b'); });
    expect(mockReDerive).toHaveBeenCalled();
  });

  it('useProducts.deleteProduct re-derives', async () => {
    const { result } = renderHook(() => useProducts());
    await act(async () => { await result.current.deleteProduct('a'); });
    expect(mockReDerive).toHaveBeenCalled();
  });
});
```

Add equivalent cases for `useRecipeIngredients`' three methods and the Catalog rename, following the same shape. Each needs the DB mocks that hook already expects — copy them from that hook's existing test file.

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add hooks/useRecipes.ts hooks/useRecipeIngredients.ts hooks/useProducts.ts __tests__/hooks/derivationTriggers.test.ts
git commit -m "feat(plan): re-derive on all seven trigger sites, Catalog included"
```

---

### Task 12: Learn categories from `updateItem`

**Files:**
- Modify: `hooks/useShoppingItems.ts:78-131`
- Test: `__tests__/hooks/useShoppingItems.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// append to __tests__/hooks/useShoppingItems.test.ts
describe('useShoppingItems category learning', () => {
  it('learns the mapped category when an item is recategorised', async () => {
    mockDb.getAllAsync.mockResolvedValue([{
      id: 'i1', plan_id: 'p1', category: 'Unsorted', category_order: 7, item_order: 0,
      name: 'Beef mince', qty: '750 g', estimated_price: 0, is_oneoff: 0,
      note: null, is_checked: 0, item_key: 'name:beef mince', planned_qty: '750 g',
    }]);
    const { result } = renderHook(() => useShoppingItems('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateItem('i1', {
        name: 'Beef mince', qty: '750 g', estimatedPrice: 0,
        category: 'Meat & Poultry', note: null,
      });
    });

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO item_category_map'),
      ['name:beef mince', 'Meat & Poultry', expect.any(String)],
    );
  });

  it('does not learn when the category is unchanged', async () => {
    mockDb.getAllAsync.mockResolvedValue([{
      id: 'i1', plan_id: 'p1', category: 'Meat & Poultry', category_order: 0, item_order: 0,
      name: 'Beef mince', qty: '750 g', estimated_price: 0, is_oneoff: 0,
      note: null, is_checked: 0, item_key: 'name:beef mince', planned_qty: '750 g',
    }]);
    const { result } = renderHook(() => useShoppingItems('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateItem('i1', {
        name: 'Beef mince', qty: '750 g', estimatedPrice: 0,
        category: 'Meat & Poultry', note: null,
      });
    });

    const learns = mockDb.runAsync.mock.calls.filter((c) =>
      String(c[0]).includes('item_category_map'));
    expect(learns).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/hooks/useShoppingItems.test.ts`
Expected: FAIL — no `item_category_map` insert

- [ ] **Step 3: Write the implementation**

At the end of `updateItem` in `hooks/useShoppingItems.ts`, after the existing `setItems(...)` call:

```ts
    // Learn the placement. The name is mapped onto the fixed vocabulary and
    // dropped if it won't map — this fires on imported plans too, and storing
    // Claude's "Pantry (this week)" would feed that drift into self-built
    // plans (vet F2).
    if (data.category !== existing.category) {
      const key = existing.item_key
        ? ItemKey.parse(existing.item_key)
        : ItemKey.fromName(existing.name);
      const category = toCategory(data.category);
      if (category) {
        await db.runAsync(
          'INSERT OR REPLACE INTO item_category_map (item_key, category, updated_at) VALUES (?, ?, ?)',
          [key, category, new Date().toISOString()],
        );
      }
    }
```

Add the imports:

```ts
import { ItemKey } from '../lib/catalog/itemKey';
import { toCategory } from '../lib/plan/categories';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/hooks/useShoppingItems.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add hooks/useShoppingItems.ts __tests__/hooks/useShoppingItems.test.ts
git commit -m "feat(shopping): learn item categories, mapped onto the fixed vocabulary"
```

---

## Phase 4 — Surfaces

### Task 13: Create a self-built plan

**Files:**
- Modify: `hooks/usePlan.ts`
- Test: `__tests__/hooks/usePlan.test.ts`

`usePlan` runs `JSON.parse` on all four JSON columns unconditionally and they are `NOT NULL`, so a self-built plan must write **valid JSON, not empty strings**.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/hooks/usePlan.test.ts (create if absent — mock useDb/usePlanVersion as in useRecipes.test.ts)
  it('creates a self-built plan with valid JSON in every column', async () => {
    const { result } = renderHook(() => usePlan());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.createSelfBuiltPlan('2026-08-03'); });

    const insert = mockDb.runAsync.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO weekly_plans'));
    const params = insert![1] as string[];
    // meta, strategy, days, batch_plan must all parse — an empty string throws on load.
    for (const p of params.filter((x) => typeof x === 'string' && (x.startsWith('{') || x.startsWith('[')))) {
      expect(() => JSON.parse(p)).not.toThrow();
    }
    expect(params).toContain('self_built');
  });

  it('deactivates the previous plan when a self-built plan is created', async () => {
    const { result } = renderHook(() => usePlan());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.createSelfBuiltPlan('2026-08-03'); });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'UPDATE weekly_plans SET is_active = 0 WHERE is_active = 1');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/hooks/usePlan.test.ts`
Expected: FAIL — `createSelfBuiltPlan is not a function`

- [ ] **Step 3: Write the implementation**

Add to `hooks/usePlan.ts`, and return it from the hook:

```ts
  /**
   * Every JSON column is NOT NULL and `refresh` parses all four unconditionally,
   * so a self-built plan writes valid empty structures rather than ''.
   */
  async function createSelfBuiltPlan(weekStarting: string): Promise<string> {
    const id = generateId();
    const meta = {
      title: 'My plan', week_starting: weekStarting, currency: 'AUD',
      store: '', region: '', weekly_budget: 0,
      cooking_style: 'self-built', dinners_per_batch: 0, notes: '',
    };
    const strategy = { breakfast: '', lunch: '', dinner: '', snacks: '', weekend: '', drinks: '' };

    await db.runAsync('UPDATE weekly_plans SET is_active = 0 WHERE is_active = 1');
    await db.runAsync(
      `INSERT INTO weekly_plans
         (id, week_starting, is_active, meta_json, strategy_json,
          days_json, batch_plan_json, created_at, source)
       VALUES (?, ?, 1, ?, ?, '[]', '[]', ?, 'self_built')`,
      [id, weekStarting, JSON.stringify(meta), JSON.stringify(strategy),
       new Date().toISOString()],
    );
    bumpPlanVersion();
    return id;
  }
```

Import `generateId` from `../lib/uuid` and pull `bumpPlanVersion` from `usePlanVersion()`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add hooks/usePlan.ts __tests__/hooks/usePlan.test.ts
git commit -m "feat(plan): create a self-built plan with valid empty JSON columns"
```

---

### Task 14: The recipe picker

**Files:**
- Create: `components/RecipePickerSheet.tsx`
- Test: `__tests__/components/RecipePickerSheet.test.tsx`

Follow the bottom-sheet pattern in `components/AddItemSheet.tsx`. **Use `height: '80%'` on the sheet, not an absolute height** — `KeyboardAvoidingView behavior="padding"` shrinks the container and an absolute height overflows off the top.

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/components/RecipePickerSheet.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RecipePickerSheet } from '../../components/RecipePickerSheet';

const RECIPES = [
  { id: 'r1', title: 'Beef Ragu', meal_type: 'dinner', servings: 4 },
  { id: 'r2', title: 'Overnight Oats', meal_type: 'breakfast', servings: 2 },
] as any;

function renderSheet(props = {}) {
  return render(
    <RecipePickerSheet visible recipes={RECIPES} alreadyInPlan={[]}
      onPick={jest.fn()} onClose={jest.fn()} {...props} />
  );
}

describe('RecipePickerSheet', () => {
  it('lists recipes grouped by meal type', () => {
    const { getByText } = renderSheet();
    expect(getByText('Beef Ragu')).toBeTruthy();
    expect(getByText('Overnight Oats')).toBeTruthy();
  });

  it('picks a recipe with its own servings as the default target', () => {
    const onPick = jest.fn();
    const { getByText } = renderSheet({ onPick });
    fireEvent.press(getByText('Beef Ragu'));
    expect(onPick).toHaveBeenCalledWith('r1', 4);
  });

  it('marks recipes already in the plan and does not re-pick them', () => {
    const onPick = jest.fn();
    const { getByText } = renderSheet({ onPick, alreadyInPlan: ['r1'] });
    fireEvent.press(getByText('Beef Ragu'));
    expect(onPick).not.toHaveBeenCalled();
  });

  it('shows an empty state when the library is empty', () => {
    const { getByText } = renderSheet({ recipes: [] });
    expect(getByText(/No recipes yet/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/components/RecipePickerSheet.test.tsx`
Expected: FAIL — `Cannot find module '../../components/RecipePickerSheet'`

- [ ] **Step 3: Write the component**

```tsx
// components/RecipePickerSheet.tsx — core structure
const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export function RecipePickerSheet({ visible, recipes, alreadyInPlan, onPick, onClose }: Props) {
  const grouped = MEAL_ORDER
    .map((m) => ({ meal: m, items: recipes.filter((r) => r.meal_type === m) }))
    .filter((g) => g.items.length > 0);

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent
           onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {/* Percentage height, never absolute: KeyboardAvoidingView's padding
            shrinks the container and an absolute height spills off the top. */}
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <AppText weight="extrabold" size="xl" color="textPrimary">Add a recipe</AppText>

          {recipes.length === 0 ? (
            <AppText weight="regular" size="md" color="textTertiary">
              No recipes yet — import a plan first.
            </AppText>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {grouped.map(({ meal, items }) => (
                <View key={meal}>
                  <CategoryHeader label={meal} isOneoff={false} />
                  {items.map((r) => {
                    const inPlan = alreadyInPlan.includes(r.id);
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={[styles.row, inPlan && styles.rowInPlan]}
                        disabled={inPlan}
                        onPress={() => onPick(r.id, r.servings)}
                        accessibilityRole="button"
                        accessibilityLabel={`${r.title}, serves ${r.servings}`}
                      >
                        <AppText weight="semibold" size="md" color="textPrimary">{r.title}</AppText>
                        {inPlan
                          ? <Ionicons name="checkmark" size={18} color={colors.green} />
                          : <AppText weight="regular" size="sm" color="textTertiary">
                              {`Serves ${r.servings}`}
                            </AppText>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: {
    height: '80%', backgroundColor: colors.cream,
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing[5], paddingBottom: spacing[6], gap: spacing[2],
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.divider,
    alignSelf: 'center', marginTop: spacing[2], marginBottom: spacing[1],
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 44, paddingVertical: spacing[2],
  },
  rowInPlan: { opacity: 0.45 },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/components/RecipePickerSheet.test.tsx`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add components/RecipePickerSheet.tsx __tests__/components/RecipePickerSheet.test.tsx
git commit -m "feat(plan): recipe picker sheet for building a plan"
```

---

### Task 15: The Plan tab's self-built view

**Files:**
- Create: `components/PlanRecipeList.tsx`
- Modify: `app/(tabs)/plan.tsx`
- Test: `__tests__/components/PlanRecipeList.test.tsx`, `__tests__/screens/plan.test.tsx`

The planner's stepper says **"Make N serves"**, never "Serves" — the recipe screen's stepper re-divides a fixed pot while this one scales the pot. Opposite behaviour, so they must not share a label or a component.

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/components/PlanRecipeList.test.tsx
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { PlanRecipeList } from '../../components/PlanRecipeList';

const ENTRIES = [
  { recipeId: 'r1', title: 'Beef Ragu', recipeServings: 4, targetServes: 6 },
];

function renderList(props = {}) {
  return render(
    <PlanRecipeList entries={ENTRIES} onSetServes={jest.fn()}
      onRemove={jest.fn()} onAdd={jest.fn()} {...props} />
  );
}

describe('PlanRecipeList', () => {
  it('labels the control "Make N serves", distinct from the recipe stepper', () => {
    const { getByLabelText } = renderList();
    expect(getByLabelText('Make 6 serves of Beef Ragu')).toBeTruthy();
  });

  it('shows the scale factor against the recipe as written', () => {
    const { getByText } = renderList();
    expect(getByText(/recipe serves 4/i)).toBeTruthy();
    expect(getByText(/1\.5/)).toBeTruthy();
  });

  it('shows the new value immediately but does not commit yet', () => {
    jest.useFakeTimers();
    const onSetServes = jest.fn();
    const { getByLabelText } = renderList({ onSetServes });
    fireEvent.press(getByLabelText('Increase serves for Beef Ragu'));
    expect(getByLabelText('Make 7 serves of Beef Ragu')).toBeTruthy();
    expect(onSetServes).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('commits once the taps settle', () => {
    jest.useFakeTimers();
    const onSetServes = jest.fn();
    const { getByLabelText } = renderList({ onSetServes });
    fireEvent.press(getByLabelText('Increase serves for Beef Ragu'));
    act(() => { jest.advanceTimersByTime(400); });
    expect(onSetServes).toHaveBeenCalledWith('r1', 7);
    jest.useRealTimers();
  });

  it('commits once for a burst of taps, not once per tap', () => {
    // Each commit is a full read-compute-diff-write cycle; five taps must not
    // mean five derivations.
    jest.useFakeTimers();
    const onSetServes = jest.fn();
    const { getByLabelText } = renderList({ onSetServes });
    for (let i = 0; i < 5; i++) {
      fireEvent.press(getByLabelText('Increase serves for Beef Ragu'));
    }
    act(() => { jest.advanceTimersByTime(400); });
    expect(onSetServes).toHaveBeenCalledTimes(1);
    expect(onSetServes).toHaveBeenCalledWith('r1', 11);
    jest.useRealTimers();
  });

  it('will not go below one serve', () => {
    jest.useFakeTimers();
    const onSetServes = jest.fn();
    const { getByLabelText } = renderList({
      entries: [{ ...ENTRIES[0], targetServes: 1 }], onSetServes });
    fireEvent.press(getByLabelText('Decrease serves for Beef Ragu'));
    act(() => { jest.advanceTimersByTime(400); });
    expect(onSetServes).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('removes a recipe from the plan', () => {
    const onRemove = jest.fn();
    const { getByLabelText } = renderList({ onRemove });
    fireEvent.press(getByLabelText('Remove Beef Ragu from plan'));
    expect(onRemove).toHaveBeenCalledWith('r1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/components/PlanRecipeList.test.tsx`
Expected: FAIL — `Cannot find module '../../components/PlanRecipeList'`

- [ ] **Step 3: Write the component**

```tsx
// components/PlanRecipeList.tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AppText } from './ui/AppText';
import { colors, radius, spacing } from '../constants/tokens';

export interface PlanRecipeEntryView {
  recipeId: string;
  title: string;
  recipeServings: number;
  targetServes: number;
}

interface Props {
  entries: PlanRecipeEntryView[];
  onSetServes: (recipeId: string, next: number) => void;
  onRemove: (recipeId: string) => void;
  onAdd: () => void;
}

const MIN_SERVES = 1;
const COMMIT_DELAY_MS = 400;

export function PlanRecipeList({ entries, onSetServes, onRemove, onAdd }: Props) {
  // Every commit runs a full read-compute-diff-write cycle. A stepper is built
  // to be tapped repeatedly, so hold the value locally and commit once the taps
  // settle — the same shape as ServesSheet, where edits are local until Done.
  const [pending, setPending] = useState<Record<string, number>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => () => {
    for (const t of Object.values(timers.current)) clearTimeout(t);
  }, []);

  function step(recipeId: string, from: number, delta: number) {
    const next = Math.max(MIN_SERVES, from + delta);
    if (next === from) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPending((p) => ({ ...p, [recipeId]: next }));
    clearTimeout(timers.current[recipeId]);
    timers.current[recipeId] = setTimeout(() => {
      onSetServes(recipeId, next);
      setPending((p) => {
        const { [recipeId]: _drop, ...rest } = p;
        return rest;
      });
    }, COMMIT_DELAY_MS);
  }

  return (
    <View style={styles.wrap}>
      {entries.map((entry) => {
        // Local value wins while taps are settling.
        const e = { ...entry, targetServes: pending[entry.recipeId] ?? entry.targetServes };
        // Scaling the pot up, not re-dividing it — the opposite of the recipe
        // screen's stepper. Hence "Make N serves", never "Serves".
        const factor = e.recipeServings > 0
          ? Math.round((e.targetServes / e.recipeServings) * 100) / 100
          : 1;
        return (
          <View key={e.recipeId} style={styles.card}>
            <View style={styles.titleRow}>
              <AppText weight="bold" size="lg" color="textPrimary" style={styles.title}>
                {e.title}
              </AppText>
              <TouchableOpacity
                onPress={() => onRemove(e.recipeId)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${e.title} from plan`}
              >
                <Ionicons name="close" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <View style={styles.stepper}>
              <AppText weight="semibold" size="sm" color="textSecondary">Make</AppText>
              <TouchableOpacity
                style={styles.stepBtn}
                disabled={e.targetServes <= MIN_SERVES}
                onPress={() => step(e.recipeId, e.targetServes, -1)}
                accessibilityRole="button"
                accessibilityLabel={`Decrease serves for ${e.title}`}
              >
                <Ionicons name="remove" size={18}
                  color={e.targetServes <= MIN_SERVES ? colors.textTertiary : colors.green} />
              </TouchableOpacity>

              <View accessible accessibilityLabel={`Make ${e.targetServes} serves of ${e.title}`}>
                <AppText weight="extrabold" size="xl" color="textPrimary">
                  {String(e.targetServes)}
                </AppText>
              </View>

              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => step(e.recipeId, e.targetServes, 1)}
                accessibilityRole="button"
                accessibilityLabel={`Increase serves for ${e.title}`}
              >
                <Ionicons name="add" size={18} color={colors.green} />
              </TouchableOpacity>
              <AppText weight="semibold" size="sm" color="textSecondary">serves</AppText>
            </View>

            <AppText weight="regular" size="2xs" color="textTertiary">
              {`recipe serves ${e.recipeServings} · ×${factor}`}
            </AppText>
          </View>
        );
      })}

      <TouchableOpacity
        style={styles.addBtn}
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel="Add a recipe"
      >
        <Ionicons name="add" size={16} color={colors.green} />
        <AppText weight="bold" size="sm" color="green">Add a recipe</AppText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[3], paddingHorizontal: spacing[4] },
  card: {
    backgroundColor: colors.card, borderRadius: radius.md,
    padding: spacing[4], gap: spacing[2],
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1, paddingRight: spacing[2] },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  stepBtn: {
    width: 44, height: 44, borderRadius: radius.full,
    backgroundColor: colors.cream, borderWidth: 1.5, borderColor: colors.divider,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[1], minHeight: 44, borderRadius: radius.xl,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.divider,
  },
});
```

- [ ] **Step 4: Branch the Plan tab**

In `app/(tabs)/plan.tsx`, branch after the `!plan` check:

```tsx
  if (plan.row.source === 'self_built') {
    return <SelfBuiltPlanView plan={plan} />;
  }
```

Leave the existing day-grid path untouched for imported plans. `SelfBuiltPlanView` wires `usePlanRecipes` and `useRecipes` to `PlanRecipeList` and `RecipePickerSheet`, and shows a footer summary: total target serves and shopping-line count.

Dangling `plan_recipes` rows — a recipe deleted while in the plan — are skipped by derivation but still listed here. Render them as `Recipe no longer exists` with the remove button active, so the user can clear them.

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/PlanRecipeList.tsx "app/(tabs)/plan.tsx" __tests__/components/PlanRecipeList.test.tsx __tests__/screens/plan.test.tsx
git commit -m "feat(plan): self-built plan view with Make-N-serves steppers"
```

---

### Task 16: Build-a-plan entry point, price guard, staleness marker

**Files:**
- Modify: `app/(tabs)/plan.tsx` (empty state)
- Modify: `components/ShoppingItem.tsx:44-47`
- Test: `__tests__/components/ShoppingItem.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// append to __tests__/components/ShoppingItem.test.tsx
  it('hides the price when it is zero rather than showing $0.00', () => {
    const { queryByText } = render(
      <ShoppingItem item={{ ...ITEM, estimated_price: 0 }} onToggle={jest.fn()} />
    );
    expect(queryByText('$0.00')).toBeNull();
  });

  it('still shows a real price', () => {
    const { getByText } = render(
      <ShoppingItem item={{ ...ITEM, estimated_price: 4.5 }} onToggle={jest.fn()} />
    );
    expect(getByText('$4.50')).toBeTruthy();
  });

  it('marks a checked line whose recipe has moved on', () => {
    const { getByLabelText } = render(
      <ShoppingItem
        item={{ ...ITEM, is_checked: 1, item_key: 'name:beef', qty: '500 g', planned_qty: '750 g' }}
        onToggle={jest.fn()} />
    );
    expect(getByLabelText(/recipe now calls for 750 g/i)).toBeTruthy();
  });

  it('does not mark a manual row as stale', () => {
    // Manual rows have planned_qty null; comparing qty to null must not flag them.
    const { queryByLabelText } = render(
      <ShoppingItem item={{ ...ITEM, item_key: null, planned_qty: null }} onToggle={jest.fn()} />
    );
    expect(queryByLabelText(/recipe now calls for/i)).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/components/ShoppingItem.test.tsx`
Expected: FAIL — `$0.00` still rendered

- [ ] **Step 3: Write the implementation**

In `components/ShoppingItem.tsx`, replace the unconditional price with a guard, and add the marker:

```tsx
          <View style={styles.detail}>
            <AppText weight="regular" color="textSecondary" size="sm">
              {item.estimated_price > 0 ? `${item.qty} ·` : item.qty}
            </AppText>
            {item.estimated_price > 0 && (
              <AppText weight="semibold" color="orange" size="sm">
                {formatPrice(item.estimated_price)}
              </AppText>
            )}
          </View>
          {item.item_key !== null && item.planned_qty !== null && item.qty !== item.planned_qty && (
            <AppText
              weight="regular" size="2xs" color="textNote"
              accessibilityLabel={`recipe now calls for ${item.planned_qty}`}
            >
              {`recipe now calls for ${item.planned_qty}`}
            </AppText>
          )}
```

The `item_key !== null` guard is required, not decorative: manual rows have `planned_qty = null` and a non-null `qty`, so comparing the two alone would flag every hand-added item as stale.

In `app/(tabs)/plan.tsx`, add a **Build a plan** button beside the existing Import action in the no-plan empty state, calling `createSelfBuiltPlan(<this Sunday's ISO date>)`. If a plan is already active and has checked items, confirm first with `Alert.alert` — activating a self-built plan deactivates the current one and orphans its list.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/ShoppingItem.tsx "app/(tabs)/plan.tsx" __tests__/components/ShoppingItem.test.tsx
git commit -m "feat(shop): hide zero prices, mark lines that drifted from their recipe"
```

---

## Final verification

- [ ] **Run the full suite and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, no TypeScript errors.

- [ ] **Verify on a device**

Keyboard behaviour, the folder picker and SQLite migrations are not exercised by the test suite. Check: v6 → v7 migration on an existing install leaves plans marked `imported`; build a plan and confirm the list derives; check a line, change the recipe, confirm the line is marked rather than rewritten; merge two products behind a checked line and confirm no duplicate appears.

- [ ] **Update the roadmap**

Strike ⭐ item 1 in `/Users/tim/assistant/Efforts/meal-planner/ROADMAP.md` and note that `plan_recipes` now unblocks item 2.
