# Edit Ingredients Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user edit, add, and delete ingredients on any recipe so the saved recipe reflects what was actually used — including fixing unit/basis mismatches that silently zero out macros.

**Architecture:** Replace freeform `amount: string` with a tagged `Amount` union (`measured` / `custom` / `note`). The macro rollup dispatches on `Amount.kind` instead of string-parsing. The existing `FoodNutritionSheet` is renamed `IngredientSheet` and gains editable name + amount + unit fields plus a trash button; a new "+ Add ingredient" row sits at the bottom of the ingredients card. The plan JSON schema bumps to v1.2 so newly-generated plans emit the structured shape directly; legacy v1.1 string amounts are coerced at the import boundary.

**Tech Stack:** React Native (Expo 56), expo-sqlite, expo-router, @expo/vector-icons (Ionicons), Jest + @testing-library/react-native.

**Spec:** [docs/superpowers/specs/2026-05-27-edit-ingredients-design.md](../specs/2026-05-27-edit-ingredients-design.md)

---

## File overview

**Modify**

- `meal_plan.types.ts` — replace `Ingredient.amount: string` with `Amount` union; add `Unit` and `Amount` types
- `lib/rollupMacros.ts` — dispatch on `Amount.kind` instead of `parseAmount`
- `lib/import/transform.ts` — coerce legacy string amounts at import
- `regenerate/meal_plan.schema.json` — bump schema_version to 1.2, change `amount` to a oneOf
- `regenerate/HOW_TO_REGENERATE.md` — update the units paragraph and add examples
- `components/IngredientRow.tsx` — render amount via `formatAmount`
- `app/recipe/[id].tsx` — wire add/edit/delete handlers, AddIngredientRow, link re-indexing
- `__tests__/lib/rollupMacros.test.ts` — update fixtures to structured Amount
- `__tests__/lib/import/transform.test.ts` — assert both v1.1 string and v1.2 object inputs are accepted
- `__tests__/components/IngredientRow.test.tsx` — update fixtures to structured Amount

**Create**

- `lib/amount.ts` — `parseAmountString`, `formatAmount`, `amountToBasis`, `amountMultiplier`
- `__tests__/lib/amount.test.ts` — comprehensive tests for the new helpers
- `components/AddIngredientRow.tsx` — the "+ Add ingredient" row at the bottom of the ingredients card
- `hooks/useRecipeIngredients.ts` — add/update/delete operations on `recipes.ingredients_json` with link re-indexing
- `__tests__/hooks/useRecipeIngredients.test.ts` — covers re-indexing semantics on delete

**Rename**

- `components/FoodNutritionSheet.tsx` → `components/IngredientSheet.tsx`
- `__tests__/components/FoodNutritionSheet.test.tsx` → `__tests__/components/IngredientSheet.test.tsx`

**Delete**

- `lib/parseAmount.ts` — superseded by `lib/amount.ts:parseAmountString`
- `__tests__/lib/parseAmount.test.ts` — superseded by `__tests__/lib/amount.test.ts`

---

## Task 1: Add `Amount` types to `meal_plan.types.ts`

**Files:**
- Modify: `meal_plan.types.ts:95-98`

- [ ] **Step 1: Add the `Unit` and `Amount` types and update `Ingredient`**

Open `meal_plan.types.ts` and replace the `Ingredient` interface (currently `lines 95–98`) with:

```ts
export type Unit = 'g' | 'kg' | 'mL' | 'L' | 'unit';

export type Amount =
  | { kind: 'measured'; value: number; unit: Unit }
  | { kind: 'custom';   value: number; unit: string }
  | { kind: 'note';     text: string };

export interface Ingredient {
  item: string;
  amount: Amount;
}
```

- [ ] **Step 2: Run the type checker — expect failures**

Run: `npx tsc --noEmit`
Expected: errors in `lib/rollupMacros.ts`, `lib/import/transform.ts`, `components/FoodNutritionSheet.tsx`, `components/IngredientRow.tsx`, and several test files. These are intentional — the next tasks fix each consumer.

- [ ] **Step 3: Do NOT commit yet**

This change leaves the build red. Leave it staged; the next task makes the build green again before committing.

---

## Task 2: Create `lib/amount.ts` with helpers + tests

**Files:**
- Create: `lib/amount.ts`
- Create: `__tests__/lib/amount.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `__tests__/lib/amount.test.ts`:

```ts
import {
  parseAmountString,
  formatAmount,
  amountToBasis,
  amountMultiplier,
} from '../../lib/amount';

describe('parseAmountString', () => {
  it('parses grams', () => {
    expect(parseAmountString('200g')).toEqual({ kind: 'measured', value: 200, unit: 'g' });
    expect(parseAmountString('200 g')).toEqual({ kind: 'measured', value: 200, unit: 'g' });
    expect(parseAmountString('1.5g')).toEqual({ kind: 'measured', value: 1.5, unit: 'g' });
  });

  it('parses kg and L verbatim (no conversion)', () => {
    expect(parseAmountString('1.5kg')).toEqual({ kind: 'measured', value: 1.5, unit: 'kg' });
    expect(parseAmountString('1 L')).toEqual({ kind: 'measured', value: 1, unit: 'L' });
  });

  it('parses mL', () => {
    expect(parseAmountString('250mL')).toEqual({ kind: 'measured', value: 250, unit: 'mL' });
    expect(parseAmountString('250 ml')).toEqual({ kind: 'measured', value: 250, unit: 'mL' });
  });

  it('converts oz/lb to grams (legacy import only)', () => {
    expect(parseAmountString('1 oz')).toEqual({ kind: 'measured', value: 28.35, unit: 'g' });
    expect(parseAmountString('1 lb')).toEqual({ kind: 'measured', value: 453.6, unit: 'g' });
    expect(parseAmountString('2 lbs')).toEqual({ kind: 'measured', value: 907.2, unit: 'g' });
  });

  it('converts cup/tbsp/tsp to mL (legacy import only)', () => {
    expect(parseAmountString('1 cup')).toEqual({ kind: 'measured', value: 240, unit: 'mL' });
    expect(parseAmountString('1 tbsp')).toEqual({ kind: 'measured', value: 15, unit: 'mL' });
    expect(parseAmountString('2 tsp')).toEqual({ kind: 'measured', value: 10, unit: 'mL' });
  });

  it('parses fractions and mixed numbers', () => {
    expect(parseAmountString('1/2 cup')).toEqual({ kind: 'measured', value: 120, unit: 'mL' });
    expect(parseAmountString('1 1/2 cups')).toEqual({ kind: 'measured', value: 360, unit: 'mL' });
  });

  it('treats numeric-only as measured unit', () => {
    expect(parseAmountString('3')).toEqual({ kind: 'measured', value: 3, unit: 'unit' });
  });

  it('treats number + unknown words as custom', () => {
    expect(parseAmountString('3 cloves garlic')).toEqual({ kind: 'custom', value: 3, unit: 'cloves garlic' });
    expect(parseAmountString('2 slices')).toEqual({ kind: 'custom', value: 2, unit: 'slices' });
  });

  it('treats non-numeric strings as notes', () => {
    expect(parseAmountString('to taste')).toEqual({ kind: 'note', text: 'to taste' });
    expect(parseAmountString('a pinch')).toEqual({ kind: 'note', text: 'a pinch' });
    expect(parseAmountString('')).toEqual({ kind: 'note', text: '' });
  });
});

describe('formatAmount', () => {
  it('formats measured with unit', () => {
    expect(formatAmount({ kind: 'measured', value: 200, unit: 'g' })).toBe('200 g');
    expect(formatAmount({ kind: 'measured', value: 1.5, unit: 'kg' })).toBe('1.5 kg');
  });

  it('formats measured "unit" without a unit suffix', () => {
    expect(formatAmount({ kind: 'measured', value: 2, unit: 'unit' })).toBe('2');
  });

  it('formats custom with the freeform unit', () => {
    expect(formatAmount({ kind: 'custom', value: 3, unit: 'cloves' })).toBe('3 cloves');
  });

  it('formats note as the bare text', () => {
    expect(formatAmount({ kind: 'note', text: 'to taste' })).toBe('to taste');
  });

  it('drops trailing zeros from decimals', () => {
    expect(formatAmount({ kind: 'measured', value: 1.5, unit: 'kg' })).toBe('1.5 kg');
    expect(formatAmount({ kind: 'measured', value: 28.35, unit: 'g' })).toBe('28.35 g');
  });
});

describe('amountToBasis', () => {
  it('maps weight units to per_100g', () => {
    expect(amountToBasis({ kind: 'measured', value: 200, unit: 'g' })).toBe('per_100g');
    expect(amountToBasis({ kind: 'measured', value: 1, unit: 'kg' })).toBe('per_100g');
  });

  it('maps volume units to per_100mL', () => {
    expect(amountToBasis({ kind: 'measured', value: 250, unit: 'mL' })).toBe('per_100mL');
    expect(amountToBasis({ kind: 'measured', value: 1, unit: 'L' })).toBe('per_100mL');
  });

  it('maps count, custom, and note to per_unit', () => {
    expect(amountToBasis({ kind: 'measured', value: 3, unit: 'unit' })).toBe('per_unit');
    expect(amountToBasis({ kind: 'custom', value: 3, unit: 'cloves' })).toBe('per_unit');
    expect(amountToBasis({ kind: 'note', text: 'to taste' })).toBe('per_unit');
  });
});

describe('amountMultiplier', () => {
  it('per_100g: g / 100', () => {
    expect(amountMultiplier({ kind: 'measured', value: 200, unit: 'g' }, 'per_100g')).toBe(2);
  });

  it('per_100g: kg * 1000 / 100', () => {
    expect(amountMultiplier({ kind: 'measured', value: 1.5, unit: 'kg' }, 'per_100g')).toBe(15);
  });

  it('per_100mL: mL / 100', () => {
    expect(amountMultiplier({ kind: 'measured', value: 250, unit: 'mL' }, 'per_100mL')).toBe(2.5);
  });

  it('per_100mL: L * 1000 / 100', () => {
    expect(amountMultiplier({ kind: 'measured', value: 1, unit: 'L' }, 'per_100mL')).toBe(10);
  });

  it('per_unit: value for measured unit', () => {
    expect(amountMultiplier({ kind: 'measured', value: 2, unit: 'unit' }, 'per_unit')).toBe(2);
  });

  it('per_unit: value for custom (the unit string is display-only)', () => {
    expect(amountMultiplier({ kind: 'custom', value: 3, unit: 'cloves' }, 'per_unit')).toBe(3);
  });

  it('returns 0 on basis-unit mismatch', () => {
    expect(amountMultiplier({ kind: 'measured', value: 50, unit: 'mL' }, 'per_100g')).toBe(0);
    expect(amountMultiplier({ kind: 'measured', value: 200, unit: 'g' }, 'per_100mL')).toBe(0);
    expect(amountMultiplier({ kind: 'custom', value: 3, unit: 'cloves' }, 'per_100g')).toBe(0);
  });

  it('returns 0 for note', () => {
    expect(amountMultiplier({ kind: 'note', text: 'to taste' }, 'per_100g')).toBe(0);
    expect(amountMultiplier({ kind: 'note', text: 'to taste' }, 'per_unit')).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests — confirm they fail**

Run: `npm test -- amount.test.ts`
Expected: FAIL — `lib/amount` does not exist.

- [ ] **Step 3: Create `lib/amount.ts`**

```ts
import type { Amount, Unit } from '../meal_plan.types';

type Basis = 'per_100g' | 'per_100mL' | 'per_unit';

function parseLeadingNumber(s: string): { value: number; rest: string } | null {
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)(.*)/);
  if (mixed) {
    const den = parseInt(mixed[3]);
    if (den === 0) return null;
    return { value: parseInt(mixed[1]) + parseInt(mixed[2]) / den, rest: mixed[4].trim() };
  }
  const fraction = s.match(/^(\d+)\/(\d+)(.*)/);
  if (fraction) {
    const den = parseInt(fraction[2]);
    if (den === 0) return null;
    return { value: parseInt(fraction[1]) / den, rest: fraction[3].trim() };
  }
  const decimal = s.match(/^([\d.]+)(.*)/);
  if (decimal) {
    const value = parseFloat(decimal[1]);
    if (isNaN(value)) return null;
    return { value, rest: decimal[2].trim() };
  }
  return null;
}

export function parseAmountString(input: string): Amount {
  const trimmed = input.trim();
  if (!trimmed) return { kind: 'note', text: input };

  const leading = parseLeadingNumber(trimmed.toLowerCase());
  if (!leading) return { kind: 'note', text: input };

  const { value, rest } = leading;
  if (!rest) return { kind: 'measured', value, unit: 'unit' };

  const unit = rest.split(/\s/)[0];

  if (unit === 'g')  return { kind: 'measured', value, unit: 'g' };
  if (unit === 'kg') return { kind: 'measured', value, unit: 'kg' };
  if (unit === 'oz') return { kind: 'measured', value: round2(value * 28.35), unit: 'g' };
  if (unit === 'lb' || unit === 'lbs') return { kind: 'measured', value: round2(value * 453.6), unit: 'g' };

  if (unit === 'ml') return { kind: 'measured', value, unit: 'mL' };
  if (unit === 'l')  return { kind: 'measured', value, unit: 'L' };
  if (unit === 'cup' || unit === 'cups') return { kind: 'measured', value: value * 240, unit: 'mL' };
  if (unit === 'tbsp') return { kind: 'measured', value: value * 15, unit: 'mL' };
  if (unit === 'tsp')  return { kind: 'measured', value: value * 5,  unit: 'mL' };

  // Number + unknown word(s) → custom
  return { kind: 'custom', value, unit: rest };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatAmount(amount: Amount): string {
  if (amount.kind === 'note') return amount.text;
  const value = formatValue(amount.value);
  if (amount.kind === 'measured' && amount.unit === 'unit') return value;
  return `${value} ${amount.unit}`;
}

function formatValue(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return String(Number(v.toFixed(2)));
}

export function amountToBasis(amount: Amount): Basis {
  if (amount.kind === 'measured') {
    if (amount.unit === 'g' || amount.unit === 'kg') return 'per_100g';
    if (amount.unit === 'mL' || amount.unit === 'L') return 'per_100mL';
  }
  return 'per_unit';
}

export function amountMultiplier(amount: Amount, basis: Basis): number {
  if (amount.kind === 'note') return 0;
  if (amount.kind === 'custom') {
    return basis === 'per_unit' ? amount.value : 0;
  }
  // measured
  if (basis === 'per_100g') {
    if (amount.unit === 'g')  return amount.value / 100;
    if (amount.unit === 'kg') return (amount.value * 1000) / 100;
    return 0;
  }
  if (basis === 'per_100mL') {
    if (amount.unit === 'mL') return amount.value / 100;
    if (amount.unit === 'L')  return (amount.value * 1000) / 100;
    return 0;
  }
  // per_unit
  return amount.unit === 'unit' ? amount.value : 0;
}

export type { Amount, Unit };
```

- [ ] **Step 4: Run the tests — confirm they pass**

Run: `npm test -- amount.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add meal_plan.types.ts lib/amount.ts __tests__/lib/amount.test.ts
git commit -m "feat(amount): introduce structured Amount type with parse/format/basis/multiplier helpers"
```

Build is still red (rollup + import + components + tests on old shape). Next tasks fix each consumer.

---

## Task 3: Refactor `rollupMacros` to dispatch on `Amount.kind`

**Files:**
- Modify: `lib/rollupMacros.ts:1-75`
- Modify: `__tests__/lib/rollupMacros.test.ts`

- [ ] **Step 1: Update the test fixtures to use structured amounts**

Replace the `TWO_INGREDIENTS` fixture and any string `amount` usages in `__tests__/lib/rollupMacros.test.ts`. Full replacement for the file:

```ts
import { rollupMacros } from '../../lib/rollupMacros';
import type { FoodNutritionRow } from '../../types/db';
import type { Ingredient } from '../../meal_plan.types';

function makeEntry(overrides: Partial<FoodNutritionRow> = {}): FoodNutritionRow {
  return {
    id: 'test-id',
    item_name: 'chicken breast',
    brand: null,
    product_name: null,
    basis: 'per_100g',
    cal_per_basis: 165,
    protein_per_basis: 31,
    carbs_per_basis: 0,
    fat_per_basis: 3.6,
    updated_at: '2026-05-24T00:00:00.000Z',
    ...overrides,
  };
}

const TWO_INGREDIENTS: Ingredient[] = [
  { item: 'chicken breast', amount: { kind: 'measured', value: 200, unit: 'g' } },
  { item: 'brown rice',     amount: { kind: 'measured', value: 150, unit: 'g' } },
];

describe('rollupMacros', () => {
  it('returns null when links is empty', () => {
    expect(rollupMacros(TWO_INGREDIENTS, {}, 2)).toBeNull();
  });

  it('calculates per-serve totals when all ingredients linked (per_100g)', () => {
    const links = {
      0: makeEntry({ cal_per_basis: 165, protein_per_basis: 31, carbs_per_basis: 0, fat_per_basis: 3.6 }),
      1: makeEntry({ item_name: 'brown rice', cal_per_basis: 130, protein_per_basis: 2.7, carbs_per_basis: 28, fat_per_basis: 0.3 }),
    };
    const result = rollupMacros(TWO_INGREDIENTS, links, 2);
    expect(result).not.toBeNull();
    expect(result!.isPartial).toBe(false);
    expect(result!.perServe.cal).toBeCloseTo(262.5);
    expect(result!.perServe.protein_g).toBeCloseTo(33.025);
  });

  it('sets isPartial true when only some ingredients have links', () => {
    const links = { 0: makeEntry() };
    const result = rollupMacros(TWO_INGREDIENTS, links, 2);
    expect(result!.isPartial).toBe(true);
  });

  it('populates contributions keyed by ingredient index', () => {
    const links = { 0: makeEntry({ protein_per_basis: 31 }) };
    const result = rollupMacros(TWO_INGREDIENTS, links, 2);
    expect(result!.contributions[0].protein_g).toBeCloseTo(62);
    expect(result!.contributions[1]).toBeUndefined();
  });

  it('handles per_100mL basis with measured mL', () => {
    const ingredients: Ingredient[] = [
      { item: 'oat milk', amount: { kind: 'measured', value: 250, unit: 'mL' } },
    ];
    const links = {
      0: makeEntry({ basis: 'per_100mL', cal_per_basis: 45 }),
    };
    const result = rollupMacros(ingredients, links, 1);
    expect(result!.perServe.cal).toBeCloseTo(112.5);
  });

  it('handles per_unit basis with measured unit', () => {
    const ingredients: Ingredient[] = [
      { item: 'egg', amount: { kind: 'measured', value: 2, unit: 'unit' } },
    ];
    const links = {
      0: makeEntry({ basis: 'per_unit', cal_per_basis: 72, protein_per_basis: 6, carbs_per_basis: 0, fat_per_basis: 5 }),
    };
    const result = rollupMacros(ingredients, links, 1);
    expect(result!.perServe.cal).toBeCloseTo(144);
  });

  it('handles per_unit basis with custom amount (multiplier = value)', () => {
    const ingredients: Ingredient[] = [
      { item: 'garlic', amount: { kind: 'custom', value: 3, unit: 'cloves' } },
    ];
    const links = {
      0: makeEntry({ basis: 'per_unit', cal_per_basis: 5, protein_per_basis: 0.2, carbs_per_basis: 1, fat_per_basis: 0 }),
    };
    const result = rollupMacros(ingredients, links, 1);
    expect(result!.perServe.cal).toBeCloseTo(15);
  });

  it('contributes 0 on basis-unit mismatch (e.g. mL amount with per_100g nutrition)', () => {
    const ingredients: Ingredient[] = [
      { item: 'honey', amount: { kind: 'measured', value: 50, unit: 'mL' } },
    ];
    const links = { 0: makeEntry({ basis: 'per_100g', cal_per_basis: 304 }) };
    const result = rollupMacros(ingredients, links, 1);
    expect(result!.perServe.cal).toBeCloseTo(0);
    expect(result!.isPartial).toBe(false); // link exists, just contributes 0
  });

  it('contributes 0 for note amounts', () => {
    const ingredients: Ingredient[] = [
      { item: 'salt', amount: { kind: 'note', text: 'to taste' } },
    ];
    const links = { 0: makeEntry({ basis: 'per_100g', cal_per_basis: 0 }) };
    const result = rollupMacros(ingredients, links, 1);
    expect(result!.perServe.cal).toBeCloseTo(0);
  });
});
```

- [ ] **Step 2: Run the rollup tests — confirm they fail**

Run: `npm test -- rollupMacros.test.ts`
Expected: FAIL — implementation still uses string `parseAmount`.

- [ ] **Step 3: Rewrite `lib/rollupMacros.ts`**

Full replacement:

```ts
import { amountMultiplier } from './amount';
import type { FoodNutritionRow } from '../types/db';
import type { Ingredient } from '../meal_plan.types';

export interface MacroTotals {
  cal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface RollupResult {
  perServe: MacroTotals;
  isPartial: boolean;
  contributions: Record<number, MacroTotals>;
}

export function rollupMacros(
  ingredients: Ingredient[],
  links: Record<number, FoodNutritionRow>,
  servings: number,
): RollupResult | null {
  if (Object.keys(links).length === 0) return null;

  let totalCal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let linked = 0;
  const contributions: Record<number, MacroTotals> = {};

  for (let i = 0; i < ingredients.length; i++) {
    const entry = links[i];
    if (!entry) continue;
    linked++;

    const multiplier = amountMultiplier(ingredients[i].amount, entry.basis);

    const contrib: MacroTotals = {
      cal:       (entry.cal_per_basis ?? 0)     * multiplier,
      protein_g: (entry.protein_per_basis ?? 0) * multiplier,
      carbs_g:   (entry.carbs_per_basis ?? 0)   * multiplier,
      fat_g:     (entry.fat_per_basis ?? 0)     * multiplier,
    };
    contributions[i] = contrib;

    totalCal     += contrib.cal;
    totalProtein += contrib.protein_g;
    totalCarbs   += contrib.carbs_g;
    totalFat     += contrib.fat_g;
  }

  const s = servings > 0 ? servings : 1;
  return {
    perServe: {
      cal: totalCal / s,
      protein_g: totalProtein / s,
      carbs_g: totalCarbs / s,
      fat_g: totalFat / s,
    },
    isPartial: linked < ingredients.length,
    contributions,
  };
}
```

- [ ] **Step 4: Run the rollup tests — confirm they pass**

Run: `npm test -- rollupMacros.test.ts`
Expected: PASS — all green.

- [ ] **Step 5: Commit**

```bash
git add lib/rollupMacros.ts __tests__/lib/rollupMacros.test.ts
git commit -m "refactor(rollup): dispatch on Amount.kind instead of parsing strings"
```

---

## Task 4: Delete the legacy `parseAmount` module

**Files:**
- Delete: `lib/parseAmount.ts`
- Delete: `__tests__/lib/parseAmount.test.ts`

- [ ] **Step 1: Verify no other consumers exist**

Run: `grep -rn "parseAmount" /Users/tim/meal-planner --include="*.ts" --include="*.tsx" --exclude-dir=node_modules`
Expected: only `components/FoodNutritionSheet.tsx` and possibly the test file we are about to delete reference the old name. (The sheet will be rewritten in Task 10 to import from `lib/amount.ts`.)

- [ ] **Step 2: Remove the legacy module's import from `components/FoodNutritionSheet.tsx` to break the dependency**

Open `components/FoodNutritionSheet.tsx`. At the top, replace:

```ts
import { parseAmount } from "../lib/parseAmount";
```

with:

```ts
import { parseAmountString, amountToBasis } from "../lib/amount";
```

Inside the `useEffect` that defaults the basis from `ingredientAmount` (currently around line 82), replace:

```ts
const parsed = parseAmount(ingredientAmount);
if (parsed?.type === "mL") setBasis("per_100mL");
else if (parsed?.type === "units") setBasis("per_unit");
else setBasis("per_100g");
```

with:

```ts
setBasis(amountToBasis(parseAmountString(ingredientAmount)));
```

This is a temporary shim — the sheet still receives `ingredientAmount: string`. Task 10 rewrites the sheet to take an `Amount` directly and removes this shim.

- [ ] **Step 3: Delete the legacy files**

```bash
rm lib/parseAmount.ts __tests__/lib/parseAmount.test.ts
```

- [ ] **Step 4: Run the type checker and the full test suite**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` still has errors from `lib/import/transform.ts` and the IngredientRow/sheet tests with old string fixtures. The `rollupMacros` and `amount` tests pass. That's fine — the next tasks fix the remaining errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(amount): retire legacy parseAmount module in favour of lib/amount"
```

---

## Task 5: Update the import path to accept string OR object amounts

**Files:**
- Modify: `lib/import/transform.ts:24-41`
- Modify: `__tests__/lib/import/transform.test.ts`

- [ ] **Step 1: Add failing tests for both shapes**

Append the following tests to `__tests__/lib/import/transform.test.ts` (before the final closing brace of the `describe('transformPlan', ...)` block):

```ts
  it('coerces v1.1 string amounts to structured Amount on import', () => {
    const plan: any = {
      ...PLAN,
      recipes: [{
        ...PLAN.recipes[0],
        ingredients: [
          { item: 'beef', amount: '800g' },
          { item: 'oat milk', amount: '250mL' },
          { item: 'garlic', amount: '3 cloves' },
          { item: 'salt', amount: 'to taste' },
        ],
      }],
    };
    const { recipes } = transformPlan(plan);
    const ings = JSON.parse(recipes[0].ingredients_json);
    expect(ings[0].amount).toEqual({ kind: 'measured', value: 800, unit: 'g' });
    expect(ings[1].amount).toEqual({ kind: 'measured', value: 250, unit: 'mL' });
    expect(ings[2].amount).toEqual({ kind: 'custom', value: 3, unit: 'cloves' });
    expect(ings[3].amount).toEqual({ kind: 'note', text: 'to taste' });
  });

  it('passes v1.2 object amounts through unchanged', () => {
    const plan: any = {
      ...PLAN,
      recipes: [{
        ...PLAN.recipes[0],
        ingredients: [
          { item: 'beef', amount: { kind: 'measured', value: 800, unit: 'g' } },
        ],
      }],
    };
    const { recipes } = transformPlan(plan);
    const ings = JSON.parse(recipes[0].ingredients_json);
    expect(ings[0].amount).toEqual({ kind: 'measured', value: 800, unit: 'g' });
  });
```

Update the existing top-of-file `PLAN` fixture so its single ingredient uses the new structured shape — change line 33 from:

```ts
      ingredients: [{ item: 'beef', amount: '800g' }],
```

to:

```ts
      ingredients: [{ item: 'beef', amount: { kind: 'measured', value: 800, unit: 'g' } }],
```

- [ ] **Step 2: Run the import tests — confirm they fail**

Run: `npm test -- import/transform.test.ts`
Expected: FAIL — the new string-form test fails because `transformPlan` does not coerce; type errors in TypeScript because the loose-typed inputs go through `transformPlan(plan: MealPlan)`.

- [ ] **Step 3: Update `lib/import/transform.ts` to coerce ingredient amounts**

Replace the file contents:

```ts
import type { MealPlan, Recipe, Ingredient, Amount } from '../../meal_plan.types';
import type { RecipeRow, WeeklyPlanRow, ShoppingItemRow } from '../../types/db';
import { parseAmountString } from '../amount';

interface TransformResult {
  weeklyPlan: WeeklyPlanRow;
  recipes: RecipeRow[];
  shoppingItems: ShoppingItemRow[];
}

// At the import boundary the incoming JSON may still be v1.1 with a string `amount`.
// Loosen the type here so callers can pass either shape; we narrow before storing.
type IngredientInput = { item: string; amount: string | Amount };
type RecipeInput = Omit<Recipe, 'ingredients'> & { ingredients: IngredientInput[] };
type MealPlanInput = Omit<MealPlan, 'recipes'> & { recipes: RecipeInput[] };

function coerceAmount(amount: string | Amount): Amount {
  return typeof amount === 'string' ? parseAmountString(amount) : amount;
}

function coerceIngredient(ing: IngredientInput): Ingredient {
  return { item: ing.item, amount: coerceAmount(ing.amount) };
}

export function transformPlan(plan: MealPlanInput): TransformResult {
  const now = new Date().toISOString();

  const weeklyPlan: WeeklyPlanRow = {
    id: plan.meta.week_starting,
    week_starting: plan.meta.week_starting,
    is_active: 1,
    meta_json: JSON.stringify(plan.meta),
    strategy_json: JSON.stringify(plan.strategy),
    days_json: JSON.stringify(plan.meal_plan),
    batch_plan_json: JSON.stringify(plan.sunday_batch_plan),
    created_at: now,
  };

  const recipes: RecipeRow[] = plan.recipes.map((r) => ({
    id: r.id,
    title: r.title,
    meal_type: r.meal_type,
    servings: r.servings,
    calories_per_serve: r.calories_per_serve,
    protein_per_serve_g: r.protein_per_serve_g,
    cook_method: r.cook_method,
    prep_minutes: r.prep_minutes,
    cook_minutes: r.cook_minutes,
    ingredients_json: JSON.stringify(r.ingredients.map(coerceIngredient)),
    method_steps_json: JSON.stringify(
      r.method_steps ?? (r.method ? [r.method] : [])
    ),
    is_favourite: 0,
    source: 'imported',
    created_at: now,
  }));

  const shoppingItems: ShoppingItemRow[] = plan.shopping_list.categories.flatMap(
    (cat, catIdx) =>
      cat.items.map((item, itemIdx) => ({
        id: `${plan.meta.week_starting}_${catIdx}_${itemIdx}`,
        plan_id: plan.meta.week_starting,
        category: cat.name,
        category_order: catIdx,
        item_order: itemIdx,
        name: item.item,
        qty: item.qty,
        estimated_price: item.price,
        is_oneoff: cat.is_oneoff ? 1 : 0,
        note: item.note || null,
        is_checked: 0,
      }))
  );

  return { weeklyPlan, recipes, shoppingItems };
}
```

(Note: the previous version of `transformPlan` set `actual_price: null` and `store: null` on each shopping item, but `ShoppingItemRow` no longer has those fields — confirm by reading `types/db.ts:30-41`. Drop them.)

- [ ] **Step 4: Run the import tests — confirm they pass**

Run: `npm test -- import/transform.test.ts`
Expected: PASS — all green, including the new string-and-object tests.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: rollup + amount + transform pass. `IngredientRow.test.tsx` and `FoodNutritionSheet.test.tsx` still fail (fixtures expect strings; fix next tasks).

- [ ] **Step 6: Commit**

```bash
git add lib/import/transform.ts __tests__/lib/import/transform.test.ts
git commit -m "feat(import): accept v1.1 string amounts at the import boundary; emit structured Amount"
```

---

## Task 6: Update `IngredientRow` to render via `formatAmount`

**Files:**
- Modify: `components/IngredientRow.tsx:57`
- Modify: `__tests__/components/IngredientRow.test.tsx:6,11-13`

- [ ] **Step 1: Update the test fixtures + the displayed-amount assertion**

Replace `__tests__/components/IngredientRow.test.tsx` line 6 (`const ING`):

```ts
const ING: Ingredient = { item: 'Chicken breast', amount: { kind: 'measured', value: 200, unit: 'g' } };
```

Replace the `it('renders item name and amount', ...)` assertion (line 12) so the expected display string matches `formatAmount` output (a space between number and unit):

```ts
    expect(getByText('200 g')).toBeTruthy();
```

- [ ] **Step 2: Run the IngredientRow tests — confirm they fail**

Run: `npm test -- IngredientRow.test.tsx`
Expected: FAIL — component renders `[object Object]` because it still does `{ingredient.amount}` on a now-object value.

- [ ] **Step 3: Update `components/IngredientRow.tsx` to use `formatAmount`**

Add the import near the top of the file:

```ts
import { formatAmount } from '../lib/amount';
```

Replace line 57:

```tsx
        <AppText weight="bold" color="orange" size="md">{ingredient.amount}</AppText>
```

with:

```tsx
        <AppText weight="bold" color="orange" size="md">{formatAmount(ingredient.amount)}</AppText>
```

- [ ] **Step 4: Run the tests — confirm they pass**

Run: `npm test -- IngredientRow.test.tsx`
Expected: PASS.

- [ ] **Step 5: Update the recipe detail screen's copy-to-clipboard path**

In `app/recipe/[id].tsx` the `handleCopy` function (around line 58–72) formats each ingredient as `` `- ${i.amount} ${i.item}` ``. With `amount` now an object, this produces `[object Object]`. Update the import and the line:

Add to the imports:

```ts
import { formatAmount } from '../../lib/amount';
```

Replace the ingredients line in `handleCopy`:

```ts
      ...recipe.ingredients.map((i) => `- ${formatAmount(i.amount)} ${i.item}`),
```

- [ ] **Step 6: Commit**

```bash
git add components/IngredientRow.tsx __tests__/components/IngredientRow.test.tsx app/recipe/[id].tsx
git commit -m "feat(ingredient-row): render structured Amount via formatAmount; fix recipe-copy output"
```

---

## Task 7: Bump plan schema to v1.2 and update regenerate docs

**Files:**
- Modify: `regenerate/meal_plan.schema.json:23,283-302`
- Modify: `regenerate/HOW_TO_REGENERATE.md:34,94-105`

- [ ] **Step 1: Bump `schema_version` in the JSON schema**

In `regenerate/meal_plan.schema.json`, change line 23 from:

```json
      "const": "1.1",
```

to:

```json
      "const": "1.2",
```

- [ ] **Step 2: Replace the `amount` property with a `oneOf`**

In `regenerate/meal_plan.schema.json`, the `ingredients` definition currently has:

```json
"amount": {
  "type": "string",
  "description": "Metric units only: g/kg for weight, mL/L for volume. Unit counts (e.g. '1 head', '3', '5 scoops') are fine. Never use cups, tbsp, tsp, oz, or lb."
}
```

Replace with:

```json
"amount": {
  "description": "Structured amount. Use `measured` for canonical metric units, `custom` for cooking-speak units (cloves, slices, cans), `note` for unmeasured (to taste, a pinch).",
  "oneOf": [
    {
      "type": "object",
      "required": ["kind", "value", "unit"],
      "additionalProperties": false,
      "properties": {
        "kind":  { "const": "measured" },
        "value": { "type": "number", "exclusiveMinimum": 0 },
        "unit":  { "enum": ["g", "kg", "mL", "L", "unit"] }
      }
    },
    {
      "type": "object",
      "required": ["kind", "value", "unit"],
      "additionalProperties": false,
      "properties": {
        "kind":  { "const": "custom" },
        "value": { "type": "number", "exclusiveMinimum": 0 },
        "unit":  { "type": "string", "minLength": 1 }
      }
    },
    {
      "type": "object",
      "required": ["kind", "text"],
      "additionalProperties": false,
      "properties": {
        "kind": { "const": "note" },
        "text": { "type": "string", "minLength": 1 }
      }
    }
  ]
}
```

- [ ] **Step 3: Update `regenerate/HOW_TO_REGENERATE.md`**

Replace the units bullet (line 34):

> - Units: metric only — use g/kg for weight, mL/L for volume. Never use cups, tbsp, tsp, oz, or lb. Unit counts (e.g. "1 head", "3", "5 scoops") are fine for things that can't be weighed or measured by volume.

with:

```
- Units: every `ingredients[*].amount` is an object, one of three kinds:
  - `{ "kind": "measured", "value": number, "unit": "g" | "kg" | "mL" | "L" | "unit" }` for canonical metric or count amounts
  - `{ "kind": "custom", "value": number, "unit": string }` for cooking-speak units like "cloves", "slices", "cans"
  - `{ "kind": "note", "text": string }` for unmeasured items like "to taste" or "a pinch"
  Never use cups, tbsp, tsp, oz, or lb — convert to metric (g or mL) before emitting.
```

Update the schema version block at the bottom (lines 94–105). Replace:

```
The current schema is **v1.1**. Key changes from v1.0:
- `method: string` → replaced by `method_steps: string[]` on every recipe.
  The app renders these as a numbered list. Always use `method_steps`.
- `method` is still accepted by the app for old v1.0 imports (backward compat),
  but new plans must not use it.
```

with:

```
The current schema is **v1.2**. Key changes from v1.1:
- `ingredients[*].amount: string` → replaced by a tagged union object (`measured` | `custom` | `note`).
  See the Units bullet above for the three valid shapes and examples below.
- v1.1 string amounts are still accepted by the app's import path for backward compatibility — they are
  parsed into the new structure on import. New plans must emit the structured shape.

Examples:
- `{ "item": "Beef chuck, cubed", "amount": { "kind": "measured", "value": 900, "unit": "g" } }`
- `{ "item": "Olive oil",         "amount": { "kind": "measured", "value": 60, "unit": "mL" } }`
- `{ "item": "Garlic",            "amount": { "kind": "custom", "value": 3, "unit": "cloves" } }`
- `{ "item": "Salt",              "amount": { "kind": "note", "text": "to taste" } }`

Key changes from v1.0:
- `method: string` → `method_steps: string[]`. The app renders a numbered list. Always use `method_steps`.
- `method` is still accepted for legacy v1.0 imports.
```

- [ ] **Step 4: Validate the schema document parses as JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('regenerate/meal_plan.schema.json'))"`
Expected: no output (success). Any output indicates malformed JSON.

- [ ] **Step 5: Commit**

```bash
git add regenerate/meal_plan.schema.json regenerate/HOW_TO_REGENERATE.md
git commit -m "feat(schema): bump meal_plan to v1.2 — structured amount object"
```

---

## Task 8: Rename `FoodNutritionSheet` → `IngredientSheet`

**Files:**
- Rename: `components/FoodNutritionSheet.tsx` → `components/IngredientSheet.tsx`
- Rename: `__tests__/components/FoodNutritionSheet.test.tsx` → `__tests__/components/IngredientSheet.test.tsx`
- Modify: `app/recipe/[id].tsx` (imports + usage)

- [ ] **Step 1: Rename the source file**

```bash
git mv components/FoodNutritionSheet.tsx components/IngredientSheet.tsx
```

- [ ] **Step 2: Update the component name in the new file**

In `components/IngredientSheet.tsx`, replace the only `export function FoodNutritionSheet` declaration:

```ts
export function FoodNutritionSheet({
```

with:

```ts
export function IngredientSheet({
```

- [ ] **Step 3: Rename the test file and its imports/identifiers**

```bash
git mv __tests__/components/FoodNutritionSheet.test.tsx __tests__/components/IngredientSheet.test.tsx
```

In the new test file, replace the two `FoodNutritionSheet` occurrences (the import line and the four `<FoodNutritionSheet ... />` JSX usages) with `IngredientSheet`. Also rename the describe block to `'IngredientSheet'`.

- [ ] **Step 4: Update imports in `app/recipe/[id].tsx`**

Replace:

```ts
import { FoodNutritionSheet } from '../../components/FoodNutritionSheet';
```

with:

```ts
import { IngredientSheet } from '../../components/IngredientSheet';
```

And in the JSX (around line 177), replace the `<FoodNutritionSheet …/>` element with `<IngredientSheet …/>`. Props remain unchanged for now — they will be reshaped in Task 11.

- [ ] **Step 5: Run the sheet tests to confirm the rename compiles**

Run: `npm test -- IngredientSheet.test.tsx`
Expected: PASS — same four tests still green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(sheet): rename FoodNutritionSheet -> IngredientSheet"
```

---

## Task 9: Add the editable name input + trash button to `IngredientSheet`

**Files:**
- Modify: `components/IngredientSheet.tsx`

- [ ] **Step 1: Add new props and internal state for ingredient editing**

At the top of the component file, replace the `Props` interface with:

```ts
import type { Ingredient } from "../meal_plan.types";

interface Props {
  visible: boolean;
  mode: 'add' | 'edit';
  initialIngredient: Ingredient | null;        // null in add mode
  existingEntry: FoodNutritionRow | null;
  onSave: (data: { ingredient: Ingredient; nutrition: FoodNutritionData | null }) => void;
  onDelete?: () => void;                        // edit mode only
  onClose: () => void;
}
```

Remove the legacy `ingredientName: string` and `ingredientAmount: string` props from the function signature and from all usages inside the component. The name and amount now come from `initialIngredient` (or empty when adding).

- [ ] **Step 2: Add name input state and replace the big static header text**

Inside the component, alongside the existing `useState` calls, add:

```ts
const [name, setName] = useState('');
```

In the existing `useEffect` that fires on `visible`, replace the Task 4 shim that defaulted the basis from `parseAmountString(ingredientAmount)` (which now references a removed prop). The new `useEffect` handles `initialIngredient`:

```ts
if (initialIngredient) {
  setName(initialIngredient.item);
} else {
  setName('');
}
```

Also remove the standalone basis-defaulting line `setBasis(amountToBasis(parseAmountString(ingredientAmount)));` — Task 11 reintroduces basis defaulting in an amount-aware form. For this task, when `existingEntry` is null and we are in add mode, leave the basis at its initial `useState('per_100g')` default.

Replace the existing "nameRow" View (currently containing the big `AppText` ingredient name and the `unitToggle` for the basis) — split it so the name row holds only the input + trash, and move the basis toggle to a new "NUTRITION PER" row added later (Task 11).

Replace the current nameRow JSX with:

```tsx
<View style={styles.nameRow}>
  <TextInput
    style={styles.nameInput}
    value={name}
    onChangeText={setName}
    placeholder="Ingredient name"
    placeholderTextColor={colors.textTertiary}
  />
  {mode === 'edit' && onDelete && (
    <TouchableOpacity
      style={styles.trashBtn}
      onPress={() => {
        Alert.alert(
          `Remove ${initialIngredient?.item ?? 'ingredient'}?`,
          undefined,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: onDelete },
          ],
        );
      }}
      activeOpacity={0.7}
    >
      <Ionicons name="trash-outline" size={20} color={colors.terracotta} />
    </TouchableOpacity>
  )}
</View>
```

Add the imports at the top if not present:

```ts
import { Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
```

- [ ] **Step 3: Add the new styles**

In the `StyleSheet.create` block, replace the existing `nameRow` and `nameText` rules with:

```ts
nameRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: spacing[2],
  marginBottom: spacing[3],
},
nameInput: {
  flex: 1,
  height: 38,
  backgroundColor: colors.cream,
  borderWidth: 1.5,
  borderColor: colors.divider,
  borderRadius: radius.md,
  paddingHorizontal: spacing[3] + 2,
  paddingVertical: 10,
  fontFamily: font.family.extrabold,
  fontSize: font.size.xl,
  color: colors.textPrimary,
},
trashBtn: {
  width: 38,
  height: 38,
  borderRadius: radius.md,
  backgroundColor: colors.cream,
  borderWidth: 1.5,
  borderColor: colors.divider,
  alignItems: "center",
  justifyContent: "center",
},
```

Also remove the now-orphaned `unitToggle`, `unitOpt`, `unitOptActive` style references at the *old* location — they are reused for the basis toggle inside the nutrition section in Task 11, so do not delete the rules themselves yet.

- [ ] **Step 4: Update the existing four sheet tests so they pass against the new props**

Open `__tests__/components/IngredientSheet.test.tsx` and replace it with:

```ts
import React from 'react';
import { render } from '@testing-library/react-native';
import { IngredientSheet } from '../../components/IngredientSheet';
import type { FoodNutritionRow } from '../../types/db';
import type { Ingredient } from '../../meal_plan.types';

jest.mock('../../components/PriceHistoryChart', () => ({
  PriceHistoryChart: () => null,
}));

const EXISTING: FoodNutritionRow = {
  id: 'test-id',
  item_name: 'oat milk',
  brand: 'Vitasoy',
  product_name: 'Oat Milk Barista',
  basis: 'per_100mL',
  cal_per_basis: 45,
  protein_per_basis: 1,
  carbs_per_basis: 4.5,
  fat_per_basis: 1.5,
  updated_at: '2026-05-24T00:00:00.000Z',
};

const ING: Ingredient = { item: 'Oat milk', amount: { kind: 'measured', value: 240, unit: 'mL' } };

describe('IngredientSheet', () => {
  it('pre-fills brand and product name from existingEntry', () => {
    const { getByDisplayValue } = render(
      <IngredientSheet
        visible={true}
        mode="edit"
        initialIngredient={ING}
        existingEntry={EXISTING}
        onSave={jest.fn()}
        onClose={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    expect(getByDisplayValue('Vitasoy')).toBeTruthy();
    expect(getByDisplayValue('Oat Milk Barista')).toBeTruthy();
  });

  it('pre-fills calorie value from existingEntry', () => {
    const { getByDisplayValue } = render(
      <IngredientSheet
        visible={true}
        mode="edit"
        initialIngredient={ING}
        existingEntry={EXISTING}
        onSave={jest.fn()}
        onClose={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    expect(getByDisplayValue('45')).toBeTruthy();
  });

  it('shows empty name input in add mode', () => {
    const { getByPlaceholderText } = render(
      <IngredientSheet
        visible={true}
        mode="add"
        initialIngredient={null}
        existingEntry={null}
        onSave={jest.fn()}
        onClose={jest.fn()}
      />
    );
    const input = getByPlaceholderText('Ingredient name');
    expect(input.props.value).toBe('');
  });

  it('renders the editable ingredient name from initialIngredient', () => {
    const { getByDisplayValue } = render(
      <IngredientSheet
        visible={true}
        mode="edit"
        initialIngredient={{ item: 'Brown rice', amount: { kind: 'measured', value: 200, unit: 'g' } }}
        existingEntry={null}
        onSave={jest.fn()}
        onClose={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    expect(getByDisplayValue('Brown rice')).toBeTruthy();
  });
});
```

- [ ] **Step 5: Update the caller in `app/recipe/[id].tsx` to the new prop shape**

Replace the existing `<IngredientSheet …/>` block (and the `sheetIngredient` state + `handleNutritionSave` function it depended on) with the temporary scaffold below — it preserves edit-only behaviour until Task 12 wires add/delete:

```tsx
const [editingIndex, setEditingIndex] = useState<number | null>(null);
const editingIngredient = editingIndex != null ? recipe.ingredients[editingIndex] : null;

async function handleSheetSave({ ingredient, nutrition }: { ingredient: Ingredient; nutrition: FoodNutritionData | null }) {
  if (editingIndex == null) return;
  if (nutrition) {
    const existingId = links[editingIndex]?.id;
    const foodNutritionId = await upsert({ ...nutrition, id: existingId });
    await linkIngredient(recipe.id, editingIndex, foodNutritionId);
    setLinksKey(k => k + 1);
  }
  // ingredient mutation lands in Task 12; for now the existing edit-without-write behaviour is preserved
  setEditingIndex(null);
}

// JSX
<IngredientSheet
  visible={editingIndex !== null}
  mode="edit"
  initialIngredient={editingIngredient}
  existingEntry={editingIndex !== null ? (links[editingIndex] ?? null) : null}
  onSave={handleSheetSave}
  onClose={() => setEditingIndex(null)}
/>
```

Update the `IngredientRow` `onPress` to set the index:

```tsx
onPress={() => setEditingIndex(idx)}
```

Add to the imports near the top of `app/recipe/[id].tsx`:

```ts
import type { Ingredient } from '../../meal_plan.types';
```

- [ ] **Step 6: Run the sheet tests**

Run: `npm test -- IngredientSheet.test.tsx`
Expected: PASS — all four tests green.

- [ ] **Step 7: Commit**

```bash
git add components/IngredientSheet.tsx __tests__/components/IngredientSheet.test.tsx app/recipe/[id].tsx
git commit -m "feat(ingredient-sheet): editable name input + trash button (delete confirm)"
```

---

## Task 10: Add amount + unit row with the standard-unit picker

**Files:**
- Modify: `components/IngredientSheet.tsx`

- [ ] **Step 1: Add amount/unit state and sync from `initialIngredient`**

Inside the component, add new state alongside the existing `useState` calls:

```ts
const [amountValue, setAmountValue] = useState('');
const [unit, setUnit] = useState<Unit>('g');
const [customUnitMode, setCustomUnitMode] = useState(false);
const [customUnit, setCustomUnit] = useState('');
const [noteMode, setNoteMode] = useState(false);
const [noteText, setNoteText] = useState('');
const [unitPickerVisible, setUnitPickerVisible] = useState(false);
```

Add imports at the top:

```ts
import type { Unit } from "../meal_plan.types";
import { formatAmount } from "../lib/amount";
```

Extend the `useEffect` (the one that fires on `visible`) so that when an `initialIngredient` is present it seeds these fields:

```ts
if (initialIngredient) {
  setName(initialIngredient.item);
  const a = initialIngredient.amount;
  if (a.kind === 'note') {
    setNoteMode(true);
    setNoteText(a.text);
    setAmountValue('');
    setUnit('g');
    setCustomUnitMode(false);
    setCustomUnit('');
  } else if (a.kind === 'custom') {
    setNoteMode(false);
    setCustomUnitMode(true);
    setCustomUnit(a.unit);
    setAmountValue(String(a.value));
    setUnit('unit');
  } else {
    setNoteMode(false);
    setCustomUnitMode(false);
    setCustomUnit('');
    setAmountValue(String(a.value));
    setUnit(a.unit);
  }
} else {
  setName('');
  setAmountValue('');
  setUnit('g');
  setCustomUnitMode(false);
  setCustomUnit('');
  setNoteMode(false);
  setNoteText('');
}
```

- [ ] **Step 2: Build the amount + unit row JSX**

Add this block immediately below the `nameRow` View (and before the `KeyboardAwareScrollView`):

```tsx
{!noteMode && (
  <View style={styles.amtRow}>
    <TextInput
      style={styles.amtInput}
      value={amountValue}
      onChangeText={setAmountValue}
      placeholder="0"
      placeholderTextColor={colors.textTertiary}
      keyboardType="decimal-pad"
    />
    {customUnitMode ? (
      <View style={styles.customUnitWrap}>
        <TextInput
          style={styles.customUnitInput}
          value={customUnit}
          onChangeText={setCustomUnit}
          placeholder="cloves"
          placeholderTextColor={colors.textTertiary}
        />
        <TouchableOpacity
          onPress={() => { setCustomUnitMode(false); setCustomUnit(''); setUnit('g'); }}
          style={styles.customUnitClear}
          activeOpacity={0.7}
        >
          <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
    ) : (
      <TouchableOpacity
        style={styles.unitSelect}
        onPress={() => setUnitPickerVisible(true)}
        activeOpacity={0.7}
      >
        <AppText weight="semibold" size="md" color="textPrimary">{unitLabel(unit)}</AppText>
        <Ionicons name="chevron-down" size={14} color={colors.textTertiary} />
      </TouchableOpacity>
    )}
  </View>
)}
```

Just below the component function, add a tiny helper:

```ts
function unitLabel(u: Unit): string {
  switch (u) {
    case 'g':    return 'grams (g)';
    case 'kg':   return 'kilograms (kg)';
    case 'mL':   return 'millilitres (mL)';
    case 'L':    return 'litres (L)';
    case 'unit': return 'count (unit)';
  }
}
```

- [ ] **Step 3: Add the unit picker modal**

At the bottom of the sheet JSX (just before the closing `</View>` of the sheet), add:

```tsx
<Modal
  visible={unitPickerVisible}
  transparent
  animationType="fade"
  onRequestClose={() => setUnitPickerVisible(false)}
>
  <TouchableOpacity
    style={styles.pickerScrim}
    activeOpacity={1}
    onPress={() => setUnitPickerVisible(false)}
  >
    <View style={styles.pickerCard}>
      {(['g', 'kg', 'mL', 'L', 'unit'] as const).map((u) => (
        <TouchableOpacity
          key={u}
          style={styles.pickerOpt}
          onPress={() => { setUnit(u); setUnitPickerVisible(false); }}
          activeOpacity={0.7}
        >
          <AppText weight={unit === u ? 'bold' : 'semibold'} size="md" color="textPrimary">
            {unitLabel(u)}
          </AppText>
          {unit === u && <Ionicons name="checkmark" size={18} color={colors.green} />}
        </TouchableOpacity>
      ))}
      <View style={styles.pickerDivider} />
      <TouchableOpacity
        style={styles.pickerOpt}
        onPress={() => { setCustomUnitMode(true); setUnit('unit'); setUnitPickerVisible(false); }}
        activeOpacity={0.7}
      >
        <AppText weight="semibold" size="md" color="green">Custom…</AppText>
      </TouchableOpacity>
    </View>
  </TouchableOpacity>
</Modal>
```

- [ ] **Step 4: Add the styles**

In the `StyleSheet.create` block, add:

```ts
amtRow: {
  flexDirection: "row",
  gap: spacing[2],
  marginBottom: spacing[3],
},
amtInput: {
  flexBasis: 110,
  backgroundColor: colors.cream,
  borderWidth: 1.5,
  borderColor: colors.divider,
  borderRadius: radius.md,
  paddingHorizontal: spacing[3] + 2,
  paddingVertical: 10,
  fontFamily: font.family.semibold,
  fontSize: font.size.lg,
  color: colors.textPrimary,
  textAlign: 'right',
},
unitSelect: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: colors.cream,
  borderWidth: 1.5,
  borderColor: colors.divider,
  borderRadius: radius.md,
  paddingHorizontal: spacing[3] + 2,
  paddingVertical: 10,
},
customUnitWrap: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: colors.cream,
  borderWidth: 1.5,
  borderColor: colors.divider,
  borderRadius: radius.md,
  paddingHorizontal: spacing[3] + 2,
},
customUnitInput: {
  flex: 1,
  paddingVertical: 10,
  fontFamily: font.family.semibold,
  fontSize: font.size.lg,
  color: colors.textPrimary,
},
customUnitClear: {
  paddingHorizontal: spacing[1],
},
pickerScrim: {
  flex: 1,
  backgroundColor: colors.scrim,
  alignItems: 'center',
  justifyContent: 'center',
},
pickerCard: {
  backgroundColor: colors.card,
  borderRadius: radius.lg,
  paddingVertical: spacing[2],
  width: 260,
  ...shadow.sheet,
},
pickerOpt: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: spacing[4],
  paddingVertical: spacing[3],
  minHeight: 44,
},
pickerDivider: {
  height: 1,
  backgroundColor: colors.divider,
  marginVertical: spacing[1],
},
```

- [ ] **Step 5: Write a test that confirms the amount + unit pre-fill**

Append to `__tests__/components/IngredientSheet.test.tsx`:

```ts
  it('pre-fills the amount value and unit from initialIngredient', () => {
    const { getByDisplayValue, getByText } = render(
      <IngredientSheet
        visible={true}
        mode="edit"
        initialIngredient={{ item: 'Honey', amount: { kind: 'measured', value: 70, unit: 'g' } }}
        existingEntry={null}
        onSave={jest.fn()}
        onClose={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    expect(getByDisplayValue('70')).toBeTruthy();
    expect(getByText('grams (g)')).toBeTruthy();
  });

  it('pre-fills the custom unit when amount is custom', () => {
    const { getByDisplayValue } = render(
      <IngredientSheet
        visible={true}
        mode="edit"
        initialIngredient={{ item: 'Garlic', amount: { kind: 'custom', value: 3, unit: 'cloves' } }}
        existingEntry={null}
        onSave={jest.fn()}
        onClose={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    expect(getByDisplayValue('3')).toBeTruthy();
    expect(getByDisplayValue('cloves')).toBeTruthy();
  });
```

- [ ] **Step 6: Run the sheet tests**

Run: `npm test -- IngredientSheet.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/IngredientSheet.tsx __tests__/components/IngredientSheet.test.tsx
git commit -m "feat(ingredient-sheet): amount + unit row with standard picker and custom fallback"
```

---

## Task 11: Add note-mode UI + "NUTRITION PER" label + unified onSave

**Files:**
- Modify: `components/IngredientSheet.tsx`

- [ ] **Step 1: Render the note-mode UI**

Below the amount/unit row block, add the note-mode UI:

```tsx
{noteMode && (
  <View style={styles.noteWrap}>
    <TextInput
      style={styles.input}
      value={noteText}
      onChangeText={setNoteText}
      placeholder="to taste"
      placeholderTextColor={colors.textTertiary}
    />
    <TouchableOpacity
      style={styles.noteToMeasured}
      onPress={() => { setNoteMode(false); setNoteText(''); setAmountValue('0'); setUnit('g'); }}
      activeOpacity={0.7}
    >
      <AppText weight="bold" size="xs" color="green" style={{ letterSpacing: font.tracking.label }}>
        Add measurement
      </AppText>
    </TouchableOpacity>
  </View>
)}
```

In the unit picker modal (Task 10), add a `Note` option directly above `Custom…`:

```tsx
<TouchableOpacity
  style={styles.pickerOpt}
  onPress={() => { setNoteMode(true); setUnitPickerVisible(false); }}
  activeOpacity={0.7}
>
  <AppText weight="semibold" size="md" color="green">Note (no measurement)</AppText>
</TouchableOpacity>
```

Add styles:

```ts
noteWrap: {
  marginBottom: spacing[3],
  gap: spacing[2],
},
noteToMeasured: {
  alignSelf: 'flex-start',
  paddingVertical: spacing[1],
},
```

- [ ] **Step 2: Add the "NUTRITION PER" row above the basis toggle**

The basis toggle JSX currently lives inside the `nameRow` View (from before Task 9 moved it). Move it now into a new row above the calorie input. Inside the `KeyboardAwareScrollView`, just above the `<FieldLabel top>CALORIES</FieldLabel>` line, add:

```tsx
<View style={styles.basisRow}>
  <AppText weight="bold" size="xs" color="textTertiary" style={{ letterSpacing: font.tracking.caps }}>
    NUTRITION PER
  </AppText>
  <View style={styles.unitToggle}>
    {BASIS_LABELS.map(({ value, label }) => (
      <TouchableOpacity
        key={value}
        style={[styles.unitOpt, basis === value && styles.unitOptActive]}
        onPress={() => setBasis(value)}
        activeOpacity={0.7}
      >
        <AppText
          weight={basis === value ? "bold" : "semibold"}
          size="2xs"
          color={basis === value ? "green" : "textTertiary"}
        >
          {label}
        </AppText>
      </TouchableOpacity>
    ))}
  </View>
</View>
```

Delete the old basis-toggle markup from inside the (now-removed) heading. The `BASIS_LABELS`, `unitToggle`, `unitOpt`, `unitOptActive` style rules already exist — reuse them.

Add the new style rule:

```ts
basisRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: spacing[3],
  marginBottom: spacing[2],
},
```

In the JSX, change `<FieldLabel top>CALORIES</FieldLabel>` to `<FieldLabel>CALORIES</FieldLabel>` (drop the `top` prop) — the new basis row already provides the spacing above the calorie input.

- [ ] **Step 3: Replace `handleSave` to produce the unified `onSave` shape**

Replace the existing `handleSave`:

```ts
function handleSave() {
  const trimmedName = name.trim();
  if (!trimmedName) return;

  let amount: Ingredient['amount'];
  if (noteMode) {
    amount = { kind: 'note', text: noteText.trim() };
  } else {
    const value = parseFloat(amountValue);
    if (isNaN(value) || value <= 0) return;
    if (customUnitMode) {
      const u = customUnit.trim();
      if (!u) return;
      amount = { kind: 'custom', value, unit: u };
    } else {
      amount = { kind: 'measured', value, unit };
    }
  }

  const hasNutritionInput =
    brand.trim() !== '' ||
    productName.trim() !== '' ||
    cal !== '' || protein !== '' || carbs !== '' || fat !== '';

  const nutrition: FoodNutritionData | null = hasNutritionInput
    ? {
        item_name: trimmedName.toLowerCase(),
        brand: brand.trim() || null,
        product_name: productName.trim() || null,
        basis,
        cal_per_basis:     cal     ? parseFloat(cal)     : null,
        protein_per_basis: protein ? parseFloat(protein) : null,
        carbs_per_basis:   carbs   ? parseFloat(carbs)   : null,
        fat_per_basis:     fat     ? parseFloat(fat)     : null,
      }
    : null;

  onSave({ ingredient: { item: trimmedName, amount }, nutrition });
}
```

- [ ] **Step 4: Default the nutrition basis from the current amount when adding**

Where the `useEffect` currently sets the basis (Task 4 introduced a one-liner via `amountToBasis(parseAmountString(ingredientAmount))`), replace it for *add* mode with:

```ts
if (!existingEntry) {
  if (initialIngredient) setBasis(amountToBasis(initialIngredient.amount));
  else setBasis('per_100g');
}
```

When `existingEntry` is present we keep its `basis` as before.

- [ ] **Step 5: Add a test for the save callback shape**

In `__tests__/components/IngredientSheet.test.tsx`, change the import at the top of the file from `import { render } from '@testing-library/react-native';` to:

```ts
import { render, fireEvent } from '@testing-library/react-native';
```

Then append this test inside the `describe('IngredientSheet', …)` block:

```ts
it('emits unified onSave with ingredient + nutrition on Done press', () => {
  const onSave = jest.fn();
  const { getByText } = render(
    <IngredientSheet
      visible={true}
      mode="edit"
      initialIngredient={{ item: 'Honey', amount: { kind: 'measured', value: 70, unit: 'g' } }}
      existingEntry={EXISTING}
      onSave={onSave}
      onClose={jest.fn()}
      onDelete={jest.fn()}
    />
  );
  fireEvent.press(getByText('Done'));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    ingredient: { item: 'Honey', amount: { kind: 'measured', value: 70, unit: 'g' } },
    nutrition: expect.objectContaining({ brand: 'Vitasoy' }),
  }));
});
```

- [ ] **Step 6: Run the sheet tests**

Run: `npm test -- IngredientSheet.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/IngredientSheet.tsx __tests__/components/IngredientSheet.test.tsx
git commit -m "feat(ingredient-sheet): note mode, basis label, unified onSave/onDelete shape"
```

---

## Task 12: Add the `useRecipeIngredients` hook with link re-indexing

**Files:**
- Create: `hooks/useRecipeIngredients.ts`
- Create: `__tests__/hooks/useRecipeIngredients.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/hooks/useRecipeIngredients.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests — confirm they fail**

Run: `npm test -- useRecipeIngredients.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `hooks/useRecipeIngredients.ts`**

```ts
import { useCallback } from 'react';
import { useDb, usePlanVersion } from '../providers/DatabaseProvider';
import type { Ingredient } from '../meal_plan.types';
import type { RecipeRow } from '../types/db';

// Pure helper, exported for unit testing.
export function reindexLinksOnDelete(
  linkIndices: Record<number, unknown>,
  deletedIndex: number,
): { toDelete: number[]; toShift: { from: number; to: number }[] } {
  const indices = Object.keys(linkIndices).map(Number).sort((a, b) => a - b);
  const toDelete: number[] = [];
  const toShift: { from: number; to: number }[] = [];
  for (const i of indices) {
    if (i === deletedIndex) toDelete.push(i);
    else if (i > deletedIndex) toShift.push({ from: i, to: i - 1 });
  }
  return { toDelete, toShift };
}

export function useRecipeIngredients() {
  const db = useDb();
  const { bumpPlanVersion } = usePlanVersion();

  const readIngredients = useCallback(async (recipeId: string): Promise<Ingredient[]> => {
    const row = await db.getFirstAsync<Pick<RecipeRow, 'ingredients_json'>>(
      'SELECT ingredients_json FROM recipes WHERE id = ?',
      [recipeId],
    );
    if (!row) return [];
    return JSON.parse(row.ingredients_json);
  }, [db]);

  const writeIngredients = useCallback(async (recipeId: string, ingredients: Ingredient[]) => {
    await db.runAsync(
      'UPDATE recipes SET ingredients_json = ? WHERE id = ?',
      [JSON.stringify(ingredients), recipeId],
    );
  }, [db]);

  const updateIngredient = useCallback(async (
    recipeId: string,
    index: number,
    ingredient: Ingredient,
  ) => {
    const current = await readIngredients(recipeId);
    if (index < 0 || index >= current.length) return;
    const next = [...current];
    next[index] = ingredient;
    await writeIngredients(recipeId, next);
    bumpPlanVersion();
  }, [readIngredients, writeIngredients, bumpPlanVersion]);

  const addIngredient = useCallback(async (
    recipeId: string,
    ingredient: Ingredient,
  ): Promise<number> => {
    const current = await readIngredients(recipeId);
    const next = [...current, ingredient];
    await writeIngredients(recipeId, next);
    bumpPlanVersion();
    return next.length - 1;
  }, [readIngredients, writeIngredients, bumpPlanVersion]);

  const deleteIngredient = useCallback(async (
    recipeId: string,
    index: number,
  ) => {
    const current = await readIngredients(recipeId);
    if (index < 0 || index >= current.length) return;
    const next = current.filter((_, i) => i !== index);

    await db.withTransactionAsync(async () => {
      await writeIngredients(recipeId, next);
      // Re-index ingredient_nutrition_link entries
      const links = await db.getAllAsync<{ ingredient_index: number }>(
        'SELECT ingredient_index FROM ingredient_nutrition_link WHERE recipe_id = ?',
        [recipeId],
      );
      const linkMap: Record<number, true> = {};
      for (const l of links) linkMap[l.ingredient_index] = true;
      const plan = reindexLinksOnDelete(linkMap, index);
      for (const i of plan.toDelete) {
        await db.runAsync(
          'DELETE FROM ingredient_nutrition_link WHERE recipe_id = ? AND ingredient_index = ?',
          [recipeId, i],
        );
      }
      // Shift downward — apply in ascending order to avoid colliding with unmoved rows.
      for (const { from, to } of plan.toShift) {
        await db.runAsync(
          'UPDATE ingredient_nutrition_link SET ingredient_index = ? WHERE recipe_id = ? AND ingredient_index = ?',
          [to, recipeId, from],
        );
      }
    });
    bumpPlanVersion();
  }, [readIngredients, writeIngredients, bumpPlanVersion, db]);

  return { updateIngredient, addIngredient, deleteIngredient };
}
```

- [ ] **Step 4: Run the helper test — confirm green**

Run: `npm test -- useRecipeIngredients.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/useRecipeIngredients.ts __tests__/hooks/useRecipeIngredients.test.ts
git commit -m "feat(recipe-ingredients): add/update/delete hook with link re-indexing"
```

---

## Task 13: Create `AddIngredientRow` and wire `app/recipe/[id].tsx`

**Files:**
- Create: `components/AddIngredientRow.tsx`
- Modify: `app/recipe/[id].tsx`

- [ ] **Step 1: Create `components/AddIngredientRow.tsx`**

```tsx
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AppText } from './ui/AppText';
import { colors, spacing, radius, font } from '../constants/tokens';

interface Props {
  onPress: () => void;
}

export function AddIngredientRow({ onPress }: Props) {
  return (
    <TouchableOpacity
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      activeOpacity={0.7}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel="Add ingredient"
    >
      <View style={styles.plus}>
        <AppText weight="extrabold" size="md" color="cream">+</AppText>
      </View>
      <AppText weight="bold" size="md" color="green" style={styles.label}>
        Add ingredient
      </AppText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3] + 2,
    paddingHorizontal: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.checkboxBorder,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(232, 240, 238, 0.35)',
  },
  plus: {
    width: 18,
    height: 18,
    borderRadius: radius.full,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    letterSpacing: font.tracking.label,
  },
});
```

- [ ] **Step 2: Wire up `app/recipe/[id].tsx` to add/edit/delete via the new hook**

Open `app/recipe/[id].tsx`. Replace the editing-state block and the `<IngredientSheet …/>` element with the full add/edit/delete flow:

```tsx
import { AddIngredientRow } from '../../components/AddIngredientRow';
import { useRecipeIngredients } from '../../hooks/useRecipeIngredients';
// ... existing imports

const { updateIngredient, addIngredient, deleteIngredient } = useRecipeIngredients();

// Replace any prior `sheetIngredient` / `editingIndex` state with this single union:
type SheetState =
  | { mode: 'edit'; index: number }
  | { mode: 'add' }
  | null;

const [sheet, setSheet] = useState<SheetState>(null);

const editingIngredient =
  sheet?.mode === 'edit' ? recipe.ingredients[sheet.index] ?? null : null;
const existingEntry =
  sheet?.mode === 'edit' ? (links[sheet.index] ?? null) : null;

async function handleSheetSave({ ingredient, nutrition }: {
  ingredient: Ingredient;
  nutrition: FoodNutritionData | null;
}) {
  if (!sheet) return;

  if (sheet.mode === 'edit') {
    await updateIngredient(recipe.id, sheet.index, ingredient);
    if (nutrition) {
      const existingId = links[sheet.index]?.id;
      const foodNutritionId = await upsert({ ...nutrition, id: existingId });
      await linkIngredient(recipe.id, sheet.index, foodNutritionId);
    }
  } else {
    const newIndex = await addIngredient(recipe.id, ingredient);
    if (nutrition) {
      const foodNutritionId = await upsert(nutrition);
      await linkIngredient(recipe.id, newIndex, foodNutritionId);
    }
  }
  setLinksKey(k => k + 1);
  setSheet(null);
}

async function handleSheetDelete() {
  if (sheet?.mode !== 'edit') return;
  await deleteIngredient(recipe.id, sheet.index);
  setLinksKey(k => k + 1);
  setSheet(null);
}
```

In the JSX, render `AddIngredientRow` inside the ingredients card after the `.map(...)` of `IngredientRow`s:

```tsx
<View style={styles.card}>
  {recipe.ingredients.map((ing, idx) => (
    <IngredientRow
      key={idx}
      ingredient={ing}
      nutrition={rollup?.contributions[idx] ?? null}
      onPress={() => setSheet({ mode: 'edit', index: idx })}
    />
  ))}
  <AddIngredientRow onPress={() => setSheet({ mode: 'add' })} />
</View>
```

And the sheet element at the bottom of the screen:

```tsx
<IngredientSheet
  visible={sheet !== null}
  mode={sheet?.mode ?? 'add'}
  initialIngredient={editingIngredient}
  existingEntry={existingEntry}
  onSave={handleSheetSave}
  onDelete={sheet?.mode === 'edit' ? handleSheetDelete : undefined}
  onClose={() => setSheet(null)}
/>
```

- [ ] **Step 3: Manual smoke-test the flow**

Run the dev server: `npx expo start` (or however the project is normally launched).

In the app:
1. Open a recipe → tap an ingredient → sheet opens pre-filled. Edit name + amount → Done → list updates.
2. Tap "+ Add ingredient" → empty sheet → fill name + amount → Done → row appears at the bottom.
3. Tap an existing ingredient → tap trash → confirm → row disappears. If the deleted ingredient had nutrition linked, verify other ingredients' macro chips remain correctly attributed (try one that previously had macros — its chip should still be there).

Report blockers (failed haptics, missing icons, layout glitches) and fix before committing.

- [ ] **Step 4: Run the full test suite + type checker**

Run: `npx tsc --noEmit && npm test`
Expected: type-check clean, all tests green.

- [ ] **Step 5: Commit**

```bash
git add components/AddIngredientRow.tsx app/recipe/[id].tsx
git commit -m "feat(recipe): inline add/edit/delete ingredients with link re-indexing"
```

---

## Final verification

- [ ] **Run the full test suite once more**

Run: `npm test`
Expected: every suite green, no skipped tests.

- [ ] **Run the type checker**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Validate the schema file parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('regenerate/meal_plan.schema.json'))"`
Expected: no output.

- [ ] **Verify the app boots end-to-end**

Start the dev server, open a recipe with at least one ingredient that previously had a unit/basis mismatch (e.g. a `mL` amount linked to per_100g nutrition). Edit the amount to use the correct unit; confirm the macro chip now reads non-zero and the per-serve total no longer shows the `~` partial prefix.
