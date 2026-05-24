# Food Nutrition Tagging & Claude Context Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to tag per-brand nutrition data to recipe ingredients, roll up to recipe macro totals in the GreenHeader, and export purchase history as JSON context for Claude meal plan generation.

**Architecture:** Two new SQLite tables (`food_nutrition`, `ingredient_nutrition_link`) added via schema + migration. A new `useFoodNutrition` hook, two pure utilities (`parseAmount`, `rollupMacros`), a new `FoodNutritionSheet` bottom sheet, and updates to `IngredientRow`, `app/recipe/[id].tsx`, `lib/exportContext.ts`, and `app/settings.tsx`.

**Tech Stack:** expo-sqlite, React Native, TypeScript, expo-clipboard (~56.0.3 already installed), @testing-library/react-native (jest).

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `lib/parseAmount.ts` | Pure: parse "200g" → `{type:'grams',value:200}` |
| Create | `lib/rollupMacros.ts` | Pure: sum ingredient nutrition → per-serve macros |
| Modify | `lib/db/schema.ts` | Add two new table definitions |
| Modify | `lib/db/migrations.ts` | Add version-2 migration block |
| Modify | `types/db.ts` | Add `FoodNutritionRow` type |
| Create | `hooks/useFoodNutrition.ts` | DB CRUD for food_nutrition + ingredient_nutrition_link |
| Modify | `components/IngredientRow.tsx` | Add tappable + macro chip strip |
| Create | `components/FoodNutritionSheet.tsx` | Bottom sheet for entering nutrition per ingredient |
| Modify | `app/recipe/[id].tsx` | Header pills, load links, wire sheet |
| Create | `lib/exportContext.ts` | Build JSON snapshot of purchases + nutrition |
| Modify | `app/settings.tsx` | "Copy context for Claude" button |

---

## Task 1: `lib/parseAmount.ts`

**Files:**
- Create: `lib/parseAmount.ts`
- Create: `__tests__/lib/parseAmount.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/lib/parseAmount.test.ts
import { parseAmount } from '../../lib/parseAmount';

describe('parseAmount', () => {
  it('parses grams', () => {
    expect(parseAmount('200g')).toEqual({ type: 'grams', value: 200 });
    expect(parseAmount('200 g')).toEqual({ type: 'grams', value: 200 });
    expect(parseAmount('1.5g')).toEqual({ type: 'grams', value: 1.5 });
  });

  it('parses kg to grams', () => {
    expect(parseAmount('1.5kg')).toEqual({ type: 'grams', value: 1500 });
    expect(parseAmount('1 kg')).toEqual({ type: 'grams', value: 1000 });
  });

  it('parses mL', () => {
    expect(parseAmount('250mL')).toEqual({ type: 'mL', value: 250 });
    expect(parseAmount('250 ml')).toEqual({ type: 'mL', value: 250 });
  });

  it('parses L to mL', () => {
    expect(parseAmount('1L')).toEqual({ type: 'mL', value: 1000 });
    expect(parseAmount('1.5 l')).toEqual({ type: 'mL', value: 1500 });
  });

  it('parses unit counts from leading number', () => {
    expect(parseAmount('2 eggs')).toEqual({ type: 'units', value: 2 });
    expect(parseAmount('3')).toEqual({ type: 'units', value: 3 });
    expect(parseAmount('4 cloves garlic')).toEqual({ type: 'units', value: 4 });
  });

  it('returns null for recognised-but-unsupported measurement units', () => {
    expect(parseAmount('1 tbsp')).toBeNull();
    expect(parseAmount('2 tsp')).toBeNull();
    expect(parseAmount('1 cup')).toBeNull();
    expect(parseAmount('2 cups')).toBeNull();
  });

  it('returns null for non-numeric strings', () => {
    expect(parseAmount('a handful')).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('to taste')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/lib/parseAmount.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../../lib/parseAmount'`

- [ ] **Step 3: Implement `lib/parseAmount.ts`**

```typescript
// lib/parseAmount.ts
export type ParsedAmount =
  | { type: 'grams'; value: number }
  | { type: 'mL'; value: number }
  | { type: 'units'; value: number }
  | null;

export function parseAmount(amount: string): ParsedAmount {
  const s = amount.trim().toLowerCase();
  if (!s) return null;

  const kgMatch = s.match(/^([\d.]+)\s*kg$/);
  if (kgMatch) return { type: 'grams', value: parseFloat(kgMatch[1]) * 1000 };

  const gMatch = s.match(/^([\d.]+)\s*g$/);
  if (gMatch) return { type: 'grams', value: parseFloat(gMatch[1]) };

  const lMatch = s.match(/^([\d.]+)\s*l$/);
  if (lMatch) return { type: 'mL', value: parseFloat(lMatch[1]) * 1000 };

  const mlMatch = s.match(/^([\d.]+)\s*ml$/);
  if (mlMatch) return { type: 'mL', value: parseFloat(mlMatch[1]) };

  // Return null for common cooking measurements we can't convert to grams/mL
  if (/^[\d.]+\s*(tsp|tbsp|cup|cups|oz|lb|lbs)\b/.test(s)) return null;

  // Leading number → unit count (e.g. "2 eggs", "3", "4 cloves garlic")
  const unitMatch = s.match(/^([\d.]+)/);
  if (unitMatch) return { type: 'units', value: parseFloat(unitMatch[1]) };

  return null;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest __tests__/lib/parseAmount.test.ts --no-coverage
```

Expected: PASS — 7 tests passing

- [ ] **Step 5: Commit**

```bash
git add lib/parseAmount.ts __tests__/lib/parseAmount.test.ts
git commit -m "feat: add parseAmount utility for ingredient amount strings"
```

---

## Task 2: `lib/rollupMacros.ts`

**Files:**
- Create: `lib/rollupMacros.ts`
- Create: `__tests__/lib/rollupMacros.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/lib/rollupMacros.test.ts
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
  { item: 'chicken breast', amount: '200g' },
  { item: 'brown rice', amount: '150g' },
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
    // chicken: 200/100*165=330, rice: 150/100*130=195 → total 525, /2 = 262.5
    expect(result!.perServe.cal).toBeCloseTo(262.5);
    // chicken: 200/100*31=62, rice: 150/100*2.7=4.05 → 66.05, /2 = 33.025
    expect(result!.perServe.protein_g).toBeCloseTo(33.025);
  });

  it('sets isPartial true when only some ingredients have links', () => {
    const links = { 0: makeEntry() }; // only ingredient 0 linked
    const result = rollupMacros(TWO_INGREDIENTS, links, 2);
    expect(result).not.toBeNull();
    expect(result!.isPartial).toBe(true);
  });

  it('populates contributions keyed by ingredient index', () => {
    const links = { 0: makeEntry({ protein_per_basis: 31 }) }; // 200g chicken
    const result = rollupMacros(TWO_INGREDIENTS, links, 2);
    // 200/100 * 31 = 62g protein for ingredient 0
    expect(result!.contributions[0].protein_g).toBeCloseTo(62);
    expect(result!.contributions[1]).toBeUndefined();
  });

  it('handles per_100mL basis', () => {
    const ingredients: Ingredient[] = [{ item: 'oat milk', amount: '250mL' }];
    const links = {
      0: makeEntry({ basis: 'per_100mL', cal_per_basis: 45, protein_per_basis: 1, carbs_per_basis: 4.5, fat_per_basis: 1.5 }),
    };
    const result = rollupMacros(ingredients, links, 1);
    // 250/100 * 45 = 112.5
    expect(result!.perServe.cal).toBeCloseTo(112.5);
  });

  it('handles per_unit basis', () => {
    const ingredients: Ingredient[] = [{ item: 'egg', amount: '2 eggs' }];
    const links = {
      0: makeEntry({ basis: 'per_unit', cal_per_basis: 72, protein_per_basis: 6, carbs_per_basis: 0, fat_per_basis: 5 }),
    };
    const result = rollupMacros(ingredients, links, 1);
    // 2 * 72 = 144
    expect(result!.perServe.cal).toBeCloseTo(144);
  });

  it('treats unparseable amount as 0 contribution', () => {
    const ingredients: Ingredient[] = [{ item: 'salt', amount: '1 tsp' }];
    const links = { 0: makeEntry({ cal_per_basis: 0, protein_per_basis: 0, carbs_per_basis: 0, fat_per_basis: 0 }) };
    const result = rollupMacros(ingredients, links, 1);
    expect(result!.perServe.cal).toBeCloseTo(0);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/lib/rollupMacros.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../../lib/rollupMacros'`

- [ ] **Step 3: Implement `lib/rollupMacros.ts`**

```typescript
// lib/rollupMacros.ts
import { parseAmount } from './parseAmount';
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
  contributions: Record<number, MacroTotals>; // raw total per ingredient (not divided by servings)
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

    const parsed = parseAmount(ingredients[i].amount);
    let multiplier = 0;

    if (parsed) {
      if (entry.basis === 'per_100g' && parsed.type === 'grams') {
        multiplier = parsed.value / 100;
      } else if (entry.basis === 'per_100mL' && parsed.type === 'mL') {
        multiplier = parsed.value / 100;
      } else if (entry.basis === 'per_unit' && parsed.type === 'units') {
        multiplier = parsed.value;
      }
    }

    const contrib: MacroTotals = {
      cal: (entry.cal_per_basis ?? 0) * multiplier,
      protein_g: (entry.protein_per_basis ?? 0) * multiplier,
      carbs_g: (entry.carbs_per_basis ?? 0) * multiplier,
      fat_g: (entry.fat_per_basis ?? 0) * multiplier,
    };
    contributions[i] = contrib;

    totalCal += contrib.cal;
    totalProtein += contrib.protein_g;
    totalCarbs += contrib.carbs_g;
    totalFat += contrib.fat_g;
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

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest __tests__/lib/rollupMacros.test.ts --no-coverage
```

Expected: PASS — 7 tests passing

- [ ] **Step 5: Commit**

```bash
git add lib/rollupMacros.ts __tests__/lib/rollupMacros.test.ts
git commit -m "feat: add rollupMacros utility for ingredient-level macro calculation"
```

---

## Task 3: Schema, migration, and types

**Files:**
- Modify: `lib/db/schema.ts`
- Modify: `lib/db/migrations.ts`
- Modify: `types/db.ts`
- Modify: `__tests__/lib/db/migrations.test.ts`

- [ ] **Step 1: Add new tests to migrations.test.ts first**

Add these three tests inside the existing `describe('runMigrations', ...)` block in `__tests__/lib/db/migrations.test.ts`:

```typescript
it('calls execAsync with SQL containing the two new nutrition tables', async () => {
  await runMigrations(mockDb as any);
  const sql: string = mockDb.execAsync.mock.calls[0][0];
  expect(sql).toContain('CREATE TABLE IF NOT EXISTS food_nutrition');
  expect(sql).toContain('CREATE TABLE IF NOT EXISTS ingredient_nutrition_link');
});

it('runs version-2 migration on a v1 database', async () => {
  mockDb.getAllAsync.mockResolvedValue([{ user_version: 1 }]);
  await runMigrations(mockDb as any);
  const allSql = mockDb.execAsync.mock.calls.map((c: any[]) => c[0]).join('\n');
  expect(allSql).toContain('user_version = 2');
});

it('skips version-2 migration when already at version 2', async () => {
  mockDb.getAllAsync.mockResolvedValue([{ user_version: 2 }]);
  await runMigrations(mockDb as any);
  const allSql = mockDb.execAsync.mock.calls.map((c: any[]) => c[0]).join('\n');
  expect(allSql).not.toContain('user_version = 2');
});
```

- [ ] **Step 2: Run migrations tests to confirm the new ones fail**

```bash
npx jest __tests__/lib/db/migrations.test.ts --no-coverage
```

Expected: existing 3 tests PASS, new 3 tests FAIL

- [ ] **Step 3: Add new tables to `lib/db/schema.ts`**

Add the following two table definitions and index at the end of `SCHEMA_SQL`, just before the closing backtick:

```typescript
  CREATE TABLE IF NOT EXISTS food_nutrition (
    id TEXT PRIMARY KEY,
    item_name TEXT NOT NULL,
    brand TEXT,
    product_name TEXT,
    basis TEXT NOT NULL DEFAULT 'per_100g'
      CHECK (basis IN ('per_100g', 'per_100mL', 'per_unit')),
    cal_per_basis REAL,
    protein_per_basis REAL,
    carbs_per_basis REAL,
    fat_per_basis REAL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_food_nutrition_item_name
    ON food_nutrition(item_name);

  CREATE TABLE IF NOT EXISTS ingredient_nutrition_link (
    recipe_id TEXT NOT NULL,
    ingredient_index INTEGER NOT NULL,
    food_nutrition_id TEXT NOT NULL REFERENCES food_nutrition(id),
    PRIMARY KEY (recipe_id, ingredient_index)
  );
```

- [ ] **Step 4: Add version-2 migration block to `lib/db/migrations.ts`**

Add after the existing `if (version < 1)` block:

```typescript
  if (version < 2) {
    // food_nutrition and ingredient_nutrition_link are created by SCHEMA_SQL above (IF NOT EXISTS).
    // Nothing destructive to run — just bump the version.
    await db.execAsync('PRAGMA user_version = 2');
  }
```

- [ ] **Step 5: Add `FoodNutritionRow` to `types/db.ts`**

Append to the end of `types/db.ts`:

```typescript
export interface FoodNutritionRow {
  id: string;
  item_name: string;
  brand: string | null;
  product_name: string | null;
  basis: 'per_100g' | 'per_100mL' | 'per_unit';
  cal_per_basis: number | null;
  protein_per_basis: number | null;
  carbs_per_basis: number | null;
  fat_per_basis: number | null;
  updated_at: string;
}
```

- [ ] **Step 6: Run all migrations tests**

```bash
npx jest __tests__/lib/db/migrations.test.ts --no-coverage
```

Expected: PASS — 6 tests passing

- [ ] **Step 7: Run full suite to check nothing broke**

```bash
npx jest --no-coverage
```

Expected: all tests passing

- [ ] **Step 8: Commit**

```bash
git add lib/db/schema.ts lib/db/migrations.ts types/db.ts __tests__/lib/db/migrations.test.ts
git commit -m "feat: add food_nutrition and ingredient_nutrition_link schema (migration v2)"
```

---

## Task 4: `hooks/useFoodNutrition.ts`

**Files:**
- Create: `hooks/useFoodNutrition.ts`

No automated tests for this hook — hook tests require a real SQLite database which isn't available in the Jest environment. The hook is exercised via integration in the recipe detail screen.

- [ ] **Step 1: Create `hooks/useFoodNutrition.ts`**

```typescript
// hooks/useFoodNutrition.ts
import { useCallback } from 'react';
import { useDb } from '../providers/DatabaseProvider';
import { generateId } from '../lib/uuid';
import type { FoodNutritionRow } from '../types/db';

export interface FoodNutritionData {
  item_name: string;
  brand: string | null;
  product_name: string | null;
  basis: 'per_100g' | 'per_100mL' | 'per_unit';
  cal_per_basis: number | null;
  protein_per_basis: number | null;
  carbs_per_basis: number | null;
  fat_per_basis: number | null;
}

export function useFoodNutrition() {
  const db = useDb();

  const getById = useCallback(async (id: string): Promise<FoodNutritionRow | null> => {
    const row = await db.getFirstAsync<FoodNutritionRow>(
      'SELECT * FROM food_nutrition WHERE id = ?',
      [id]
    );
    return row ?? null;
  }, [db]);

  const getByName = useCallback(async (name: string): Promise<FoodNutritionRow | null> => {
    const row = await db.getFirstAsync<FoodNutritionRow>(
      `SELECT * FROM food_nutrition
       WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?))
       ORDER BY updated_at DESC LIMIT 1`,
      [name]
    );
    return row ?? null;
  }, [db]);

  const upsert = useCallback(async (
    data: FoodNutritionData & { id?: string }
  ): Promise<string> => {
    const id = data.id ?? generateId();
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO food_nutrition
         (id, item_name, brand, product_name, basis,
          cal_per_basis, protein_per_basis, carbs_per_basis, fat_per_basis, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         item_name = excluded.item_name,
         brand = excluded.brand,
         product_name = excluded.product_name,
         basis = excluded.basis,
         cal_per_basis = excluded.cal_per_basis,
         protein_per_basis = excluded.protein_per_basis,
         carbs_per_basis = excluded.carbs_per_basis,
         fat_per_basis = excluded.fat_per_basis,
         updated_at = excluded.updated_at`,
      [id, data.item_name, data.brand, data.product_name, data.basis,
       data.cal_per_basis, data.protein_per_basis, data.carbs_per_basis,
       data.fat_per_basis, now]
    );
    return id;
  }, [db]);

  const linkIngredient = useCallback(async (
    recipeId: string,
    ingredientIndex: number,
    foodNutritionId: string,
  ): Promise<void> => {
    await db.runAsync(
      `INSERT INTO ingredient_nutrition_link (recipe_id, ingredient_index, food_nutrition_id)
       VALUES (?, ?, ?)
       ON CONFLICT(recipe_id, ingredient_index) DO UPDATE SET
         food_nutrition_id = excluded.food_nutrition_id`,
      [recipeId, ingredientIndex, foodNutritionId]
    );
  }, [db]);

  const getLinksForRecipe = useCallback(async (
    recipeId: string,
  ): Promise<Record<number, FoodNutritionRow>> => {
    const rows = await db.getAllAsync<{ ingredient_index: number } & FoodNutritionRow>(
      `SELECT l.ingredient_index, fn.*
       FROM ingredient_nutrition_link l
       JOIN food_nutrition fn ON fn.id = l.food_nutrition_id
       WHERE l.recipe_id = ?`,
      [recipeId]
    );
    const result: Record<number, FoodNutritionRow> = {};
    for (const row of rows) {
      result[row.ingredient_index] = row;
    }
    return result;
  }, [db]);

  return { getById, getByName, upsert, linkIngredient, getLinksForRecipe };
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "DayCard\|ProgressBar"
```

Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add hooks/useFoodNutrition.ts
git commit -m "feat: add useFoodNutrition hook"
```

---

## Task 5: Update `components/IngredientRow.tsx`

**Files:**
- Modify: `components/IngredientRow.tsx`
- Modify: `__tests__/components/RecipeCard.test.tsx` (if it renders IngredientRow — check first)

- [ ] **Step 1: Write the failing tests**

Create `__tests__/components/IngredientRow.test.tsx`:

```typescript
// __tests__/components/IngredientRow.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { IngredientRow } from '../../components/IngredientRow';
import type { Ingredient } from '../../meal_plan.types';

const ING: Ingredient = { item: 'Chicken breast', amount: '200g' };

describe('IngredientRow', () => {
  it('renders item name and amount', () => {
    const { getByText } = render(<IngredientRow ingredient={ING} />);
    expect(getByText('Chicken breast')).toBeTruthy();
    expect(getByText('200g')).toBeTruthy();
  });

  it('shows macro chip strip when nutrition provided', () => {
    const { getByText } = render(
      <IngredientRow
        ingredient={ING}
        nutrition={{ protein_g: 62, carbs_g: 0, fat_g: 7.2 }}
        onPress={jest.fn()}
      />
    );
    expect(getByText('P 62g')).toBeTruthy();
    expect(getByText('C 0g')).toBeTruthy();
    expect(getByText('F 7g')).toBeTruthy();
  });

  it('shows "tap to add nutrition" hint when onPress provided but no nutrition', () => {
    const { getByText } = render(
      <IngredientRow ingredient={ING} onPress={jest.fn()} />
    );
    expect(getByText('tap to add nutrition')).toBeTruthy();
  });

  it('shows neither hint nor chips when no onPress and no nutrition', () => {
    const { queryByText } = render(<IngredientRow ingredient={ING} />);
    expect(queryByText('tap to add nutrition')).toBeNull();
    expect(queryByText('P 0g')).toBeNull();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <IngredientRow ingredient={ING} onPress={onPress} />
    );
    fireEvent.press(getByText('Chicken breast'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/components/IngredientRow.test.tsx --no-coverage
```

Expected: FAIL — current component doesn't have `nutrition` or `onPress` props

- [ ] **Step 3: Replace `components/IngredientRow.tsx` with updated version**

```typescript
// components/IngredientRow.tsx
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText } from './ui/AppText';
import { Divider } from './ui/Divider';
import { spacing } from '../constants/tokens';
import type { Ingredient } from '../meal_plan.types';

interface MacroContribution {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface Props {
  ingredient: Ingredient;
  nutrition?: MacroContribution | null;
  onPress?: () => void;
}

export function IngredientRow({ ingredient, nutrition, onPress }: Props) {
  const inner = (
    <>
      <View style={styles.row}>
        <View style={styles.nameCol}>
          <AppText weight="semibold" color="textPrimary" size="md">
            {ingredient.item}
          </AppText>
          {nutrition ? (
            <View style={styles.chipRow}>
              <View style={styles.macroChip}>
                <AppText weight="semibold" size="2xs" color="textSecondary">
                  P {Math.round(nutrition.protein_g)}g
                </AppText>
              </View>
              <View style={styles.macroChip}>
                <AppText weight="semibold" size="2xs" color="textSecondary">
                  C {Math.round(nutrition.carbs_g)}g
                </AppText>
              </View>
              <View style={styles.macroChip}>
                <AppText weight="semibold" size="2xs" color="textSecondary">
                  F {Math.round(nutrition.fat_g)}g
                </AppText>
              </View>
            </View>
          ) : onPress ? (
            <AppText weight="regular" size="2xs" color="textTertiary" style={styles.hint}>
              tap to add nutrition
            </AppText>
          ) : null}
        </View>
        <AppText weight="bold" color="orange" size="md">{ingredient.amount}</AppText>
      </View>
      <Divider />
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  nameCol: {
    flex: 1,
    marginRight: spacing[3],
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  macroChip: {
    backgroundColor: '#e8f0ee',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  hint: {
    marginTop: spacing[1],
  },
});
```

- [ ] **Step 4: Run IngredientRow tests**

```bash
npx jest __tests__/components/IngredientRow.test.tsx --no-coverage
```

Expected: PASS — 5 tests passing

- [ ] **Step 5: Run full suite**

```bash
npx jest --no-coverage
```

Expected: all passing

- [ ] **Step 6: Commit**

```bash
git add components/IngredientRow.tsx __tests__/components/IngredientRow.test.tsx
git commit -m "feat: update IngredientRow with tappable + macro chip strip"
```

---

## Task 6: `components/FoodNutritionSheet.tsx`

**Files:**
- Create: `components/FoodNutritionSheet.tsx`
- Create: `__tests__/components/FoodNutritionSheet.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/components/FoodNutritionSheet.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { FoodNutritionSheet } from '../../components/FoodNutritionSheet';
import type { FoodNutritionRow } from '../../types/db';

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

describe('FoodNutritionSheet', () => {
  it('pre-fills brand and product name from existingEntry', () => {
    const { getByDisplayValue } = render(
      <FoodNutritionSheet
        visible={true}
        ingredientName="Oat milk"
        existingEntry={EXISTING}
        onSave={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(getByDisplayValue('Vitasoy')).toBeTruthy();
    expect(getByDisplayValue('Oat Milk Barista')).toBeTruthy();
  });

  it('pre-fills calorie value from existingEntry', () => {
    const { getByDisplayValue } = render(
      <FoodNutritionSheet
        visible={true}
        ingredientName="Oat milk"
        existingEntry={EXISTING}
        onSave={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(getByDisplayValue('45')).toBeTruthy();
  });

  it('shows empty inputs when existingEntry is null', () => {
    const { queryByDisplayValue } = render(
      <FoodNutritionSheet
        visible={true}
        ingredientName="Brown rice"
        existingEntry={null}
        onSave={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(queryByDisplayValue('Vitasoy')).toBeNull();
    expect(queryByDisplayValue('45')).toBeNull();
  });

  it('displays the ingredient name as heading', () => {
    const { getByText } = render(
      <FoodNutritionSheet
        visible={true}
        ingredientName="Brown rice"
        existingEntry={null}
        onSave={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(getByText('Brown rice')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/components/FoodNutritionSheet.test.tsx --no-coverage
```

Expected: FAIL — `Cannot find module '../../components/FoodNutritionSheet'`

- [ ] **Step 3: Create `components/FoodNutritionSheet.tsx`**

```typescript
// components/FoodNutritionSheet.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Modal, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, useWindowDimensions,
} from 'react-native';
import { AppText } from './ui/AppText';
import { colors, spacing, radius } from '../constants/tokens';
import type { FoodNutritionRow } from '../types/db';
import type { FoodNutritionData } from '../hooks/useFoodNutrition';

type Basis = 'per_100g' | 'per_100mL' | 'per_unit';

const BASIS_LABELS: { value: Basis; label: string }[] = [
  { value: 'per_100g', label: '100g' },
  { value: 'per_100mL', label: '100mL' },
  { value: 'per_unit', label: 'unit' },
];

interface Props {
  visible: boolean;
  ingredientName: string;
  existingEntry: FoodNutritionRow | null;
  onSave: (data: FoodNutritionData) => void;
  onClose: () => void;
}

export function FoodNutritionSheet({
  visible, ingredientName, existingEntry, onSave, onClose,
}: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const [basis, setBasis] = useState<Basis>('per_100g');
  const [brand, setBrand] = useState('');
  const [productName, setProductName] = useState('');
  const [cal, setCal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  useEffect(() => {
    if (!visible) return;
    if (existingEntry) {
      setBasis(existingEntry.basis);
      setBrand(existingEntry.brand ?? '');
      setProductName(existingEntry.product_name ?? '');
      setCal(existingEntry.cal_per_basis != null ? String(existingEntry.cal_per_basis) : '');
      setProtein(existingEntry.protein_per_basis != null ? String(existingEntry.protein_per_basis) : '');
      setCarbs(existingEntry.carbs_per_basis != null ? String(existingEntry.carbs_per_basis) : '');
      setFat(existingEntry.fat_per_basis != null ? String(existingEntry.fat_per_basis) : '');
    } else {
      setBasis('per_100g');
      setBrand(''); setProductName(''); setCal(''); setProtein(''); setCarbs(''); setFat('');
    }
  }, [visible, existingEntry]);

  function handleSave() {
    onSave({
      item_name: ingredientName.toLowerCase().trim(),
      brand: brand.trim() || null,
      product_name: productName.trim() || null,
      basis,
      cal_per_basis: cal ? parseFloat(cal) : null,
      protein_per_basis: protein ? parseFloat(protein) : null,
      carbs_per_basis: carbs ? parseFloat(carbs) : null,
      fat_per_basis: fat ? parseFloat(fat) : null,
    });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={[styles.sheet, { height: windowHeight * 0.80 }]}>
          <View style={styles.handle} />

          <View style={styles.nameRow}>
            <AppText weight="extrabold" size="2xl" color="textPrimary" style={styles.nameText}>
              {ingredientName}
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
                    weight={basis === value ? 'bold' : 'semibold'}
                    size="2xs"
                    color={basis === value ? 'green' : 'textTertiary'}
                  >
                    {label}
                  </AppText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <ScrollView
            style={styles.fields}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <FieldLabel>BRAND</FieldLabel>
            <TextInput
              style={styles.input}
              value={brand}
              onChangeText={setBrand}
              placeholder="e.g. Vitasoy"
              placeholderTextColor={colors.textTertiary}
            />

            <FieldLabel top>PRODUCT NAME</FieldLabel>
            <TextInput
              style={styles.input}
              value={productName}
              onChangeText={setProductName}
              placeholder="e.g. Oat Milk Barista"
              placeholderTextColor={colors.textTertiary}
            />

            <FieldLabel top>CALORIES</FieldLabel>
            <TextInput
              style={styles.input}
              value={cal}
              onChangeText={setCal}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
            />

            <View style={[styles.twoCol, { marginTop: spacing[4] }]}>
              <View style={styles.colFlex}>
                <FieldLabel>PROTEIN</FieldLabel>
                <TextInput
                  style={styles.input}
                  value={protein}
                  onChangeText={setProtein}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
              <View style={styles.colFlex}>
                <FieldLabel>CARBS</FieldLabel>
                <TextInput
                  style={styles.input}
                  value={carbs}
                  onChangeText={setCarbs}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
              <View style={styles.colFlex}>
                <FieldLabel>FAT</FieldLabel>
                <TextInput
                  style={styles.input}
                  value={fat}
                  onChangeText={setFat}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            </View>

            <View style={{ height: spacing[3] }} />
          </ScrollView>

          <TouchableOpacity style={styles.doneBtn} onPress={handleSave} activeOpacity={0.85}>
            <AppText weight="extrabold" size="lg" color="onGreen">Done</AppText>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FieldLabel({ children, top }: { children: string; top?: boolean }) {
  return (
    <AppText
      weight="bold"
      size="xs"
      color="textTertiary"
      style={{ letterSpacing: 0.8, marginBottom: spacing[1], marginTop: top ? spacing[4] : 0 }}
    >
      {children}
    </AppText>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg + 4,
    borderTopRightRadius: radius.lg + 4,
    paddingTop: spacing[2],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[6],
  },
  handle: {
    width: 36, height: 4, borderRadius: radius.full,
    backgroundColor: colors.divider, alignSelf: 'center', marginBottom: spacing[4],
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  nameText: { flex: 1 },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: colors.divider,
    borderRadius: radius.full,
    padding: 2,
    gap: 2,
    flexShrink: 0,
  },
  unitOpt: {
    borderRadius: radius.full,
    paddingHorizontal: spacing[2] + 1,
    paddingVertical: 5,
  },
  unitOptActive: {
    backgroundColor: colors.card,
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 1,
  },
  fields: { flex: 1 },
  input: {
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  twoCol: { flexDirection: 'row', gap: spacing[3] },
  colFlex: { flex: 1 },
  doneBtn: {
    backgroundColor: colors.orange,
    borderRadius: radius.full,
    paddingVertical: spacing[3] + 2,
    alignItems: 'center',
    marginTop: spacing[3],
  },
});
```

- [ ] **Step 4: Run FoodNutritionSheet tests**

```bash
npx jest __tests__/components/FoodNutritionSheet.test.tsx --no-coverage
```

Expected: PASS — 4 tests passing

- [ ] **Step 5: Run full suite**

```bash
npx jest --no-coverage
```

Expected: all tests passing

- [ ] **Step 6: Commit**

```bash
git add components/FoodNutritionSheet.tsx __tests__/components/FoodNutritionSheet.test.tsx
git commit -m "feat: add FoodNutritionSheet component"
```

---

## Task 7: Update `app/recipe/[id].tsx`

**Files:**
- Modify: `app/recipe/[id].tsx`

This screen gets the biggest changes: stats move from the body to GreenHeader as pills, each ingredient becomes tappable, and the FoodNutritionSheet is wired up.

- [ ] **Step 1: Replace `app/recipe/[id].tsx` with the full updated version**

```typescript
// app/recipe/[id].tsx
import React, { useState, useCallback, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { GreenHeader } from '../../components/ui/GreenHeader';
import { AppText } from '../../components/ui/AppText';
import { CategoryHeader } from '../../components/ui/CategoryHeader';
import { StepList } from '../../components/ui/StepList';
import { IngredientRow } from '../../components/IngredientRow';
import { FoodNutritionSheet } from '../../components/FoodNutritionSheet';
import { useRecipes } from '../../hooks/useRecipes';
import { useFoodNutrition } from '../../hooks/useFoodNutrition';
import { rollupMacros } from '../../lib/rollupMacros';
import { formatCookTime } from '../../lib/format';
import { colors, spacing, radius } from '../../constants/tokens';
import type { FoodNutritionRow } from '../../types/db';
import type { FoodNutritionData } from '../../hooks/useFoodNutrition';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipes } = useRecipes();
  const recipe = recipes.find((r) => r.id === id) ?? null;
  const { upsert, linkIngredient, getLinksForRecipe } = useFoodNutrition();

  const [copied, setCopied] = useState(false);
  const [links, setLinks] = useState<Record<number, FoodNutritionRow>>({});
  const [sheetIngredient, setSheetIngredient] = useState<{ index: number; name: string } | null>(null);

  const loadLinks = useCallback(async () => {
    if (!recipe) return;
    const result = await getLinksForRecipe(recipe.id);
    setLinks(result);
  }, [recipe?.id, getLinksForRecipe]);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  if (!recipe) {
    return (
      <View style={styles.notFound}>
        <AppText weight="semibold" color="textSecondary">Recipe not found.</AppText>
      </View>
    );
  }

  const timeLabel = formatCookTime(recipe.prep_minutes, recipe.cook_minutes);
  const rollup = rollupMacros(recipe.ingredients, links, recipe.servings);
  const prefix = rollup?.isPartial ? '~' : '';

  async function handleNutritionSave(data: FoodNutritionData) {
    if (!sheetIngredient) return;
    const existingId = links[sheetIngredient.index]?.id;
    const foodNutritionId = await upsert({ ...data, id: existingId });
    await linkIngredient(recipe!.id, sheetIngredient.index, foodNutritionId);
    await loadLinks();
    setSheetIngredient(null);
  }

  const handleCopy = async () => {
    const text = [
      recipe.title,
      `Serves ${recipe.servings} | ${recipe.calories_per_serve} cal | ${recipe.protein_per_serve_g}g protein | ${recipe.cook_method} | ${timeLabel}`,
      '',
      'Ingredients:',
      ...recipe.ingredients.map((i) => `- ${i.amount} ${i.item}`),
      '',
      'Method:',
      ...recipe.method_steps.map((s, idx) => `${idx + 1}. ${s}`),
    ].join('\n');
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={styles.container}>
      <GreenHeader>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back to Recipes"
          >
            <AppText weight="bold" color="onGreenSubtle" size="sm">‹ Recipes</AppText>
          </TouchableOpacity>
          <AppText weight="extrabold" color="onGreen" size="2xl" numberOfLines={2}>
            {recipe.title}
          </AppText>
          <View style={styles.pillRow}>
            {rollup ? (
              <>
                <View style={styles.pill}>
                  <AppText weight="bold" size="2xs" color="onGreen">
                    {prefix}{Math.round(rollup.perServe.cal)} kcal
                  </AppText>
                </View>
                <View style={styles.pill}>
                  <AppText weight="bold" size="2xs" color="onGreen">
                    P {prefix}{Math.round(rollup.perServe.protein_g)}g
                  </AppText>
                </View>
                <View style={styles.pill}>
                  <AppText weight="bold" size="2xs" color="onGreen">
                    C {prefix}{Math.round(rollup.perServe.carbs_g)}g
                  </AppText>
                </View>
                <View style={styles.pill}>
                  <AppText weight="bold" size="2xs" color="onGreen">
                    F {prefix}{Math.round(rollup.perServe.fat_g)}g
                  </AppText>
                </View>
              </>
            ) : (
              <>
                <View style={styles.pill}>
                  <AppText weight="bold" size="2xs" color="onGreen">
                    {recipe.calories_per_serve} kcal
                  </AppText>
                </View>
                <View style={styles.pill}>
                  <AppText weight="bold" size="2xs" color="onGreen">
                    P {recipe.protein_per_serve_g}g
                  </AppText>
                </View>
              </>
            )}
            <View style={styles.pill}>
              <AppText weight="bold" size="2xs" color="onGreen">Serves {recipe.servings}</AppText>
            </View>
            <View style={styles.pill}>
              <AppText weight="bold" size="2xs" color="onGreen">{timeLabel}</AppText>
            </View>
          </View>
        </View>
      </GreenHeader>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.section}>
          <CategoryHeader label="Ingredients" isOneoff={false} />
          <View style={styles.card}>
            {recipe.ingredients.map((ing, idx) => (
              <IngredientRow
                key={idx}
                ingredient={ing}
                nutrition={rollup?.contributions[idx] ?? null}
                onPress={() => setSheetIngredient({ index: idx, name: ing.item })}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.methodHeader}>
            <CategoryHeader label="Method" isOneoff={false} />
            <TouchableOpacity
              onPress={handleCopy}
              style={styles.copyBtn}
              accessibilityRole="button"
              accessibilityLabel="Copy recipe to clipboard"
            >
              <AppText weight="bold" color="onGreen" size="2xs">
                {copied ? 'Copied!' : '📋 Copy recipe'}
              </AppText>
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            <View style={styles.stepListWrapper}>
              <StepList steps={recipe.method_steps} />
            </View>
          </View>
        </View>
      </ScrollView>

      <FoodNutritionSheet
        visible={sheetIngredient !== null}
        ingredientName={sheetIngredient?.name ?? ''}
        existingEntry={sheetIngredient !== null ? (links[sheetIngredient.index] ?? null) : null}
        onSave={handleNutritionSave}
        onClose={() => setSheetIngredient(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cream },
  headerContent: { paddingBottom: spacing[1], gap: spacing[2] },
  backBtn: {
    paddingVertical: spacing[4], paddingRight: spacing[4],
    alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center',
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  pill: {
    backgroundColor: colors.headerPill,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  body: { flex: 1 },
  bodyContent: { paddingTop: spacing[2], paddingBottom: spacing[10], gap: spacing[4] },
  section: { gap: spacing[2], paddingHorizontal: spacing[4] },
  card: { backgroundColor: colors.card, borderRadius: radius.md, overflow: 'hidden' },
  methodHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  copyBtn: {
    backgroundColor: colors.green,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.xl,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepListWrapper: { padding: spacing[4] },
});
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "DayCard\|ProgressBar"
```

Expected: no new errors

- [ ] **Step 3: Run full suite**

```bash
npx jest --no-coverage
```

Expected: all tests passing

- [ ] **Step 4: Commit**

```bash
git add app/recipe/[id].tsx
git commit -m "feat: wire nutrition sheet into recipe detail, move stats to header pills"
```

---

## Task 8: `lib/exportContext.ts`

**Files:**
- Create: `lib/exportContext.ts`
- Create: `__tests__/lib/exportContext.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/lib/exportContext.test.ts
import { buildClaudeContext } from '../../lib/exportContext';

describe('buildClaudeContext', () => {
  const mockDb = {
    getFirstAsync: jest.fn(),
    getAllAsync: jest.fn(),
  };

  beforeEach(() => {
    mockDb.getFirstAsync.mockReset();
    mockDb.getAllAsync.mockReset();
    mockDb.getFirstAsync.mockImplementation((sql: string) => {
      if (sql.includes('weekly_plans')) {
        return Promise.resolve({ week_starting: '2026-05-18' });
      }
      return Promise.resolve(null);
    });
  });

  it('returns valid JSON with correct shape when no purchases', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);
    const result = await buildClaudeContext(mockDb as any, 'plan-1');
    const parsed = JSON.parse(result);
    expect(parsed.purchases).toEqual([]);
    expect(parsed.week_starting).toBe('2026-05-18');
    expect(typeof parsed.generated_at).toBe('string');
  });

  it('resolves nutrition from barcode_nutrition for purchases with a barcode', async () => {
    mockDb.getAllAsync.mockResolvedValue([{
      item_name: 'oat milk', brand: 'Vitasoy', product_name: 'Oat Milk Barista',
      store: 'Coles', qty_amount: 1000, qty_unit: 'mL', price: 2.80,
      is_sale: 0, barcode: '9310123456789',
    }]);
    mockDb.getFirstAsync.mockImplementation((sql: string) => {
      if (sql.includes('weekly_plans')) return Promise.resolve({ week_starting: '2026-05-18' });
      if (sql.includes('barcode_nutrition')) return Promise.resolve({
        cal_per_100g: 45, protein_per_100g: 1, carbs_per_100g: 4.5, fat_per_100g: 1.5,
      });
      return Promise.resolve(null);
    });
    const result = await buildClaudeContext(mockDb as any, 'plan-1');
    const parsed = JSON.parse(result);
    expect(parsed.purchases[0].nutrition.calories).toBe(45);
    expect(parsed.purchases[0].nutrition_basis).toBe('per_100g');
    expect(parsed.purchases[0].barcode).toBe('9310123456789');
  });

  it('falls back to food_nutrition lookup when no barcode', async () => {
    mockDb.getAllAsync.mockResolvedValue([{
      item_name: 'chicken breast', brand: 'Lilydale', product_name: null,
      store: 'Coles', qty_amount: 500, qty_unit: 'g', price: 12.50,
      is_sale: 0, barcode: null,
    }]);
    mockDb.getFirstAsync.mockImplementation((sql: string) => {
      if (sql.includes('weekly_plans')) return Promise.resolve({ week_starting: '2026-05-18' });
      if (sql.includes('food_nutrition')) return Promise.resolve({
        basis: 'per_100g', cal_per_basis: 165, protein_per_basis: 31,
        carbs_per_basis: 0, fat_per_basis: 3.6,
      });
      return Promise.resolve(null);
    });
    const result = await buildClaudeContext(mockDb as any, 'plan-1');
    const parsed = JSON.parse(result);
    expect(parsed.purchases[0].nutrition.calories).toBe(165);
    expect(parsed.purchases[0].nutrition_basis).toBe('per_100g');
  });

  it('omits nutrition key when no match found for a purchase', async () => {
    mockDb.getAllAsync.mockResolvedValue([{
      item_name: 'mystery herb', brand: null, product_name: null,
      store: 'Coles', qty_amount: null, qty_unit: null, price: 1.00,
      is_sale: 0, barcode: null,
    }]);
    // getFirstAsync returns null for everything except weekly_plans
    const result = await buildClaudeContext(mockDb as any, 'plan-1');
    const parsed = JSON.parse(result);
    expect(parsed.purchases[0].nutrition).toBeUndefined();
    expect(parsed.purchases[0].item).toBe('mystery herb');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/lib/exportContext.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../../lib/exportContext'`

- [ ] **Step 3: Create `lib/exportContext.ts`**

```typescript
// lib/exportContext.ts
import type { SQLiteDatabase } from 'expo-sqlite';

interface NutritionPayload {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface PurchaseEntry {
  item: string;
  brand: string | null;
  product: string | null;
  store: string;
  qty: string | null;
  price: number | null;
  is_sale: boolean;
  barcode: string | null;
  nutrition_basis?: string;
  nutrition?: NutritionPayload;
}

export async function buildClaudeContext(db: SQLiteDatabase, planId: string): Promise<string> {
  const plan = await db.getFirstAsync<{ week_starting: string }>(
    'SELECT week_starting FROM weekly_plans WHERE id = ?',
    [planId]
  );

  const purchases = await db.getAllAsync<{
    item_name: string;
    brand: string | null;
    product_name: string | null;
    store: string;
    qty_amount: number | null;
    qty_unit: string | null;
    price: number | null;
    is_sale: number;
    barcode: string | null;
  }>(
    `SELECT item_name, brand, product_name, store, qty_amount, qty_unit,
            price, is_sale, barcode
     FROM purchase_history WHERE plan_id = ? ORDER BY purchased_at ASC`,
    [planId]
  );

  const entries: PurchaseEntry[] = [];

  for (const p of purchases) {
    const qty = p.qty_amount != null && p.qty_unit != null
      ? `${p.qty_amount}${p.qty_unit}`
      : null;

    const entry: PurchaseEntry = {
      item: p.item_name,
      brand: p.brand,
      product: p.product_name,
      store: p.store,
      qty,
      price: p.price,
      is_sale: p.is_sale === 1,
      barcode: p.barcode,
    };

    let nutrition: NutritionPayload | undefined;
    let basis: string | undefined;

    if (p.barcode) {
      const bn = await db.getFirstAsync<{
        cal_per_100g: number;
        protein_per_100g: number;
        carbs_per_100g: number;
        fat_per_100g: number;
      }>(
        `SELECT cal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g
         FROM barcode_nutrition WHERE barcode = ?`,
        [p.barcode]
      );
      if (bn) {
        nutrition = {
          calories: bn.cal_per_100g,
          protein_g: bn.protein_per_100g,
          carbs_g: bn.carbs_per_100g,
          fat_g: bn.fat_per_100g,
        };
        basis = 'per_100g';
      }
    }

    if (!nutrition) {
      const fn = await db.getFirstAsync<{
        basis: string;
        cal_per_basis: number;
        protein_per_basis: number;
        carbs_per_basis: number;
        fat_per_basis: number;
      }>(
        `SELECT basis, cal_per_basis, protein_per_basis, carbs_per_basis, fat_per_basis
         FROM food_nutrition
         WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?))
           AND COALESCE(brand, '') = COALESCE(?, '')
           AND COALESCE(product_name, '') = COALESCE(?, '')
         ORDER BY updated_at DESC
         LIMIT 1`,
        [p.item_name, p.brand, p.product_name]
      );
      if (fn) {
        nutrition = {
          calories: fn.cal_per_basis,
          protein_g: fn.protein_per_basis,
          carbs_g: fn.carbs_per_basis,
          fat_g: fn.fat_per_basis,
        };
        basis = fn.basis;
      }
    }

    if (nutrition) {
      entry.nutrition = nutrition;
      entry.nutrition_basis = basis;
    }

    entries.push(entry);
  }

  return JSON.stringify({
    generated_at: new Date().toISOString().split('T')[0],
    week_starting: plan?.week_starting ?? '',
    purchases: entries,
  }, null, 2);
}
```

- [ ] **Step 4: Run exportContext tests**

```bash
npx jest __tests__/lib/exportContext.test.ts --no-coverage
```

Expected: PASS — 4 tests passing

- [ ] **Step 5: Run full suite**

```bash
npx jest --no-coverage
```

Expected: all tests passing

- [ ] **Step 6: Commit**

```bash
git add lib/exportContext.ts __tests__/lib/exportContext.test.ts
git commit -m "feat: add buildClaudeContext export utility"
```

---

## Task 9: Update `app/settings.tsx`

**Files:**
- Modify: `app/settings.tsx`

- [ ] **Step 1: Update `app/settings.tsx`**

Replace the full file content:

```typescript
// app/settings.tsx
import { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { GreenHeader } from '../components/ui/GreenHeader';
import { AppText } from '../components/ui/AppText';
import { Pill } from '../components/ui/Pill';
import { Divider } from '../components/ui/Divider';
import { Row } from '../components/ui/Row';
import { useImport } from '../hooks/useImport';
import { useBackup } from '../hooks/useBackup';
import { usePlan } from '../hooks/usePlan';
import { useDb } from '../providers/DatabaseProvider';
import { buildClaudeContext } from '../lib/exportContext';
import { colors, spacing, radius } from '../constants/tokens';

export default function SettingsScreen() {
  const { importPlan, status: importStatus } = useImport(() => router.back());
  const { exportBackup, restoreBackup, status: backupStatus } = useBackup(() => router.back());
  const { plan } = usePlan();
  const db = useDb();
  const [restorePreview, setRestorePreview] = useState<{
    summary: string;
    exportedDate: string;
    execute: () => void;
  } | null>(null);
  const [contextCopied, setContextCopied] = useState(false);

  async function handleRestore() {
    const preview = await restoreBackup();
    if (preview) setRestorePreview(preview);
  }

  function confirmRestore() {
    if (!restorePreview) return;
    restorePreview.execute();
    setRestorePreview(null);
  }

  async function handleCopyContext() {
    if (!plan) return;
    const json = await buildClaudeContext(db, plan.row.id);
    await Clipboard.setStringAsync(json);
    setContextCopied(true);
    setTimeout(() => setContextCopied(false), 2000);
  }

  return (
    <View style={styles.container}>
      <GreenHeader>
        <Row justify="space-between" align="center">
          <AppText weight="extrabold" size="xl" color="onGreen">Settings</AppText>
          <Pill label="✕ Close" onPress={() => router.back()} variant="green" />
        </Row>
      </GreenHeader>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Import */}
        <View style={styles.section}>
          <AppText weight="bold" size="lg">Import Plan</AppText>
          <AppText color="textSecondary">
            Replace the active shopping list with a new weekly plan JSON.
            Your recipe library is preserved.
          </AppText>
          <Pill label="📂 Import weekly plan" onPress={importPlan} />
          {importStatus.type === 'success' && (
            <AppText color="green">{importStatus.message}</AppText>
          )}
          {importStatus.type === 'error' && (
            <View style={styles.errorBlock}>
              <AppText color="terracotta">{importStatus.message}</AppText>
              <Pill label="Try again" onPress={importPlan} />
            </View>
          )}
        </View>

        <Divider />

        {/* Claude Context */}
        <View style={styles.section}>
          <AppText weight="bold" size="lg">Claude Context</AppText>
          <AppText color="textSecondary">
            Copy this week's purchases with nutrition data as JSON to paste into Claude.
          </AppText>
          <Pill
            label={contextCopied ? '✓ Copied!' : '🤖 Copy context for Claude'}
            onPress={handleCopyContext}
            style={!plan ? styles.dimmed : undefined}
          />
          {!plan && (
            <AppText size="sm" color="textTertiary">No active plan — import a plan first.</AppText>
          )}
        </View>

        <Divider />

        {/* Export */}
        <View style={styles.section}>
          <AppText weight="bold" size="lg">Export Backup</AppText>
          <AppText color="textSecondary">
            Save all your data — recipes, plans, and shopping history — to a JSON file.
          </AppText>
          <Pill label="📤 Export backup" onPress={exportBackup} />
          {backupStatus.type === 'success' && (
            <AppText color="green">{backupStatus.message}</AppText>
          )}
        </View>

        <Divider />

        {/* Restore */}
        <View style={styles.section}>
          <AppText weight="bold" size="lg">Restore Backup</AppText>
          <AppText color="textSecondary">
            Replace all data from a backup file. Cannot be undone.
          </AppText>
          {!restorePreview ? (
            <Pill label="📥 Restore from backup" onPress={handleRestore} />
          ) : (
            <View style={styles.restorePreviewCard}>
              <AppText>
                Backup from <AppText weight="bold">{restorePreview.exportedDate}</AppText>
                {' · '}{restorePreview.summary}
              </AppText>
              <AppText color="terracotta">This will replace all your current data.</AppText>
              <Row gap={3}>
                <Pill label="Restore" onPress={confirmRestore} variant="green" />
                <Pill label="Cancel" onPress={() => setRestorePreview(null)} />
              </Row>
            </View>
          )}
          {backupStatus.type === 'error' && (
            <AppText color="terracotta">{backupStatus.message}</AppText>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  scrollContent: {
    padding: spacing[4],
    gap: spacing[5],
  },
  section: {
    gap: spacing[3],
  },
  errorBlock: {
    gap: spacing[1],
  },
  dimmed: {
    opacity: 0.45,
  },
  restorePreviewCard: {
    gap: spacing[3],
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing[4],
  },
});
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "DayCard\|ProgressBar"
```

Expected: no new errors

- [ ] **Step 3: Run full suite**

```bash
npx jest --no-coverage
```

Expected: all tests passing (90+ tests)

- [ ] **Step 4: Commit**

```bash
git add app/settings.tsx
git commit -m "feat: add Copy context for Claude button to settings"
```

---

## Final verification

- [ ] **Run full test suite one last time**

```bash
npx jest --no-coverage
```

Expected: all tests passing
