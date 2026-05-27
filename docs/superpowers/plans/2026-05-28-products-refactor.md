# Products Model Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `food_nutrition` + `ingredient_nutrition_link` with a normalised `products` table referenced by id from recipe ingredients and `purchase_history`, while keeping all existing features (recipe macro rollups, ingredient suggestions, price history, review flow, backup) working.

**Architecture:** Schema, types, and the new `useProducts` hook land first. Each consumer hook migrates next (each with its own tests). UI components rewire afterward. `useBackup` is brought current at the end. Compilation will break partway through and recover once all consumers are migrated — acceptable because the user is on a fresh-install workflow. Final task verifies the whole tree compiles and tests pass.

**Tech Stack:** Expo SDK 56, React Native, expo-sqlite, Jest + @testing-library/react-native.

**Spec:** [2026-05-28-products-refactor-design.md](../specs/2026-05-28-products-refactor-design.md)

---

## File Structure

**Create:**
- `hooks/useProducts.ts`
- `__tests__/hooks/useProducts.test.ts`

**Modify:**
- `lib/db/schema.ts`
- `lib/db/migrations.ts`
- `types/db.ts`
- `meal_plan.types.ts`
- `lib/rollupMacros.ts`
- `lib/suggestions/types.ts`
- `lib/suggestions/ranking.ts`
- `hooks/usePurchaseHistory.ts`
- `hooks/usePriceHistory.ts`
- `hooks/useIngredientSuggestions.ts`
- `hooks/useRecipeIngredients.ts`
- `hooks/useBackup.ts`
- `app/recipe/[id].tsx`
- `components/IngredientSheet.tsx`
- `components/ReviewItemSheet.tsx`
- `components/AddPriceSheet.tsx`
- `components/PriceHistoryChart.tsx`
- `components/SuggestionDropdown.tsx`
- `__tests__/lib/db/migrations.test.ts`
- `__tests__/hooks/usePurchaseHistory.test.ts`
- `__tests__/hooks/usePriceHistory.test.ts`
- `__tests__/hooks/useIngredientSuggestions.test.ts`
- `__tests__/hooks/useRecipeIngredients.test.ts`
- `__tests__/screens/recipe-detail.test.tsx`
- `__tests__/components/IngredientSheet.test.tsx`
- `__tests__/lib/exportContext.test.ts` (if it references food_nutrition)

**Delete:**
- `hooks/useFoodNutrition.ts`

---

## Task 1: Schema and migrations

**Files:**
- Modify: `lib/db/schema.ts`
- Modify: `lib/db/migrations.ts`
- Modify: `__tests__/lib/db/migrations.test.ts`

- [ ] **Step 1: Update `lib/db/schema.ts`**

Replace the `food_nutrition` block and delete the `ingredient_nutrition_link` block. Update `purchase_history` to use `product_id` instead of `brand`/`product_name`. Add `idx_products_item_name`.

Full new `SCHEMA_SQL` contents (replaces the whole file's exported string):

```ts
export const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS recipes (
    id                  TEXT PRIMARY KEY,
    title               TEXT NOT NULL,
    meal_type           TEXT NOT NULL,
    servings            INTEGER NOT NULL,
    calories_per_serve  INTEGER NOT NULL,
    protein_per_serve_g INTEGER NOT NULL,
    cook_method         TEXT NOT NULL,
    prep_minutes        INTEGER NOT NULL,
    cook_minutes        INTEGER NOT NULL,
    ingredients_json    TEXT NOT NULL,
    method_steps_json   TEXT NOT NULL,
    is_favourite        INTEGER DEFAULT 0,
    source              TEXT DEFAULT 'imported',
    notes               TEXT,
    created_at          TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS weekly_plans (
    id               TEXT PRIMARY KEY,
    week_starting    TEXT NOT NULL,
    is_active        INTEGER DEFAULT 0,
    meta_json        TEXT NOT NULL,
    strategy_json    TEXT NOT NULL,
    days_json        TEXT NOT NULL,
    batch_plan_json  TEXT NOT NULL,
    created_at       TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shopping_items (
    id               TEXT PRIMARY KEY,
    plan_id          TEXT NOT NULL REFERENCES weekly_plans(id),
    category         TEXT NOT NULL,
    category_order   INTEGER NOT NULL,
    item_order       INTEGER NOT NULL,
    name             TEXT NOT NULL,
    qty              TEXT NOT NULL,
    estimated_price  REAL NOT NULL,
    is_oneoff        INTEGER DEFAULT 0,
    note             TEXT,
    is_checked       INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS products (
    id                TEXT PRIMARY KEY,
    brand             TEXT NOT NULL,
    product_name      TEXT NOT NULL,
    item_name         TEXT NOT NULL,
    basis             TEXT NOT NULL DEFAULT 'per_100g'
                        CHECK (basis IN ('per_100g', 'per_100mL', 'per_unit')),
    cal_per_basis     REAL,
    protein_per_basis REAL,
    carbs_per_basis   REAL,
    fat_per_basis     REAL,
    updated_at        TEXT NOT NULL,
    UNIQUE (brand, product_name)
  );

  CREATE INDEX IF NOT EXISTS idx_products_item_name
    ON products(item_name);

  CREATE TABLE IF NOT EXISTS purchase_history (
    id              TEXT PRIMARY KEY,
    plan_id         TEXT REFERENCES weekly_plans(id),
    item_name       TEXT NOT NULL,
    store_id        TEXT REFERENCES stores(id),
    product_id      TEXT REFERENCES products(id),
    qty_amount      REAL,
    qty_unit        TEXT CHECK (qty_unit IN ('g', 'kg', 'mL', 'L', 'units')),
    price           REAL,
    is_sale         INTEGER NOT NULL DEFAULT 0,
    barcode         TEXT,
    purchased_at    TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'confirmed'
  );

  CREATE INDEX IF NOT EXISTS idx_purchase_history_item_name
    ON purchase_history(item_name);

  CREATE INDEX IF NOT EXISTS idx_purchase_history_barcode
    ON purchase_history(barcode);

  CREATE TABLE IF NOT EXISTS barcode_stores (
    barcode     TEXT NOT NULL,
    store       TEXT NOT NULL,
    first_seen  TEXT NOT NULL,
    PRIMARY KEY (barcode, store)
  );

  CREATE TABLE IF NOT EXISTS barcode_nutrition (
    barcode          TEXT PRIMARY KEY,
    brand_name       TEXT,
    item_name        TEXT NOT NULL,
    cal_per_100g     REAL NOT NULL,
    protein_per_100g REAL NOT NULL,
    carbs_per_100g   REAL NOT NULL,
    fat_per_100g     REAL NOT NULL,
    scanned_at       TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stores (
    id          TEXT PRIMARY KEY,
    chain       TEXT NOT NULL,
    branch      TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS store_aisles (
    id          TEXT PRIMARY KEY,
    store_id    TEXT NOT NULL REFERENCES stores(id),
    aisle_label TEXT NOT NULL,
    sort_order  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS item_aisle_map (
    id          TEXT PRIMARY KEY,
    store_id    TEXT NOT NULL REFERENCES stores(id),
    barcode     TEXT,
    item_name   TEXT NOT NULL,
    aisle_id    TEXT NOT NULL REFERENCES store_aisles(id),
    updated_at  TEXT NOT NULL
  );
`;
```

- [ ] **Step 2: Update `lib/db/migrations.ts`**

Append the version-6 hygiene marker after the existing `if (version < 5)` block, before the closing brace of `runMigrations`:

```ts
  if (version < 6) {
    await db.execAsync('PRAGMA user_version = 6');
  }
```

No data migration is performed (fresh-install workflow).

- [ ] **Step 3: Update `__tests__/lib/db/migrations.test.ts`**

The test at line 40-45 currently asserts `food_nutrition` and `ingredient_nutrition_link` are in the schema. Replace with assertions for `products` and that the old tables are absent.

```ts
  it('calls execAsync with SQL containing the products table', async () => {
    await runMigrations(mockDb as any);
    const sql: string = mockDb.execAsync.mock.calls[0][0];
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS products');
    expect(sql).toContain('UNIQUE (brand, product_name)');
  });

  it('does not declare food_nutrition or ingredient_nutrition_link', async () => {
    await runMigrations(mockDb as any);
    const sql: string = mockDb.execAsync.mock.calls[0][0];
    expect(sql).not.toContain('food_nutrition');
    expect(sql).not.toContain('ingredient_nutrition_link');
  });

  it('declares purchase_history with product_id and no brand/product_name', async () => {
    await runMigrations(mockDb as any);
    const sql: string = mockDb.execAsync.mock.calls[0][0];
    const phBlock = sql.split('CREATE TABLE IF NOT EXISTS purchase_history')[1].split('CREATE TABLE')[0];
    expect(phBlock).toContain('product_id');
    expect(phBlock).not.toMatch(/^\s*brand\s+TEXT/m);
    expect(phBlock).not.toMatch(/^\s*product_name\s+TEXT/m);
  });

  it('runs version-6 migration on a v5 database', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ user_version: 5 }]);
    await runMigrations(mockDb as any);
    const allSql = mockDb.execAsync.mock.calls.map((c: any[]) => c[0]).join('\n');
    expect(allSql).toContain('user_version = 6');
  });
```

Remove the now-irrelevant `food_nutrition` / `ingredient_nutrition_link` assertions in the existing test at line 40-45.

- [ ] **Step 4: Run migration tests**

Run: `npx jest __tests__/lib/db/migrations.test.ts -v`
Expected: PASS for new assertions; existing tests for v1-v5 still pass.

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.ts lib/db/migrations.ts __tests__/lib/db/migrations.test.ts
git commit -m "refactor(schema): introduce products table; drop food_nutrition + ingredient_nutrition_link"
```

---

## Task 2: Type updates

**Files:**
- Modify: `types/db.ts`
- Modify: `meal_plan.types.ts`

- [ ] **Step 1: Update `types/db.ts`**

Replace the existing `FoodNutritionRow` block and the existing `PurchaseHistoryRow` block:

```ts
export interface PurchaseHistoryRow {
  id: string;
  plan_id: string | null;
  item_name: string;
  store_id: string | null;
  product_id: string | null;
  qty_amount: number | null;
  qty_unit: QtyUnit | null;
  price: number | null;
  is_sale: 0 | 1;
  barcode: string | null;
  purchased_at: string;
  status: 'pending' | 'confirmed';
}

export interface PurchaseHistoryRowWithProduct extends PurchaseHistoryRow {
  brand: string | null;          // null when product_id is null
  product_name: string | null;
}

export interface ProductRow {
  id: string;
  brand: string;
  product_name: string;
  item_name: string;
  basis: 'per_100g' | 'per_100mL' | 'per_unit';
  cal_per_basis: number | null;
  protein_per_basis: number | null;
  carbs_per_basis: number | null;
  fat_per_basis: number | null;
  updated_at: string;
}
```

Remove the existing `FoodNutritionRow` block at the bottom of the file.

- [ ] **Step 2: Update `meal_plan.types.ts`**

Modify the `Ingredient` interface (around line 102):

```ts
export interface Ingredient {
  item: string;
  amount: Amount;
  product_id?: string;
}
```

- [ ] **Step 3: Run type-check**

Run: `npx tsc --noEmit`
Expected: FAILS in many places — every consumer that imports `FoodNutritionRow` and every site that reads `purchase_history.brand`/`product_name` directly. These are addressed in subsequent tasks. Take note of the file list — it's the consumer hit list.

- [ ] **Step 4: Commit**

```bash
git add types/db.ts meal_plan.types.ts
git commit -m "refactor(types): ProductRow, PurchaseHistoryRow.product_id, Ingredient.product_id"
```

(Expected: tree no longer type-checks. Subsequent tasks fix each consumer.)

---

## Task 3: `useProducts` hook + tests

**Files:**
- Create: `hooks/useProducts.ts`
- Create: `__tests__/hooks/useProducts.test.ts`

- [ ] **Step 1: Write `__tests__/hooks/useProducts.test.ts`**

```ts
import { renderHook } from '@testing-library/react-native';
import { useProducts } from '../../hooks/useProducts';
import type { Ingredient } from '../../meal_plan.types';
import type { ProductRow } from '../../types/db';

const mockDb = {
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
  runAsync: jest.fn(),
};

jest.mock('../../providers/DatabaseProvider', () => ({
  useDb: () => mockDb,
}));

jest.mock('../../lib/uuid', () => ({
  generateId: jest.fn(() => 'generated-id'),
}));

beforeEach(() => {
  mockDb.getFirstAsync.mockReset();
  mockDb.getAllAsync.mockReset();
  mockDb.runAsync.mockReset();
});

describe('useProducts.upsert', () => {
  it('inserts a new row when no match exists; returns the generated id', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useProducts());
    const id = await result.current.upsert({
      brand: 'Coles',
      product_name: 'Chicken Breast Fillets',
      item_name: 'chicken breast',
      basis: 'per_100g',
      cal_per_basis: 165,
      protein_per_basis: 31,
      carbs_per_basis: 0,
      fat_per_basis: 3.6,
    });
    expect(id).toBe('generated-id');
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO products'),
      expect.arrayContaining(['generated-id', 'Coles', 'Chicken Breast Fillets']),
    );
  });

  it('updates the existing row when (brand, product_name) matches; returns its id', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ id: 'existing-id' });
    const { result } = renderHook(() => useProducts());
    const id = await result.current.upsert({
      brand: 'Coles',
      product_name: 'Chicken Breast Fillets',
      item_name: 'chicken breast',
      basis: 'per_100g',
      cal_per_basis: 165,
      protein_per_basis: 31,
      carbs_per_basis: 0,
      fat_per_basis: 3.6,
    });
    expect(id).toBe('existing-id');
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE products'),
      expect.arrayContaining(['chicken breast', 'per_100g', 165, 31, 0, 3.6, expect.any(String), 'existing-id']),
    );
  });

  it('matches by exact brand and product_name (case-sensitive)', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useProducts());
    await result.current.upsert({
      brand: '',
      product_name: 'banana',
      item_name: 'banana',
      basis: 'per_unit',
      cal_per_basis: 105,
      protein_per_basis: 1.3,
      carbs_per_basis: 27,
      fat_per_basis: 0.4,
    });
    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
      'SELECT id FROM products WHERE brand = ? AND product_name = ?',
      ['', 'banana'],
    );
  });
});

describe('useProducts.getById', () => {
  it('returns the row when found', async () => {
    const row: ProductRow = {
      id: 'p1', brand: 'Coles', product_name: 'Eggs', item_name: 'eggs',
      basis: 'per_unit', cal_per_basis: 70, protein_per_basis: 6,
      carbs_per_basis: 0, fat_per_basis: 5, updated_at: '2026-01-01T00:00:00Z',
    };
    mockDb.getFirstAsync.mockResolvedValueOnce(row);
    const { result } = renderHook(() => useProducts());
    expect(await result.current.getById('p1')).toEqual(row);
  });

  it('returns null when no row matches', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useProducts());
    expect(await result.current.getById('missing')).toBeNull();
  });
});

describe('useProducts.getByKey', () => {
  it('queries by (brand, product_name)', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useProducts());
    await result.current.getByKey('Coles', 'Chicken');
    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
      'SELECT * FROM products WHERE brand = ? AND product_name = ?',
      ['Coles', 'Chicken'],
    );
  });
});

describe('useProducts.getNutritionForIngredients', () => {
  it('returns {} when no ingredients have product_id', async () => {
    const ingredients: Ingredient[] = [
      { item: 'salt', amount: { kind: 'measured', value: 5, unit: 'g' } },
    ];
    const { result } = renderHook(() => useProducts());
    expect(await result.current.getNutritionForIngredients(ingredients)).toEqual({});
    expect(mockDb.getAllAsync).not.toHaveBeenCalled();
  });

  it('returns rows keyed by ingredient index', async () => {
    const row1: ProductRow = {
      id: 'p1', brand: 'Coles', product_name: 'Eggs', item_name: 'eggs',
      basis: 'per_unit', cal_per_basis: 70, protein_per_basis: 6,
      carbs_per_basis: 0, fat_per_basis: 5, updated_at: '2026-01-01T00:00:00Z',
    };
    const row2: ProductRow = {
      id: 'p2', brand: '', product_name: 'banana', item_name: 'banana',
      basis: 'per_unit', cal_per_basis: 105, protein_per_basis: 1.3,
      carbs_per_basis: 27, fat_per_basis: 0.4, updated_at: '2026-01-01T00:00:00Z',
    };
    mockDb.getAllAsync.mockResolvedValueOnce([row1, row2]);
    const ingredients: Ingredient[] = [
      { item: 'eggs',   amount: { kind: 'measured', value: 2, unit: 'unit' }, product_id: 'p1' },
      { item: 'salt',   amount: { kind: 'measured', value: 5, unit: 'g' } },
      { item: 'banana', amount: { kind: 'measured', value: 1, unit: 'unit' }, product_id: 'p2' },
    ];
    const { result } = renderHook(() => useProducts());
    const out = await result.current.getNutritionForIngredients(ingredients);
    expect(out).toEqual({ 0: row1, 2: row2 });
  });

  it('omits indices whose product_id does not resolve', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([]);
    const ingredients: Ingredient[] = [
      { item: 'eggs', amount: { kind: 'measured', value: 1, unit: 'unit' }, product_id: 'missing' },
    ];
    const { result } = renderHook(() => useProducts());
    expect(await result.current.getNutritionForIngredients(ingredients)).toEqual({});
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/hooks/useProducts.test.ts`
Expected: FAIL — `useProducts` not found.

- [ ] **Step 3: Create `hooks/useProducts.ts`**

```ts
import { useCallback } from 'react';
import { useDb } from '../providers/DatabaseProvider';
import { generateId } from '../lib/uuid';
import type { ProductRow } from '../types/db';
import type { Ingredient } from '../meal_plan.types';

export interface ProductInput {
  brand: string;
  product_name: string;
  item_name: string;
  basis: 'per_100g' | 'per_100mL' | 'per_unit';
  cal_per_basis: number | null;
  protein_per_basis: number | null;
  carbs_per_basis: number | null;
  fat_per_basis: number | null;
}

export function useProducts() {
  const db = useDb();

  const upsert = useCallback(async (input: ProductInput): Promise<string> => {
    const now = new Date().toISOString();
    const existing = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM products WHERE brand = ? AND product_name = ?',
      [input.brand, input.product_name],
    );
    if (existing) {
      await db.runAsync(
        `UPDATE products
         SET item_name = ?, basis = ?, cal_per_basis = ?, protein_per_basis = ?,
             carbs_per_basis = ?, fat_per_basis = ?, updated_at = ?
         WHERE id = ?`,
        [input.item_name, input.basis,
         input.cal_per_basis, input.protein_per_basis,
         input.carbs_per_basis, input.fat_per_basis, now, existing.id],
      );
      return existing.id;
    }
    const id = generateId();
    await db.runAsync(
      `INSERT INTO products
         (id, brand, product_name, item_name, basis,
          cal_per_basis, protein_per_basis, carbs_per_basis, fat_per_basis, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.brand, input.product_name, input.item_name, input.basis,
       input.cal_per_basis, input.protein_per_basis,
       input.carbs_per_basis, input.fat_per_basis, now],
    );
    return id;
  }, [db]);

  const getById = useCallback(async (id: string): Promise<ProductRow | null> => {
    const row = await db.getFirstAsync<ProductRow>(
      'SELECT * FROM products WHERE id = ?',
      [id],
    );
    return row ?? null;
  }, [db]);

  const getByKey = useCallback(async (brand: string, product_name: string): Promise<ProductRow | null> => {
    const row = await db.getFirstAsync<ProductRow>(
      'SELECT * FROM products WHERE brand = ? AND product_name = ?',
      [brand, product_name],
    );
    return row ?? null;
  }, [db]);

  const getNutritionForIngredients = useCallback(
    async (ingredients: Ingredient[]): Promise<Record<number, ProductRow>> => {
      const idsByIndex: Array<[number, string]> = [];
      ingredients.forEach((ing, i) => {
        if (typeof ing.product_id === 'string') idsByIndex.push([i, ing.product_id]);
      });
      if (idsByIndex.length === 0) return {};

      const placeholders = idsByIndex.map(() => '?').join(',');
      const rows = await db.getAllAsync<ProductRow>(
        `SELECT * FROM products WHERE id IN (${placeholders})`,
        idsByIndex.map(([_, id]) => id),
      );
      const byId = new Map(rows.map(r => [r.id, r]));
      const result: Record<number, ProductRow> = {};
      for (const [index, id] of idsByIndex) {
        const row = byId.get(id);
        if (row) result[index] = row;
      }
      return result;
    },
    [db],
  );

  return { upsert, getById, getByKey, getNutritionForIngredients };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/hooks/useProducts.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/useProducts.ts __tests__/hooks/useProducts.test.ts
git commit -m "feat(useProducts): hook with upsert / getById / getByKey / getNutritionForIngredients"
```

---

## Task 4: `usePurchaseHistory` — wire `product_id`

**Files:**
- Modify: `hooks/usePurchaseHistory.ts`
- Modify: `__tests__/hooks/usePurchaseHistory.test.ts`

- [ ] **Step 1: Update the test file with the new shape**

Read [__tests__/hooks/usePurchaseHistory.test.ts](__tests__/hooks/usePurchaseHistory.test.ts) — any test row that uses `brand` or `product_name` columns on a purchase_history row needs to use `product_id` instead (and a separate test that the joined methods return `brand`/`product_name` from the products row).

Adjust mocks so `getLatestForItem` joins are reflected. Example pattern:

```ts
// Before:
// mockDb.getAllAsync.mockResolvedValueOnce([
//   { id: 'r1', brand: 'Coles', product_name: 'X', ... }
// ]);

// After (join returns enriched row):
mockDb.getAllAsync.mockResolvedValueOnce([
  { id: 'r1', product_id: 'p1', brand: 'Coles', product_name: 'X', /* other ph fields */ }
]);
```

Add a new test:

```ts
it('addRecord stores product_id and not brand/product_name', async () => {
  mockDb.getFirstAsync.mockResolvedValue({ id: 'store-1' });  // resolveOrCreateStore
  const { result } = renderHook(() => usePurchaseHistory('plan-1'));
  await result.current.addRecord({
    plan_id: 'plan-1',
    item_name: 'chicken',
    store: 'Coles',
    product_id: 'p1',
    qty_amount: 500,
    qty_unit: 'g',
    price: 12.50,
    is_sale: 0,
    barcode: null,
    purchased_at: '2026-05-28T00:00:00Z',
  });
  expect(mockDb.runAsync).toHaveBeenCalledWith(
    expect.stringMatching(/INSERT INTO purchase_history[\s\S]*product_id/),
    expect.arrayContaining(['p1']),
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/hooks/usePurchaseHistory.test.ts`
Expected: FAILs — types mismatch and SQL still references brand/product_name.

- [ ] **Step 3: Update `hooks/usePurchaseHistory.ts`**

Replace `AddPurchaseData`:

```ts
export interface AddPurchaseData {
  plan_id: string | null;
  item_name: string;
  store: string;
  branch?: string;
  product_id: string | null;
  qty_amount: number | null;
  qty_unit: QtyUnit | null;
  price: number | null;
  is_sale: 0 | 1;
  barcode: string | null;
  purchased_at: string;
}
```

Update the `SELECT * FROM purchase_history WHERE ...` queries at lines 50-58 to include the products join:

```ts
const PH_WITH_PRODUCT_SQL = `
  SELECT ph.*, p.brand AS brand, p.product_name AS product_name
  FROM purchase_history ph
  LEFT JOIN products p ON p.id = ph.product_id
`;
```

Replace `load`:

```ts
const load = useCallback(async () => {
  if (!planId) {
    setRecords([]); setPendingRecords([]); setLoading(false); return;
  }
  const [confirmed, pending] = await Promise.all([
    db.getAllAsync<PurchaseHistoryRowWithProduct>(
      `${PH_WITH_PRODUCT_SQL} WHERE ph.plan_id = ? AND ph.status = 'confirmed' ORDER BY ph.purchased_at DESC`,
      [planId],
    ),
    db.getAllAsync<PurchaseHistoryRowWithProduct>(
      `${PH_WITH_PRODUCT_SQL} WHERE ph.plan_id = ? AND ph.status = 'pending' ORDER BY ph.purchased_at ASC`,
      [planId],
    ),
  ]);
  setRecords(confirmed);
  setPendingRecords(pending);
  setLoading(false);
}, [planId, db]);
```

The state types update from `PurchaseHistoryRow[]` to `PurchaseHistoryRowWithProduct[]`.

Replace `addRecord` INSERT statement:

```ts
const addRecord = useCallback(async (
  data: AddPurchaseData,
  status: 'pending' | 'confirmed' = 'confirmed',
) => {
  const id = generateId();
  const storeId = await resolveOrCreateStore(db, data.store, data.branch ?? '');
  await db.runAsync(
    `INSERT INTO purchase_history
       (id, plan_id, item_name, store_id, product_id,
        qty_amount, qty_unit, price, is_sale, barcode, purchased_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.plan_id, data.item_name, storeId, data.product_id,
     data.qty_amount, data.qty_unit, data.price,
     data.is_sale, data.barcode, data.purchased_at, status],
  );
  await load();
}, [db, load]);
```

Replace `updatePending`:

```ts
const updatePending = useCallback(async (id: string, data: AddPurchaseData) => {
  const storeId = await resolveOrCreateStore(db, data.store, data.branch ?? '');
  await db.runAsync(
    `UPDATE purchase_history
     SET item_name = ?, store_id = ?, product_id = ?,
         qty_amount = ?, qty_unit = ?, price = ?, is_sale = ?,
         barcode = ?, purchased_at = ?
     WHERE id = ? AND status = 'pending'`,
    [data.item_name, storeId, data.product_id,
     data.qty_amount, data.qty_unit, data.price, data.is_sale,
     data.barcode, data.purchased_at, id],
  );
  await load();
}, [db, load]);
```

Replace `getLatestForItem`:

```ts
const getLatestForItem = useCallback(async (itemName: string): Promise<PurchaseHistoryRowWithProduct | null> => {
  const rows = await db.getAllAsync<PurchaseHistoryRowWithProduct>(
    `${PH_WITH_PRODUCT_SQL}
     WHERE LOWER(ph.item_name) = LOWER(?) AND ph.is_sale = 0 AND ph.status = 'confirmed'
     ORDER BY ph.purchased_at DESC LIMIT 1`,
    [itemName],
  );
  if (rows.length > 0) return rows[0];
  const saleRows = await db.getAllAsync<PurchaseHistoryRowWithProduct>(
    `${PH_WITH_PRODUCT_SQL}
     WHERE LOWER(ph.item_name) = LOWER(?) AND ph.status = 'confirmed'
     ORDER BY ph.purchased_at DESC LIMIT 1`,
    [itemName],
  );
  return saleRows[0] ?? null;
}, [db]);
```

Replace `getLatestForBarcode`:

```ts
const getLatestForBarcode = useCallback(async (barcode: string): Promise<PurchaseHistoryRowWithProduct | null> => {
  const rows = await db.getAllAsync<PurchaseHistoryRowWithProduct>(
    `${PH_WITH_PRODUCT_SQL}
     WHERE ph.barcode = ? AND ph.status = 'confirmed'
     ORDER BY ph.purchased_at DESC LIMIT 1`,
    [barcode],
  );
  return rows[0] ?? null;
}, [db]);
```

Update the import line:
```ts
import type { PurchaseHistoryRowWithProduct, QtyUnit } from '../types/db';
```
(and update the state types and return signatures throughout.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/hooks/usePurchaseHistory.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/usePurchaseHistory.ts __tests__/hooks/usePurchaseHistory.test.ts
git commit -m "refactor(usePurchaseHistory): use product_id; join products on read"
```

---

## Task 5: `usePriceHistory` — `productId` signature

**Files:**
- Modify: `hooks/usePriceHistory.ts`
- Modify: `__tests__/hooks/usePriceHistory.test.ts`

- [ ] **Step 1: Update the test file**

Replace the two-arg signature usages:

```ts
it('returns empty array when productId is null', async () => {
  const { result } = renderHook(() => usePriceHistory(null));
  await waitFor(() => expect(result.current.points).toEqual([]));
  expect(mockDb.getAllAsync).not.toHaveBeenCalled();
});

it('queries by product_id', async () => {
  mockDb.getAllAsync.mockResolvedValue([makeRow()]);
  const { result } = renderHook(() => usePriceHistory('p1'));
  await waitFor(() => expect(result.current.points).toHaveLength(1));
  expect(mockDb.getAllAsync).toHaveBeenCalledWith(
    expect.stringContaining('ph.product_id = ?'),
    ['p1'],
  );
});
```

Update `makeRow` helper: drop `brand`/`product_name` from the row literal; everything else stays.

Update remaining tests that called `usePriceHistory('Brand', 'Product')` → `usePriceHistory('p1')`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/hooks/usePriceHistory.test.ts`
Expected: FAIL — signature mismatch.

- [ ] **Step 3: Update `hooks/usePriceHistory.ts`**

Full replacement:

```ts
import { useState, useEffect, useCallback } from 'react';
import { useDb } from '../providers/DatabaseProvider';
import { normalisePrice } from '../lib/normalisePrice';
import type { PricePoint, PurchaseHistoryRow, QtyUnit } from '../types/db';

type PurchaseWithChain = PurchaseHistoryRow & { chain: string };

export function usePriceHistory(
  productId: string | null,
): { points: PricePoint[]; reload: () => void } {
  const db = useDb();
  const [points, setPoints] = useState<PricePoint[]>([]);

  const load = useCallback(async () => {
    if (!productId) {
      setPoints([]);
      return;
    }
    const rows = await db.getAllAsync<PurchaseWithChain>(
      `SELECT ph.*, s.chain
       FROM purchase_history ph
       JOIN stores s ON ph.store_id = s.id
       WHERE ph.product_id = ?
         AND ph.price IS NOT NULL
         AND ph.qty_amount IS NOT NULL
         AND ph.qty_unit IS NOT NULL
         AND ph.status = 'confirmed'
       ORDER BY ph.purchased_at ASC`,
      [productId],
    );
    setPoints(
      rows.map(row => ({
        chain: row.chain,
        purchasedAt: row.purchased_at,
        normalisedPrice: normalisePrice(
          row.price!,
          row.qty_amount!,
          row.qty_unit! as QtyUnit,
        ),
        isOnSale: row.is_sale === 1,
      })),
    );
  }, [productId, db]);

  useEffect(() => { load(); }, [load]);

  return { points, reload: load };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/hooks/usePriceHistory.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/usePriceHistory.ts __tests__/hooks/usePriceHistory.test.ts
git commit -m "refactor(usePriceHistory): query by product_id"
```

---

## Task 6: Suggestions — new `Candidate`/`Suggestion` shape

**Files:**
- Modify: `lib/suggestions/types.ts`
- Modify: `lib/suggestions/ranking.ts`
- Modify: `hooks/useIngredientSuggestions.ts`
- Modify: `__tests__/hooks/useIngredientSuggestions.test.ts`

- [ ] **Step 1: Update `lib/suggestions/types.ts`**

```ts
export type Candidate = {
  brand: string;
  productName: string;
  itemName: string;
  productId: string;
  hasNutrition: boolean;
  lastUsedAt: string;
};

export type SuggestionKind = 'brand' | 'product';

export type Suggestion = {
  kind: SuggestionKind;
  brand: string;
  productName: string | null;
  productCount?: number;
  latestProductName?: string | null;
  lastUsedAt: string;
  productId: string | null;
  hasNutrition: boolean;
  matches: { field: SuggestionKind; indices: [number, number][] }[];
};

export type QueryParams = {
  field: SuggestionKind;
  text: string;
  ingredientName: string;
  brandFilter?: string;
};
```

(Note `productName`/`itemName` on `Candidate` become non-null — the new SQL guarantees both via the products join.)

- [ ] **Step 2: Update `lib/suggestions/ranking.ts`**

Three changes:
1. `dedupCandidates` collapses simpler — since the SQL already returns unique rows by `products.id` it's effectively a pass-through, but keep it as a defensive identity to preserve callers' expectations. Update its merge logic for the new shape:

```ts
export function dedupCandidates(rows: Candidate[]): Candidate[] {
  // Rows from the products-anchored query are already unique by (brand, product_name).
  // Keep the function as a defensive no-op pass-through to ease later changes.
  const byKey = new Map<string, Candidate>();
  for (const row of rows) {
    const key = `${row.brand.trim().toLowerCase()}::${row.productName.trim().toLowerCase()}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }
    byKey.set(key, {
      ...existing,
      hasNutrition: existing.hasNutrition || row.hasNutrition,
      lastUsedAt: existing.lastUsedAt >= row.lastUsedAt ? existing.lastUsedAt : row.lastUsedAt,
    });
  }
  return Array.from(byKey.values());
}
```

2. `projectBrands` updates to emit the new fields:

```ts
export function projectBrands(candidates: Candidate[]): Suggestion[] {
  const byBrand = new Map<string, {
    brand: string;
    products: Set<string>;
    latestProductName: string | null;
    lastUsedAt: string;
    hasNutrition: boolean;
  }>();
  for (const c of candidates) {
    const key = c.brand.trim().toLowerCase();
    const existing = byBrand.get(key);
    if (!existing) {
      byBrand.set(key, {
        brand: c.brand,
        products: new Set([c.productName]),
        latestProductName: c.productName,
        lastUsedAt: c.lastUsedAt,
        hasNutrition: c.hasNutrition,
      });
      continue;
    }
    existing.products.add(c.productName);
    if (c.hasNutrition) existing.hasNutrition = true;
    if (c.lastUsedAt > existing.lastUsedAt) {
      existing.lastUsedAt = c.lastUsedAt;
      existing.latestProductName = c.productName;
    }
  }
  return Array.from(byBrand.values()).map<Suggestion>(b => ({
    kind: 'brand',
    brand: b.brand,
    productName: null,
    productCount: b.products.size,
    latestProductName: b.latestProductName,
    lastUsedAt: b.lastUsedAt,
    productId: null,
    hasNutrition: b.hasNutrition,
    matches: [],
  }));
}
```

3. `rankEmptyQuery` and `rankFuzzyQuery` look up `itemName` directly off the candidate rather than via id-indirection. Change the signatures:

```ts
export function rankEmptyQuery(
  targets: Suggestion[],
  ingredientName: string,
  lookupItemName: (productId: string) => string | null,
): Suggestion[] {
  const scored = targets.map(t => {
    const itemName = t.productId ? lookupItemName(t.productId) : null;
    const isMatch = itemNameMatches(itemName, ingredientName);
    return { t, matchRank: isMatch ? 0 : 1 };
  });
  scored.sort((a, b) => {
    if (a.matchRank !== b.matchRank) return a.matchRank - b.matchRank;
    return b.t.lastUsedAt.localeCompare(a.t.lastUsedAt);
  });
  return scored.slice(0, 5).map(s => ({ ...s.t, matches: [] }));
}

export function rankFuzzyQuery(
  targets: Suggestion[],
  text: string,
  field: SuggestionKind,
  ingredientName: string,
  lookupItemName: (productId: string) => string | null,
  now: number = Date.now(),
): Suggestion[] {
  const fuseKey = field === 'brand' ? 'brand' : 'productName';
  const fuse = new Fuse(targets, {
    keys: [fuseKey],
    threshold: 0.4,
    ignoreLocation: true,
    includeMatches: true,
    includeScore: true,
  });
  const hits = fuse.search(text);
  const scored = hits.map(hit => {
    const t = hit.item;
    const itemName = t.productId ? lookupItemName(t.productId) : null;
    const itemMul = itemNameMatches(itemName, ingredientName) ? 0.5 : 1.0;
    const fuseScore = hit.score ?? 1;
    const finalScore = fuseScore * recencyMultiplier(t.lastUsedAt, now) * itemMul;
    const matchEntries = (hit.matches ?? [])
      .filter(m => m.key === fuseKey)
      .map(m => ({
        field,
        indices: m.indices.map(([a, b]) => [a, b] as [number, number]),
      }));
    return { t: { ...t, matches: matchEntries }, finalScore };
  });
  scored.sort((a, b) => {
    if (a.finalScore !== b.finalScore) return a.finalScore - b.finalScore;
    return b.t.lastUsedAt.localeCompare(a.t.lastUsedAt);
  });
  return scored.slice(0, 5).map(s => s.t);
}
```

(Renames `foodNutritionId` → `productId` in parameter docs; semantics identical.)

- [ ] **Step 3: Update `hooks/useIngredientSuggestions.ts`**

```ts
import { useCallback, useRef } from 'react';
import { useDb } from '../providers/DatabaseProvider';
import {
  dedupCandidates,
  projectBrands,
  rankEmptyQuery,
  rankFuzzyQuery,
} from '../lib/suggestions/ranking';
import type { Candidate, QueryParams, Suggestion } from '../lib/suggestions/types';

interface Row {
  product_id: string;
  brand: string;
  product_name: string;
  item_name: string;
  has_nutrition: 0 | 1;
  last_used_at: string;
}

const SQL = `
  SELECT p.id AS product_id, p.brand, p.product_name, p.item_name,
         CASE WHEN p.cal_per_basis IS NOT NULL OR p.protein_per_basis IS NOT NULL
                OR p.carbs_per_basis IS NOT NULL OR p.fat_per_basis IS NOT NULL
              THEN 1 ELSE 0 END AS has_nutrition,
         COALESCE(MAX(ph.purchased_at), p.updated_at) AS last_used_at
  FROM products p
  LEFT JOIN purchase_history ph ON ph.product_id = p.id
  WHERE p.brand <> ''
  GROUP BY p.id
`;

export function useIngredientSuggestions() {
  const db = useDb();
  const cache = useRef<Candidate[] | null>(null);

  const fetchCandidates = useCallback(async (): Promise<Candidate[]> => {
    if (cache.current) return cache.current;
    const rows = await db.getAllAsync<Row>(SQL);
    const candidates: Candidate[] = rows.map(r => ({
      brand: r.brand,
      productName: r.product_name,
      itemName: r.item_name,
      productId: r.product_id,
      hasNutrition: r.has_nutrition === 1,
      lastUsedAt: r.last_used_at,
    }));
    const deduped = dedupCandidates(candidates);
    cache.current = deduped;
    return deduped;
  }, [db]);

  const query = useCallback(async (p: QueryParams): Promise<Suggestion[]> => {
    const all = await fetchCandidates();

    const filtered = p.field === 'product' && p.brandFilter && p.brandFilter.trim()
      ? all.filter(c => c.brand.trim().toLowerCase() === p.brandFilter!.trim().toLowerCase())
      : all;

    const targets: Suggestion[] = p.field === 'brand'
      ? projectBrands(filtered)
      : filtered.map(c => ({
          kind: 'product' as const,
          brand: c.brand,
          productName: c.productName,
          lastUsedAt: c.lastUsedAt,
          productId: c.productId,
          hasNutrition: c.hasNutrition,
          matches: [],
        }));

    const itemNameById = new Map<string, string>();
    for (const c of filtered) itemNameById.set(c.productId, c.itemName);
    const lookup = (id: string) => itemNameById.get(id) ?? null;

    if (p.text.trim() === '') {
      return rankEmptyQuery(targets, p.ingredientName, lookup);
    }
    return rankFuzzyQuery(targets, p.text, p.field, p.ingredientName, lookup);
  }, [fetchCandidates]);

  const invalidate = useCallback(() => {
    cache.current = null;
  }, []);

  return { query, invalidate };
}
```

- [ ] **Step 4: Update `__tests__/hooks/useIngredientSuggestions.test.ts`**

Mock row shape change. Every row literal in the test goes from:

```ts
{ brand: 'Vitasoy', product_name: 'Oat Milk', item_name: 'oat milk', food_nutrition_id: 'fn-1', last_used_at: '...' }
```

to:

```ts
{ product_id: 'fn-1', brand: 'Vitasoy', product_name: 'Oat Milk', item_name: 'oat milk', has_nutrition: 1, last_used_at: '...' }
```

The `mockUnion` helper is renamed (since there's no UNION any more) and simplifies:

```ts
function mockProducts(rows: any[]) {
  mockDb.getAllAsync.mockResolvedValue(rows);
}
```

Assertion at line 59 updates:
```ts
expect(suggestions.map(s => s.productId)).toEqual(['a']);
```

Drop or update any test that exercised the two-source-UNION semantics — the LEFT JOIN replacement makes "purchase-only rows with no nutrition" structurally impossible (every product appears once; purchases that don't reference a product never reach suggestions).

- [ ] **Step 5: Run all the touched tests**

Run: `npx jest __tests__/hooks/useIngredientSuggestions.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/suggestions/types.ts lib/suggestions/ranking.ts \
        hooks/useIngredientSuggestions.ts \
        __tests__/hooks/useIngredientSuggestions.test.ts
git commit -m "refactor(suggestions): query products with LEFT JOIN purchase_history; productId + hasNutrition"
```

---

## Task 7: `useRecipeIngredients` — drop link-table reindex

**Files:**
- Modify: `hooks/useRecipeIngredients.ts`
- Modify: `__tests__/hooks/useRecipeIngredients.test.ts`

- [ ] **Step 1: Replace `hooks/useRecipeIngredients.ts`**

```ts
import { useCallback } from 'react';
import { useDb, usePlanVersion } from '../providers/DatabaseProvider';
import type { Ingredient } from '../meal_plan.types';
import type { RecipeRow } from '../types/db';
import { parseAmountString } from '../lib/amount';

function coerceIngredient(raw: { item: string; amount: unknown }): Ingredient {
  if (typeof raw.amount === 'string') {
    return { item: raw.item, amount: parseAmountString(raw.amount) };
  }
  return raw as Ingredient;
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
    const raw = JSON.parse(row.ingredients_json);
    return raw.map(coerceIngredient);
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
    await writeIngredients(recipeId, next);
    bumpPlanVersion();
  }, [readIngredients, writeIngredients, bumpPlanVersion]);

  return { updateIngredient, addIngredient, deleteIngredient };
}
```

The exported `reindexLinksOnDelete` helper is removed.

- [ ] **Step 2: Replace `__tests__/hooks/useRecipeIngredients.test.ts`**

The current file only tests the `reindexLinksOnDelete` pure helper, which no longer exists. Replace with integration-style tests for the public hook surface:

```ts
import { renderHook, act } from '@testing-library/react-native';
import { useRecipeIngredients } from '../../hooks/useRecipeIngredients';

const mockDb = {
  getFirstAsync: jest.fn(),
  runAsync: jest.fn(),
};

const bumpPlanVersion = jest.fn();

jest.mock('../../providers/DatabaseProvider', () => ({
  useDb: () => mockDb,
  usePlanVersion: () => ({ planVersion: 0, bumpPlanVersion }),
}));

beforeEach(() => {
  mockDb.getFirstAsync.mockReset();
  mockDb.runAsync.mockReset();
  bumpPlanVersion.mockReset();
});

describe('useRecipeIngredients.deleteIngredient', () => {
  it('removes the ingredient at the given index and writes the array back', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      ingredients_json: JSON.stringify([
        { item: 'a', amount: { kind: 'measured', value: 1, unit: 'g' }, product_id: 'p-a' },
        { item: 'b', amount: { kind: 'measured', value: 2, unit: 'g' }, product_id: 'p-b' },
        { item: 'c', amount: { kind: 'measured', value: 3, unit: 'g' }, product_id: 'p-c' },
      ]),
    });
    const { result } = renderHook(() => useRecipeIngredients());
    await act(async () => {
      await result.current.deleteIngredient('r1', 1);
    });
    const writeCall = mockDb.runAsync.mock.calls.find(
      c => typeof c[0] === 'string' && c[0].startsWith('UPDATE recipes'),
    );
    expect(writeCall).toBeDefined();
    const writtenIngredients = JSON.parse(writeCall![1][0]);
    expect(writtenIngredients.map((i: any) => i.item)).toEqual(['a', 'c']);
    expect(writtenIngredients.map((i: any) => i.product_id)).toEqual(['p-a', 'p-c']);
    expect(bumpPlanVersion).toHaveBeenCalled();
  });

  it('is a no-op when index is out of range', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      ingredients_json: JSON.stringify([{ item: 'a', amount: { kind: 'measured', value: 1, unit: 'g' } }]),
    });
    const { result } = renderHook(() => useRecipeIngredients());
    await act(async () => {
      await result.current.deleteIngredient('r1', 5);
    });
    expect(mockDb.runAsync).not.toHaveBeenCalledWith(
      expect.stringMatching(/UPDATE recipes/),
      expect.anything(),
    );
    expect(bumpPlanVersion).not.toHaveBeenCalled();
  });
});

describe('useRecipeIngredients.updateIngredient', () => {
  it('replaces the entry at the index and preserves others', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      ingredients_json: JSON.stringify([
        { item: 'a', amount: { kind: 'measured', value: 1, unit: 'g' } },
        { item: 'b', amount: { kind: 'measured', value: 2, unit: 'g' } },
      ]),
    });
    const { result } = renderHook(() => useRecipeIngredients());
    await act(async () => {
      await result.current.updateIngredient('r1', 0, {
        item: 'A!', amount: { kind: 'measured', value: 5, unit: 'g' }, product_id: 'p1',
      });
    });
    const written = JSON.parse(
      mockDb.runAsync.mock.calls.find(c => (c[0] as string).startsWith('UPDATE recipes'))![1][0],
    );
    expect(written[0].item).toBe('A!');
    expect(written[0].product_id).toBe('p1');
    expect(written[1].item).toBe('b');
  });
});

describe('useRecipeIngredients.addIngredient', () => {
  it('appends and returns the new index', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      ingredients_json: JSON.stringify([
        { item: 'a', amount: { kind: 'measured', value: 1, unit: 'g' } },
      ]),
    });
    const { result } = renderHook(() => useRecipeIngredients());
    let newIndex = -1;
    await act(async () => {
      newIndex = await result.current.addIngredient('r1', {
        item: 'b', amount: { kind: 'measured', value: 2, unit: 'g' },
      });
    });
    expect(newIndex).toBe(1);
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npx jest __tests__/hooks/useRecipeIngredients.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add hooks/useRecipeIngredients.ts __tests__/hooks/useRecipeIngredients.test.ts
git commit -m "refactor(useRecipeIngredients): drop link-table reindex; product_id rides the ingredient JSON"
```

---

## Task 8: `rollupMacros` — `ProductRow` rename

**Files:**
- Modify: `lib/rollupMacros.ts`

- [ ] **Step 1: Update `lib/rollupMacros.ts`**

Two lines change — the import and the `links` parameter type. Body is unchanged.

```ts
import { amountMultiplier } from './amount';
import type { ProductRow } from '../types/db';
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
  links: Record<number, ProductRow>,
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

- [ ] **Step 2: Run any existing rollupMacros tests** (if `__tests__/lib/rollupMacros.test.ts` exists)

Run: `npx jest lib/rollupMacros 2>/dev/null; npx jest __tests__/lib/rollupMacros 2>/dev/null || true`
Expected: PASS if a test file exists; type aliases are name-equivalent for runtime data.

- [ ] **Step 3: Commit**

```bash
git add lib/rollupMacros.ts
git commit -m "refactor(rollupMacros): rename FoodNutritionRow type ref to ProductRow"
```

---

## Task 9: `SuggestionDropdown` — `hasNutrition` flag

**Files:**
- Modify: `components/SuggestionDropdown.tsx`

- [ ] **Step 1: Update the badge check at line 49**

The only `foodNutritionId` reference in the file is the emblem visibility check. Change:

```tsx
{s.kind === 'product' && s.foodNutritionId && (
  <Ionicons
    testID="suggestion-emblem"
    name="pie-chart"
    size={16}
    color={colors.green}
  />
)}
```

to:

```tsx
{s.kind === 'product' && s.hasNutrition && (
  <Ionicons
    testID="suggestion-emblem"
    name="pie-chart"
    size={16}
    color={colors.green}
  />
)}
```

The `onPick(s)` callback passes the whole `Suggestion` (no change needed); downstream consumers of the picked suggestion access `s.productId` (renamed from `s.foodNutritionId`) — that rename is enforced by the type change in Task 6.

- [ ] **Step 2: Run any SuggestionDropdown tests if they exist**

Run: `npx jest -t SuggestionDropdown 2>/dev/null || true`
Expected: PASS if a test file exists; no-op otherwise.

- [ ] **Step 3: Commit**

```bash
git add components/SuggestionDropdown.tsx
git commit -m "refactor(SuggestionDropdown): hasNutrition badge check"
```

---

## Task 10: `IngredientSheet` — `productId` autofill

**Files:**
- Modify: `components/IngredientSheet.tsx`
- Modify: `__tests__/components/IngredientSheet.test.tsx`

- [ ] **Step 1: Read the file to understand all the touchpoints**

Run: `grep -n 'useFoodNutrition\|food_nutrition\|foodNutritionId\|getById\|existingEntry' components/IngredientSheet.tsx`

Key sites to update:
- Line 14-15 imports: drop `FoodNutritionData` from `useFoodNutrition`; import `ProductInput` from `useProducts`.
- Line 76: `const { getById: getFoodNutritionById } = useFoodNutrition();` → `const { getById } = useProducts();`
- Line 83: `const autofilledFoodNutritionId = useRef<string | null>(existingEntry?.id ?? null);` → keep the ref but rename for clarity; the semantic is "the productId we auto-filled from a suggestion pick", and `existingEntry?.id` still works because `ProductRow` carries `id`.
- The save-payload assembly (further down in the file) constructs `{ ingredient, nutrition, foodNutritionId }` for the parent `handleSheetSave`. Change to `{ ingredient, nutrition }` only — the parent uses `useProducts.upsert(nutrition)` to derive `productId` itself (covered in Task 11).
- Suggestion-pick handler: when the user picks a has-nutrition suggestion, the code currently calls `getFoodNutritionById(suggestion.foodNutritionId)` to fetch macros. Change to `getById(suggestion.productId)`.

Look for any references to `existingEntry.brand ?? ""` / `existingEntry.product_name ?? ""` at line ~142-143 — `ProductRow` has these as non-null `string`, so drop the `?? ""` fallback (it's safe to leave but `?.` becomes unnecessary).

- [ ] **Step 2: Update the file**

Specific edits (in addition to the above):

```ts
// Around line 14-15
import type { ProductInput } from "../hooks/useProducts";
import { useProducts } from "../hooks/useProducts";
```

```ts
// Around line 76
const { getById } = useProducts();
```

```ts
// Around line 83
const autofilledProductId = useRef<string | null>(existingEntry?.id ?? null);
```

```ts
// Wherever the sheet emits its save payload:
onSave({
  ingredient: { item: name, amount, product_id: undefined /* parent stamps after upsert */ },
  nutrition: nutritionInput,  // ProductInput | null
});
```

Note: the `Props.onSave` signature changes from
```ts
onSave: (payload: {
  ingredient: Ingredient;
  nutrition: FoodNutritionData | null;
  foodNutritionId: string | null;
}) => void;
```
to
```ts
onSave: (payload: {
  ingredient: Ingredient;
  nutrition: ProductInput | null;
}) => void;
```

`autofilledProductId.current` is still tracked internally so that re-entering the sheet on a previously-picked suggestion doesn't redundantly re-resolve, but it's not part of the outgoing payload.

- [ ] **Step 3: Update `__tests__/components/IngredientSheet.test.tsx`**

Mock `useProducts` instead of `useFoodNutrition`:

```ts
jest.mock('../../hooks/useProducts', () => ({
  useProducts: () => ({ getById: jest.fn().mockResolvedValue(null) }),
}));
```

Adjust any assertion that probed the outgoing `foodNutritionId` field to probe the absence of that field (and presence of `nutrition`).

- [ ] **Step 4: Run the component test**

Run: `npx jest __tests__/components/IngredientSheet.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/IngredientSheet.tsx __tests__/components/IngredientSheet.test.tsx
git commit -m "refactor(IngredientSheet): useProducts; emit nutrition+ingredient; parent owns upsert"
```

---

## Task 11: Recipe screen — `useProducts` wiring

**Files:**
- Modify: `app/recipe/[id].tsx`
- Modify: `__tests__/screens/recipe-detail.test.tsx`

- [ ] **Step 1: Update `app/recipe/[id].tsx`**

Imports (lines ~14, 23):
```ts
import { useProducts } from '../../hooks/useProducts';
import type { ProductInput } from '../../hooks/useProducts';
import type { ProductRow } from '../../types/db';
```
Drop the `useFoodNutrition` / `FoodNutritionData` / `FoodNutritionRow` imports.

Hook destructure (line ~30):
```ts
const { upsert, getNutritionForIngredients } = useProducts();
```

State (line ~39):
```ts
const [links, setLinks] = useState<Record<number, ProductRow>>({});
```

The links-loading effect (line ~44-47) becomes:
```ts
useEffect(() => {
  if (!recipe) { setLinks({}); return; }
  getNutritionForIngredients(recipe.ingredients).then(setLinks);
}, [recipe?.id, recipe?.ingredients, getNutritionForIngredients]);
```

Drop the `linksKey` state and any references to incrementing it (e.g. `setLinksKey(k => k + 1)`).

`handleSheetSave` rewrite (lines ~66-93):
```ts
async function handleSheetSave({
  ingredient,
  nutrition,
}: {
  ingredient: Ingredient;
  nutrition: ProductInput | null;
}) {
  if (!sheet) return;
  let nextIngredient: Ingredient = ingredient;
  if (nutrition) {
    const productId = await upsert(nutrition);
    nextIngredient = { ...ingredient, product_id: productId };
  }
  if (sheet.mode === 'edit') {
    await updateIngredient(recipe!.id, sheet.index, nextIngredient);
  } else {
    await addIngredient(recipe!.id, nextIngredient);
  }
  setSheet(null);
}
```

`handleSheetDelete` (lines ~95-100) loses the `setLinksKey` line; `deleteIngredient` is enough because `bumpPlanVersion` re-fetches `recipe.ingredients` and the `useEffect` re-runs.

- [ ] **Step 2: Update `__tests__/screens/recipe-detail.test.tsx`**

Mock surface migrates from `useFoodNutrition` (`upsert`, `linkIngredient`, `getLinksForRecipe`) to `useProducts` (`upsert`, `getNutritionForIngredients`). Example shape:

```ts
const upsertMock = jest.fn().mockResolvedValue('product-1');
const getNutritionForIngredientsMock = jest.fn().mockResolvedValue({});

jest.mock('../../hooks/useProducts', () => ({
  useProducts: () => ({
    upsert: upsertMock,
    getById: jest.fn().mockResolvedValue(null),
    getByKey: jest.fn().mockResolvedValue(null),
    getNutritionForIngredients: getNutritionForIngredientsMock,
  }),
}));
```

Tests that asserted on `linkIngredient` being called with `(recipeId, index, foodNutritionId)` change to assert on:
- `upsert` being called with the nutrition input
- `updateIngredient` / `addIngredient` being called with an ingredient containing `product_id: 'product-1'`

Tests that asserted on `getLinksForRecipe(recipe.id)` change to assert on `getNutritionForIngredients` being called with the recipe's ingredient array.

- [ ] **Step 3: Run the screen test**

Run: `npx jest __tests__/screens/recipe-detail.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/recipe/[id].tsx __tests__/screens/recipe-detail.test.tsx
git commit -m "refactor(recipe-detail): useProducts; ingredients carry product_id"
```

---

## Task 12: `ReviewItemSheet` — upsert-then-insert

**Files:**
- Modify: `components/ReviewItemSheet.tsx`

- [ ] **Step 1: Read the file to identify save-flow code**

Run: `grep -n 'brand\|product_name\|AddPurchaseData' components/ReviewItemSheet.tsx`

The save flow (around lines 175-200) currently passes `brand`/`product_name` directly into `AddPurchaseData`.

- [ ] **Step 2: Update imports and the save flow**

Add the hook import:
```ts
import { useProducts } from "../hooks/useProducts";
```

Inside the component, add:
```ts
const { upsert, getByKey } = useProducts();
```

The current `handleSave` at lines 174-193 reads:

```ts
function handleSave() {
  if (!item) return;
  onSave(
    {
      plan_id: item.plan_id,
      item_name: item.name,
      store,
      branch,
      brand: brand.trim() || null,
      product_name: productName.trim() || null,
      qty_amount: qtyAmount ? parseFloat(qtyAmount) : null,
      qty_unit: qtyUnit,
      price: price ? parseFloat(price) : null,
      is_sale: isSale ? 1 : 0,
      barcode: barcode.trim() || null,
      purchased_at: pendingRow?.purchased_at ?? new Date().toISOString(),
    },
    pendingRow?.id ?? null,
  );
}
```

Replace with (note `handleSave` becomes `async`):

```ts
async function handleSave() {
  if (!item) return;
  const brandTrim = brand.trim();
  const productTrim = productName.trim();

  let productId: string | null = null;
  if (productTrim) {
    productId = await upsert({
      brand: brandTrim,
      product_name: productTrim,
      item_name: item.name,
      basis,
      cal_per_basis: cal.trim() ? parseFloat(cal) : null,
      protein_per_basis: protein.trim() ? parseFloat(protein) : null,
      carbs_per_basis: carbs.trim() ? parseFloat(carbs) : null,
      fat_per_basis: fat.trim() ? parseFloat(fat) : null,
    });
  }

  onSave(
    {
      plan_id: item.plan_id,
      item_name: item.name,
      store,
      branch,
      product_id: productId,
      qty_amount: qtyAmount ? parseFloat(qtyAmount) : null,
      qty_unit: qtyUnit,
      price: price ? parseFloat(price) : null,
      is_sale: isSale ? 1 : 0,
      barcode: barcode.trim() || null,
      purchased_at: pendingRow?.purchased_at ?? new Date().toISOString(),
    },
    pendingRow?.id ?? null,
  );
}
```

The fields `basis`, `cal`, `protein`, `carbs`, `fat` are existing component state from the macro inputs.

Internal form state (`brand`, `productName` strings) stays — those are UI inputs. They flow into the `upsert` call now rather than directly into the row.

If the chart pill at the bottom (~line 415-418) is rendered conditionally on `brand.trim() && productName.trim()`, change its prop from `brand`/`productName` to `productId={productId}` — but `productId` isn't known until upsert runs. Two options:

- **Resolve lazily on chart open**: keep the brand+product strings as the conditional, and inside the chart-render branch call `useProducts.getByKey(brand.trim(), productName.trim())` and pass the resolved id.
- **Resolve eagerly with a `useEffect`**: when both fields are non-empty, fire a lookup and stash the id in state.

The eager approach is simpler. Implementation:

```ts
const [resolvedProductId, setResolvedProductId] = useState<string | null>(null);
const { getByKey } = useProducts();
useEffect(() => {
  const b = brand.trim(); const p = productName.trim();
  if (!b && !p) { setResolvedProductId(null); return; }
  let cancelled = false;
  getByKey(b, p).then(row => {
    if (!cancelled) setResolvedProductId(row?.id ?? null);
  });
  return () => { cancelled = true; };
}, [brand, productName, getByKey]);
```

The chart pill becomes:
```tsx
{resolvedProductId && (
  <PriceHistoryChart productId={resolvedProductId} />
)}
```

- [ ] **Step 3: Run any review-sheet tests that exist**

Run: `npx jest -t ReviewItemSheet 2>/dev/null || true`
Expected: if a test file exists, it may need parallel updates; otherwise no-op.

- [ ] **Step 4: Commit**

```bash
git add components/ReviewItemSheet.tsx
git commit -m "refactor(ReviewItemSheet): upsert product then attach product_id to purchase"
```

---

## Task 13: `AddPriceSheet` and `PriceHistoryChart`

**Files:**
- Modify: `components/AddPriceSheet.tsx`
- Modify: `components/PriceHistoryChart.tsx`

- [ ] **Step 1: Update `components/AddPriceSheet.tsx`**

The sheet's props pass `brand: string | null` and `productName: string | null` today (lines 17-23). Keep those props as the external surface (parents pass strings). Internally, before creating the purchase, do the upsert.

Add the import after the existing `usePurchaseHistory` import:
```ts
import { useProducts } from '../hooks/useProducts';
```

Inside the component, after `const { addRecord } = usePurchaseHistory(null);`, add:
```ts
const { upsert } = useProducts();
```

The current `handleSave` at lines 49-75 reads:

```ts
const handleSave = async () => {
  if (!canSave || saving) return;
  setSaving(true);
  try {
    const chain = addingNewStore ? newStoreName.trim() : selectedChain;
    const parsedPrice = parseFloat(price);
    const parsedQty = parseFloat(qtyAmount);
    await addRecord({
      plan_id: null,
      item_name: productName ?? brand ?? '',
      store: chain,
      brand: brand ?? null,
      product_name: productName ?? null,
      qty_amount: isNaN(parsedQty) ? null : parsedQty,
      qty_unit: qtyUnit,
      price: isNaN(parsedPrice) ? null : parsedPrice,
      is_sale: isOnSale ? 1 : 0,
      barcode: null,
      purchased_at: date.toISOString(),
    });
    setPrice('');
    setIsOnSale(false);
    onSaved();
  } finally {
    setSaving(false);
  }
};
```

Replace with:

```ts
const handleSave = async () => {
  if (!canSave || saving) return;
  setSaving(true);
  try {
    const chain = addingNewStore ? newStoreName.trim() : selectedChain;
    const parsedPrice = parseFloat(price);
    const parsedQty = parseFloat(qtyAmount);

    let productId: string | null = null;
    if (productName && productName.trim()) {
      productId = await upsert({
        brand: brand ?? '',
        product_name: productName.trim(),
        item_name: productName.trim(),
        basis: 'per_100g',
        cal_per_basis: null,
        protein_per_basis: null,
        carbs_per_basis: null,
        fat_per_basis: null,
      });
    }

    await addRecord({
      plan_id: null,
      item_name: productName ?? brand ?? '',
      store: chain,
      product_id: productId,
      qty_amount: isNaN(parsedQty) ? null : parsedQty,
      qty_unit: qtyUnit,
      price: isNaN(parsedPrice) ? null : parsedPrice,
      is_sale: isOnSale ? 1 : 0,
      barcode: null,
      purchased_at: date.toISOString(),
    });
    setPrice('');
    setIsOnSale(false);
    onSaved();
  } finally {
    setSaving(false);
  }
};
```

Note: `AddPriceSheet` has no separate `item_name` input from the user, so we reuse the product name as the catalog label. `basis` defaults to `per_100g` and all macro columns are `null` (macros aren't captured by this sheet — they're a recipe-tagging concern). A later edit via the catalog tab (Piece B) can fill them in.

- [ ] **Step 2: Update `components/PriceHistoryChart.tsx`**

The component currently accepts `brand`/`productName` props and passes them into `usePriceHistory`. Change to accept `productId`:

```ts
interface Props {
  productId: string;
}

export function PriceHistoryChart({ productId }: Props) {
  const { points } = usePriceHistory(productId);
  // ... rest unchanged
}
```

Update the caller in `ReviewItemSheet` (already covered in Task 12: it passes `productId={resolvedProductId}`). Any other caller passing `brand`/`productName` needs the same resolve-then-pass pattern.

- [ ] **Step 3: Run any chart/price-sheet tests**

Run: `npx jest -t AddPriceSheet 2>/dev/null; npx jest -t PriceHistoryChart 2>/dev/null || true`
Expected: PASS if test files exist.

- [ ] **Step 4: Commit**

```bash
git add components/AddPriceSheet.tsx components/PriceHistoryChart.tsx
git commit -m "refactor(price sheets): productId-based chart; upsert before adding purchase"
```

---

## Task 14: `useBackup` — bring export current

**Files:**
- Modify: `hooks/useBackup.ts`

- [ ] **Step 1: Update `exportBackup`**

Replace the `Promise.all` destructure (lines 21-32) and the backup object literal (lines 34-46):

```ts
const [
  recipes, plans, items, purchases, products,
  barcodeNutrition, barcodeStores, stores, aisles, aisleMap,
] = await Promise.all([
  db.getAllAsync('SELECT * FROM recipes'),
  db.getAllAsync('SELECT * FROM weekly_plans'),
  db.getAllAsync('SELECT * FROM shopping_items'),
  db.getAllAsync('SELECT * FROM purchase_history'),
  db.getAllAsync('SELECT * FROM products'),
  db.getAllAsync('SELECT * FROM barcode_nutrition'),
  db.getAllAsync('SELECT * FROM barcode_stores'),
  db.getAllAsync('SELECT * FROM stores'),
  db.getAllAsync('SELECT * FROM store_aisles'),
  db.getAllAsync('SELECT * FROM item_aisle_map'),
]);

const backup = {
  backup_version: '2.0',
  exported_at: new Date().toISOString(),
  recipes,
  weekly_plans: plans,
  shopping_items: items,
  purchase_history: purchases,
  products,
  barcode_nutrition: barcodeNutrition,
  barcode_stores: barcodeStores,
  stores,
  store_aisles: aisles,
  item_aisle_map: aisleMap,
};
```

(Removed: `price_history` selection and the corresponding key.)

- [ ] **Step 2: Update `executeRestore`**

Replace the DELETE list (line 88-89) and the INSERT block (lines 95-110):

```ts
const tables = [
  'item_aisle_map', 'store_aisles', 'shopping_items', 'purchase_history',
  'barcode_nutrition', 'barcode_stores', 'weekly_plans', 'recipes',
  'products', 'stores',
];
for (const t of tables) {
  await db.runAsync(`DELETE FROM ${t}`);
}
await runMigrations(db);

const inserts: Array<[string, any[]]> = [
  ...insertRows('stores', backup.stores ?? [],
    ['id','chain','branch','created_at']),
  ...insertRows('products', backup.products ?? [],
    ['id','brand','product_name','item_name','basis',
     'cal_per_basis','protein_per_basis','carbs_per_basis','fat_per_basis','updated_at']),
  ...insertRows('weekly_plans', backup.weekly_plans ?? [],
    ['id','week_starting','is_active','meta_json','strategy_json',
     'days_json','batch_plan_json','created_at']),
  ...insertRows('recipes', backup.recipes ?? [],
    ['id','title','meal_type','servings','calories_per_serve','protein_per_serve_g',
     'cook_method','prep_minutes','cook_minutes','ingredients_json','method_steps_json',
     'is_favourite','source','notes','created_at']),
  ...insertRows('shopping_items', backup.shopping_items ?? [],
    ['id','plan_id','category','category_order','item_order','name','qty',
     'estimated_price','is_oneoff','note','is_checked']),
  ...insertRows('purchase_history', backup.purchase_history ?? [],
    ['id','plan_id','item_name','store_id','product_id',
     'qty_amount','qty_unit','price','is_sale','barcode','purchased_at','status']),
  ...insertRows('barcode_nutrition', backup.barcode_nutrition ?? [],
    ['barcode','brand_name','item_name','cal_per_100g','protein_per_100g',
     'carbs_per_100g','fat_per_100g','scanned_at']),
  ...insertRows('barcode_stores', backup.barcode_stores ?? [],
    ['barcode','store','first_seen']),
  ...insertRows('store_aisles', backup.store_aisles ?? [],
    ['id','store_id','aisle_label','sort_order']),
  ...insertRows('item_aisle_map', backup.item_aisle_map ?? [],
    ['id','store_id','barcode','item_name','aisle_id','updated_at']),
];
```

Notes:
- `shopping_items` column list drops the stale `actual_price` and `store` entries that the current code passes (those columns were dropped in v1 migration; the existing INSERT for `shopping_items` at line 101-103 lists them anyway, which silently fails — fix while we're here).
- Both `price_history` references are gone.

- [ ] **Step 3: Manual smoke check** (no automated tests exist for backup; verify by reading)

Inspect the diff: `git diff hooks/useBackup.ts`. Confirm:
- No reference to `price_history` remains.
- `products` and `purchase_history` appear in both export and restore.
- Restore DELETE order is reverse-FK; INSERT order is forward-FK.
- `backup_version: '2.0'`.

- [ ] **Step 4: Commit**

```bash
git add hooks/useBackup.ts
git commit -m "refactor(useBackup): include products + purchase_history; drop defunct price_history; bump to v2.0"
```

---

## Task 15: Delete `useFoodNutrition.ts`

**Files:**
- Delete: `hooks/useFoodNutrition.ts`

- [ ] **Step 1: Verify there are no remaining importers**

Run: `grep -rn 'useFoodNutrition\|from.*useFoodNutrition' --include='*.ts' --include='*.tsx' . | grep -v node_modules | grep -v docs/`
Expected: no matches (the only matches should be in `docs/superpowers/` plans/specs).

- [ ] **Step 2: Delete the file**

```bash
git rm hooks/useFoodNutrition.ts
```

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: remove obsolete useFoodNutrition hook"
```

---

## Task 16: Full verification

- [ ] **Step 1: TypeScript clean**

Run: `npx tsc --noEmit`
Expected: zero errors.

If any errors appear, they're likely leftover `FoodNutritionRow` / `food_nutrition` / `foodNutritionId` references that earlier tasks missed. Track them down and fix them in this task's commit.

- [ ] **Step 2: Full Jest suite**

Run: `npx jest`
Expected: all tests pass.

- [ ] **Step 3: Manual sanity grep**

Run: `grep -rn 'food_nutrition\|ingredient_nutrition_link\|FoodNutritionRow\|useFoodNutrition\|foodNutritionId\|reindexLinksOnDelete' --include='*.ts' --include='*.tsx' . | grep -v node_modules | grep -v docs/`
Expected: zero matches. Anything that shows up is a leftover — clean it up before committing.

- [ ] **Step 4: Commit any cleanup**

```bash
git add -u
git commit -m "chore: final cleanup of obsolete nutrition references"  # only if anything was found
```

- [ ] **Step 5: Manual smoke in the simulator**

Run the app in the simulator (`npm run start`, then `i` or `a`). Smoke checks:
- Open a recipe — macro pills render (or fallback to legacy `cal | P` if no ingredients are tagged yet).
- Open the ingredient sheet on an ingredient; type a brand/product; the suggestions dropdown shows hits if there are any pre-existing matches; saving creates a `products` row.
- Add a shopping item and review it; the review flow attaches `product_id` to the purchase.
- Export a backup → reinstall (or just delete & reimport) → restore. Verify recipes, products, purchases all round-trip.
