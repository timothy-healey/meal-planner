# Price Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a normalised per-100g price history chart to the food nutrition detail sheet, backed by the existing `purchase_history` table with a store FK migration.

**Architecture:** The `purchase_history.store` free-text column is replaced by a `store_id` FK to the `stores` table via a v3 migration. A new `usePriceHistory` hook queries and normalises price data; a custom SVG chart in `PriceHistoryChart` renders it. An `AddPriceSheet` allows manual historical price entry. Both integrate into the existing `FoodNutritionSheet`.

**Tech Stack:** expo-sqlite (already installed), react-native-svg (to install), @react-native-community/datetimepicker (to install), jest-expo (already configured).

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `lib/normalisePrice.ts` | Create | Pure fn: price → ¢/100g |
| `lib/chartLayout.ts` | Create | Pure fn: PricePoint[] → SVG geometry |
| `lib/db/schema.ts` | Modify | Fresh-install schema with store_id |
| `lib/db/migrations.ts` | Modify | v3: drop price_history, migrate store→store_id |
| `types/db.ts` | Modify | Updated PurchaseHistoryRow + new PricePoint |
| `hooks/useStores.ts` | Create | All store chains from DB |
| `hooks/usePurchaseHistory.ts` | Modify | Resolve store name → store_id on addRecord |
| `hooks/usePriceHistory.ts` | Create | Query + normalise price points |
| `components/PriceHistoryChart.tsx` | Create | SVG chart + toolbar + legend |
| `components/AddPriceSheet.tsx` | Create | Bottom sheet for logging a price |
| `components/FoodNutritionSheet.tsx` | Modify | Add chart section at bottom |
| `__tests__/lib/normalisePrice.test.ts` | Create | Unit tests |
| `__tests__/lib/chartLayout.test.ts` | Create | Unit tests |
| `__tests__/hooks/useStores.test.ts` | Create | Hook tests |
| `__tests__/hooks/usePriceHistory.test.ts` | Create | Hook tests |
| `__tests__/hooks/usePurchaseHistory.test.ts` | Modify | Update for store_id |

---

## Task 1: Install dependencies

**Files:** none (package changes only)

- [ ] **Step 1: Install react-native-svg and datetimepicker**

```bash
npx expo install react-native-svg @react-native-community/datetimepicker
```

Expected: both added to `package.json` dependencies with Expo-compatible versions.

- [ ] **Step 2: Verify install**

```bash
npx tsc --noEmit
```

Expected: no new type errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install react-native-svg and datetimepicker"
```

---

## Task 2: normalisePrice utility

**Files:**
- Create: `lib/normalisePrice.ts`
- Create: `__tests__/lib/normalisePrice.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/lib/normalisePrice.test.ts
import { normalisePrice } from '../../lib/normalisePrice';

describe('normalisePrice', () => {
  it('g: price / qty * 100', () => {
    expect(normalisePrice(4.50, 1000, 'g')).toBeCloseTo(0.45);
    expect(normalisePrice(3.00, 500, 'g')).toBeCloseTo(0.60);
  });

  it('kg: converts to g first', () => {
    expect(normalisePrice(4.50, 1, 'kg')).toBeCloseTo(0.45);
    expect(normalisePrice(3.00, 0.5, 'kg')).toBeCloseTo(0.60);
  });

  it('mL: price / qty * 100', () => {
    expect(normalisePrice(2.80, 1000, 'mL')).toBeCloseTo(0.28);
  });

  it('L: converts to mL first', () => {
    expect(normalisePrice(2.80, 1, 'L')).toBeCloseTo(0.28);
  });

  it('units: returns price as-is (total, not per-100g)', () => {
    expect(normalisePrice(12.00, 1, 'units')).toBe(12.00);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx jest __tests__/lib/normalisePrice.test.ts --no-coverage
```

Expected: `Cannot find module '../../lib/normalisePrice'`

- [ ] **Step 3: Implement**

```ts
// lib/normalisePrice.ts
import type { QtyUnit } from '../types/db';

/** Returns price per 100g/mL in dollars, or total price for unit items. */
export function normalisePrice(
  price: number,
  qtyAmount: number,
  qtyUnit: QtyUnit,
): number {
  switch (qtyUnit) {
    case 'g':
    case 'mL':
      return (price / qtyAmount) * 100;
    case 'kg':
    case 'L':
      return (price / (qtyAmount * 1000)) * 100;
    case 'units':
      return price;
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest __tests__/lib/normalisePrice.test.ts --no-coverage
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/normalisePrice.ts __tests__/lib/normalisePrice.test.ts
git commit -m "feat: add normalisePrice utility"
```

---

## Task 3: Schema update (fresh installs)

**Files:**
- Modify: `lib/db/schema.ts`

- [ ] **Step 1: Replace `purchase_history` definition**

In `lib/db/schema.ts`, replace the `purchase_history` block (lines 44–63) with:

```sql
  CREATE TABLE IF NOT EXISTS purchase_history (
    id              TEXT PRIMARY KEY,
    plan_id         TEXT REFERENCES weekly_plans(id),
    item_name       TEXT NOT NULL,
    store_id        TEXT REFERENCES stores(id),
    brand           TEXT,
    product_name    TEXT,
    qty_amount      REAL,
    qty_unit        TEXT CHECK (qty_unit IN ('g', 'kg', 'mL', 'L', 'units')),
    price           REAL,
    is_sale         INTEGER NOT NULL DEFAULT 0,
    barcode         TEXT,
    purchased_at    TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_purchase_history_item_name
    ON purchase_history(item_name);

  CREATE INDEX IF NOT EXISTS idx_purchase_history_barcode
    ON purchase_history(barcode);
```

Changes from original:
- `plan_id TEXT NOT NULL REFERENCES` → `plan_id TEXT REFERENCES` (nullable — price entries may have no plan)
- `store TEXT NOT NULL` → `store_id TEXT REFERENCES stores(id)` (FK to stores)

- [ ] **Step 2: Remove `price_history` table definition**

Delete the entire `price_history` block (lines 83–92) from `SCHEMA_SQL`. The migration will drop it for existing installs; it's not needed for fresh ones.

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/db/schema.ts
git commit -m "feat: update schema — store_id FK and nullable plan_id on purchase_history"
```

---

## Task 4: Migration v3

**Files:**
- Modify: `lib/db/migrations.ts`

- [ ] **Step 1: Add v3 migration block**

Append inside `runMigrations`, after the `version < 2` block:

```ts
  if (version < 3) {
    // Drop the unused price_history table
    try { await db.execAsync('DROP TABLE IF EXISTS price_history'); } catch {}

    // Create the new purchase_history schema (store_id, nullable plan_id)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS purchase_history_v3 (
        id           TEXT PRIMARY KEY,
        plan_id      TEXT REFERENCES weekly_plans(id),
        item_name    TEXT NOT NULL,
        store_id     TEXT REFERENCES stores(id),
        brand        TEXT,
        product_name TEXT,
        qty_amount   REAL,
        qty_unit     TEXT CHECK (qty_unit IN ('g', 'kg', 'mL', 'L', 'units')),
        price        REAL,
        is_sale      INTEGER NOT NULL DEFAULT 0,
        barcode      TEXT,
        purchased_at TEXT NOT NULL
      )
    `);

    // Migrate existing rows — map free-text store names to stores.id
    const existing = await db.getAllAsync<{
      id: string; plan_id: string; item_name: string; store: string;
      brand: string | null; product_name: string | null;
      qty_amount: number | null; qty_unit: string | null;
      price: number | null; is_sale: number; barcode: string | null;
      purchased_at: string;
    }>('SELECT * FROM purchase_history');

    if (existing.length > 0) {
      const existingStores = await db.getAllAsync<{ id: string; chain: string }>(
        'SELECT id, chain FROM stores',
      );
      const storeMap = new Map<string, string>();
      for (const s of existingStores) {
        storeMap.set(s.chain.toLowerCase(), s.id);
      }

      // Create missing store entries for any unrecognised store names
      const distinctStoreNames = [...new Set(existing.map(r => r.store))];
      for (const name of distinctStoreNames) {
        const key = name.toLowerCase();
        if (!storeMap.has(key)) {
          const id = generateId();
          await db.runAsync(
            'INSERT INTO stores (id, chain, branch, created_at) VALUES (?, ?, ?, ?)',
            [id, name, '', new Date().toISOString()],
          );
          storeMap.set(key, id);
        }
      }

      // Copy rows to new table
      for (const row of existing) {
        const storeId = storeMap.get(row.store.toLowerCase()) ?? null;
        await db.runAsync(
          `INSERT INTO purchase_history_v3
             (id, plan_id, item_name, store_id, brand, product_name,
              qty_amount, qty_unit, price, is_sale, barcode, purchased_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [row.id, row.plan_id, row.item_name, storeId,
           row.brand, row.product_name, row.qty_amount, row.qty_unit,
           row.price, row.is_sale, row.barcode, row.purchased_at],
        );
      }
    }

    await db.execAsync('DROP TABLE IF EXISTS purchase_history');
    await db.execAsync('ALTER TABLE purchase_history_v3 RENAME TO purchase_history');
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_purchase_history_item_name
        ON purchase_history(item_name);
      CREATE INDEX IF NOT EXISTS idx_purchase_history_barcode
        ON purchase_history(barcode);
    `);

    await db.execAsync('PRAGMA user_version = 3');
  }
```

- [ ] **Step 2: Add `generateId` import at top of migrations.ts**

```ts
import { generateId } from '../uuid';
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/db/migrations.ts
git commit -m "feat: migration v3 — drop price_history, replace store text with store_id FK"
```

---

## Task 5: Update types

**Files:**
- Modify: `types/db.ts`

- [ ] **Step 1: Update `PurchaseHistoryRow`**

Replace the existing `PurchaseHistoryRow` interface:

```ts
export interface PurchaseHistoryRow {
  id: string;
  plan_id: string | null;
  item_name: string;
  store_id: string | null;
  brand: string | null;
  product_name: string | null;
  qty_amount: number | null;
  qty_unit: QtyUnit | null;
  price: number | null;
  is_sale: 0 | 1;
  barcode: string | null;
  purchased_at: string;
}
```

- [ ] **Step 2: Add `PricePoint` interface**

Append after `PurchaseHistoryRow`:

```ts
export interface PricePoint {
  chain: string;
  purchasedAt: string;
  normalisedPrice: number;
  isOnSale: boolean;
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: type errors surfaced in any code that still references `row.store` on a `PurchaseHistoryRow`. Fix them by referencing `row.store_id` instead, or note them for the next tasks.

- [ ] **Step 4: Commit**

```bash
git add types/db.ts
git commit -m "feat: update PurchaseHistoryRow for store_id, add PricePoint type"
```

---

## Task 6: useStores hook

**Files:**
- Create: `hooks/useStores.ts`
- Create: `__tests__/hooks/useStores.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/hooks/useStores.test.ts
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useStores } from '../../hooks/useStores';

const mockStoreRows = [
  { id: 's1', chain: 'Woolworths', branch: '', created_at: '2026-01-01' },
  { id: 's2', chain: 'Coles', branch: '', created_at: '2026-01-01' },
];

const mockDb = {
  getAllAsync: jest.fn().mockResolvedValue(mockStoreRows),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  runAsync: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../providers/DatabaseProvider', () => ({
  useDb: () => mockDb,
}));

describe('useStores', () => {
  beforeEach(() => {
    mockDb.getAllAsync.mockClear();
    mockDb.getFirstAsync.mockClear();
    mockDb.runAsync.mockClear();
    mockDb.getAllAsync.mockResolvedValue(mockStoreRows);
    mockDb.getFirstAsync.mockResolvedValue(null);
  });

  it('loads all stores sorted by chain', async () => {
    const { result } = renderHook(() => useStores());
    await waitFor(() => expect(result.current.stores).toHaveLength(2));
    expect(result.current.stores[0].chain).toBe('Woolworths');
  });

  it('resolveOrCreate returns existing store id', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ id: 's1' });
    const { result } = renderHook(() => useStores());
    await waitFor(() => expect(result.current.stores).toHaveLength(2));
    const id = await result.current.resolveOrCreate('Woolworths');
    expect(id).toBe('s1');
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it('resolveOrCreate inserts new store when not found', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);
    const { result } = renderHook(() => useStores());
    await waitFor(() => expect(result.current.stores).toHaveLength(2));
    const id = await result.current.resolveOrCreate('ALDI');
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO stores'),
      expect.any(Array),
    );
    expect(typeof id).toBe('string');
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx jest __tests__/hooks/useStores.test.ts --no-coverage
```

Expected: `Cannot find module '../../hooks/useStores'`

- [ ] **Step 3: Implement**

```ts
// hooks/useStores.ts
import { useState, useEffect, useCallback } from 'react';
import { useDb } from '../providers/DatabaseProvider';
import { generateId } from '../lib/uuid';
import type { StoreRow } from '../types/db';

export function useStores() {
  const db = useDb();
  const [stores, setStores] = useState<StoreRow[]>([]);

  const load = useCallback(async () => {
    const rows = await db.getAllAsync<StoreRow>(
      'SELECT * FROM stores ORDER BY chain ASC',
    );
    setStores(rows);
  }, [db]);

  useEffect(() => { load(); }, [load]);

  const resolveOrCreate = useCallback(async (chainName: string): Promise<string> => {
    const existing = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM stores WHERE LOWER(chain) = LOWER(?)',
      [chainName],
    );
    if (existing) return existing.id;
    const id = generateId();
    await db.runAsync(
      'INSERT INTO stores (id, chain, branch, created_at) VALUES (?, ?, ?, ?)',
      [id, chainName, '', new Date().toISOString()],
    );
    await load();
    return id;
  }, [db, load]);

  return { stores, resolveOrCreate, reload: load };
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest __tests__/hooks/useStores.test.ts --no-coverage
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add hooks/useStores.ts __tests__/hooks/useStores.test.ts
git commit -m "feat: add useStores hook with resolveOrCreate"
```

---

## Task 7: Update usePurchaseHistory

**Files:**
- Modify: `hooks/usePurchaseHistory.ts`
- Modify: `__tests__/hooks/usePurchaseHistory.test.ts`

The public `AddPurchaseData` interface keeps `store: string` (chain name). `addRecord` resolves it to a `store_id` internally before inserting, using the same `resolveOrCreate` logic as `useStores`.

- [ ] **Step 1: Add internal resolveOrCreateStore helper**

Add this function above `usePurchaseHistory` in `hooks/usePurchaseHistory.ts`:

```ts
import type { SQLiteDatabase } from 'expo-sqlite';
import { generateId } from '../lib/uuid';

async function resolveOrCreateStore(
  db: SQLiteDatabase,
  chainName: string,
): Promise<string> {
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM stores WHERE LOWER(chain) = LOWER(?)',
    [chainName],
  );
  if (existing) return existing.id;
  const id = generateId();
  await db.runAsync(
    'INSERT INTO stores (id, chain, branch, created_at) VALUES (?, ?, ?, ?)',
    [id, chainName, '', new Date().toISOString()],
  );
  return id;
}
```

- [ ] **Step 2: Update `addRecord` to use store_id**

Replace the existing `addRecord` implementation inside `usePurchaseHistory`:

```ts
const addRecord = useCallback(async (data: AddPurchaseData) => {
  const id = generateId();
  const storeId = await resolveOrCreateStore(db, data.store);
  await db.runAsync(
    `INSERT INTO purchase_history
       (id, plan_id, item_name, store_id, brand, product_name,
        qty_amount, qty_unit, price, is_sale, barcode, purchased_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.plan_id, data.item_name, storeId, data.brand,
     data.product_name, data.qty_amount, data.qty_unit,
     data.price, data.is_sale, data.barcode, data.purchased_at],
  );
  await load();
}, [db, load]);
```

- [ ] **Step 3: Update the existing test**

In `__tests__/hooks/usePurchaseHistory.test.ts`, update `mockDb` to handle the store lookup:

```ts
const mockDb = {
  getAllAsync: jest.fn(async (sql: string) => {
    if (sql.includes('plan_id = ?')) return mockRows;
    if (sql.includes('LOWER(item_name)')) return mockRows;
    if (sql.includes('barcode =')) return mockRows;
    return [];
  }),
  getFirstAsync: jest.fn().mockResolvedValue({ id: 'store-1' }), // store lookup
  runAsync: jest.fn().mockResolvedValue(undefined),
};
```

Update the `addRecord` assertion in the `'addRecord inserts a row and reloads'` test to verify `store_id` is used:

```ts
expect(mockDb.runAsync).toHaveBeenCalledWith(
  expect.stringContaining('INSERT INTO purchase_history'),
  expect.arrayContaining(['store-1']),
);
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest __tests__/hooks/usePurchaseHistory.test.ts --no-coverage
```

Expected: all 4 tests pass.

- [ ] **Step 5: Verify full TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add hooks/usePurchaseHistory.ts __tests__/hooks/usePurchaseHistory.test.ts
git commit -m "feat: resolve store chain name to store_id in usePurchaseHistory.addRecord"
```

---

## Task 8: usePriceHistory hook

**Files:**
- Create: `hooks/usePriceHistory.ts`
- Create: `__tests__/hooks/usePriceHistory.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/hooks/usePriceHistory.test.ts
import { renderHook, waitFor } from '@testing-library/react-native';
import { usePriceHistory } from '../../hooks/usePriceHistory';

const mockDb = {
  getAllAsync: jest.fn().mockResolvedValue([]),
};

jest.mock('../../providers/DatabaseProvider', () => ({
  useDb: () => mockDb,
}));

const makeRow = (overrides = {}) => ({
  id: '1',
  plan_id: null,
  item_name: 'Oats',
  store_id: 's1',
  brand: 'Woolworths',
  product_name: 'Rolled Oats 1kg',
  qty_amount: 1000,
  qty_unit: 'g',
  price: 4.50,
  is_sale: 0,
  barcode: null,
  purchased_at: '2026-01-15T10:00:00Z',
  chain: 'Woolworths',
  ...overrides,
});

describe('usePriceHistory', () => {
  beforeEach(() => mockDb.getAllAsync.mockResolvedValue([]));

  it('returns empty array when brand or productName is null', async () => {
    const { result } = renderHook(() => usePriceHistory(null, null));
    await waitFor(() => expect(result.current.points).toEqual([]));
    expect(mockDb.getAllAsync).not.toHaveBeenCalled();
  });

  it('queries by brand and product_name', async () => {
    mockDb.getAllAsync.mockResolvedValue([makeRow()]);
    const { result } = renderHook(() =>
      usePriceHistory('Woolworths', 'Rolled Oats 1kg'),
    );
    await waitFor(() => expect(result.current.points).toHaveLength(1));
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('ph.brand = ?'),
      ['Woolworths', 'Rolled Oats 1kg'],
    );
  });

  it('normalises g price to ¢/100g', async () => {
    mockDb.getAllAsync.mockResolvedValue([makeRow({ price: 4.50, qty_amount: 1000, qty_unit: 'g' })]);
    const { result } = renderHook(() =>
      usePriceHistory('Woolworths', 'Rolled Oats 1kg'),
    );
    await waitFor(() => expect(result.current.points).toHaveLength(1));
    expect(result.current.points[0].normalisedPrice).toBeCloseTo(0.45);
  });

  it('maps isOnSale correctly', async () => {
    mockDb.getAllAsync.mockResolvedValue([makeRow({ is_sale: 1 })]);
    const { result } = renderHook(() =>
      usePriceHistory('Woolworths', 'Rolled Oats 1kg'),
    );
    await waitFor(() => expect(result.current.points).toHaveLength(1));
    expect(result.current.points[0].isOnSale).toBe(true);
  });

  it('exposes a reload function', async () => {
    const { result } = renderHook(() =>
      usePriceHistory('Woolworths', 'Rolled Oats 1kg'),
    );
    await waitFor(() => expect(result.current.points).toBeDefined());
    expect(typeof result.current.reload).toBe('function');
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx jest __tests__/hooks/usePriceHistory.test.ts --no-coverage
```

Expected: `Cannot find module '../../hooks/usePriceHistory'`

- [ ] **Step 3: Implement**

```ts
// hooks/usePriceHistory.ts
import { useState, useEffect, useCallback } from 'react';
import { useDb } from '../providers/DatabaseProvider';
import { normalisePrice } from '../lib/normalisePrice';
import type { PricePoint, PurchaseHistoryRow, QtyUnit } from '../types/db';

type PurchaseWithChain = PurchaseHistoryRow & { chain: string };

export function usePriceHistory(
  brand: string | null,
  productName: string | null,
): { points: PricePoint[]; reload: () => void } {
  const db = useDb();
  const [points, setPoints] = useState<PricePoint[]>([]);

  const load = useCallback(async () => {
    if (!brand || !productName) {
      setPoints([]);
      return;
    }
    const rows = await db.getAllAsync<PurchaseWithChain>(
      `SELECT ph.*, s.chain
       FROM purchase_history ph
       JOIN stores s ON ph.store_id = s.id
       WHERE ph.brand = ? AND ph.product_name = ?
         AND ph.price IS NOT NULL
         AND ph.qty_amount IS NOT NULL
         AND ph.qty_unit IS NOT NULL
       ORDER BY ph.purchased_at ASC`,
      [brand, productName],
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
  }, [brand, productName, db]);

  useEffect(() => { load(); }, [load]);

  return { points, reload: load };
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest __tests__/hooks/usePriceHistory.test.ts --no-coverage
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add hooks/usePriceHistory.ts __tests__/hooks/usePriceHistory.test.ts
git commit -m "feat: add usePriceHistory hook"
```

---

## Task 9: Chart layout utilities

**Files:**
- Create: `lib/chartLayout.ts`
- Create: `__tests__/lib/chartLayout.test.ts`

This is the pure-function core of the chart. It converts `PricePoint[]` into SVG-ready coordinates.

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/lib/chartLayout.test.ts
import {
  filterByTimeRange,
  buildYScale,
  buildXScale,
  getStoreColor,
  STORE_COLORS,
} from '../../lib/chartLayout';
import type { PricePoint } from '../../types/db';

const makePoint = (chain: string, purchasedAt: string, normalisedPrice: number, isOnSale = false): PricePoint => ({
  chain, purchasedAt, normalisedPrice, isOnSale,
});

describe('filterByTimeRange', () => {
  const now = new Date('2026-05-24T00:00:00Z');

  it('All returns all points', () => {
    const pts = [makePoint('Coles', '2020-01-01T00:00:00Z', 0.5)];
    expect(filterByTimeRange(pts, 'All', now)).toHaveLength(1);
  });

  it('3M filters out points older than 3 months', () => {
    const pts = [
      makePoint('Coles', '2026-05-01T00:00:00Z', 0.5),  // in range
      makePoint('Coles', '2025-01-01T00:00:00Z', 0.5),  // out of range
    ];
    const result = filterByTimeRange(pts, '3M', now);
    expect(result).toHaveLength(1);
    expect(result[0].purchasedAt).toBe('2026-05-01T00:00:00Z');
  });

  it('6M keeps 6-month-old points', () => {
    const sixMonthsAgo = new Date('2025-11-24T00:00:00Z').toISOString();
    const pts = [makePoint('Coles', sixMonthsAgo, 0.5)];
    expect(filterByTimeRange(pts, '6M', now)).toHaveLength(1);
  });
});

describe('buildYScale', () => {
  it('starts at 0.20 minimum and rounds up to next 0.10 tick', () => {
    const scale = buildYScale([0.35, 0.42, 0.38], 100);
    expect(scale.min).toBe(0.20);
    expect(scale.max).toBeGreaterThanOrEqual(0.50); // rounds up from 0.42
    expect(scale.ticks.length).toBeGreaterThanOrEqual(5);
  });

  it('maps a value to a y coordinate (higher value = lower y)', () => {
    const scale = buildYScale([0.40], 100);
    const y040 = scale.toY(0.40);
    const y050 = scale.toY(0.50);
    expect(y040).toBeGreaterThan(y050); // 0.40 is cheaper, so higher on screen = lower y? No.
    // Higher value = more expensive = higher on chart = lower y coordinate
    expect(y050).toBeLessThan(y040);
  });
});

describe('buildXScale', () => {
  it('maps a date to an x coordinate within chartWidth', () => {
    const dates = ['2026-01-01T00:00:00Z', '2026-06-01T00:00:00Z'];
    const scale = buildXScale(dates, 200);
    expect(scale.toX('2026-01-01T00:00:00Z')).toBeCloseTo(0, 0);
    expect(scale.toX('2026-06-01T00:00:00Z')).toBeCloseTo(200, 0);
  });
});

describe('getStoreColor', () => {
  it('returns consistent colour for the same index', () => {
    expect(getStoreColor(0)).toBe(STORE_COLORS[0]);
    expect(getStoreColor(1)).toBe(STORE_COLORS[1]);
  });

  it('wraps around when index exceeds palette length', () => {
    expect(getStoreColor(STORE_COLORS.length)).toBe(STORE_COLORS[0]);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx jest __tests__/lib/chartLayout.test.ts --no-coverage
```

Expected: `Cannot find module '../../lib/chartLayout'`

- [ ] **Step 3: Implement**

```ts
// lib/chartLayout.ts
import type { PricePoint } from '../types/db';

export type TimeRange = '3M' | '6M' | '1Y' | 'All';
export type ChartUnit = 'per100' | 'total';

export const STORE_COLORS = ['#2A7A66', '#B8513C', '#7090B8'] as const;
export const CHART_MARGINS = { left: 34, right: 8, top: 8, bottom: 22 } as const;
export const DOT_RADIUS = 3.5;
export const SALE_RING_RADIUS = 6.5;

export function getStoreColor(index: number): string {
  return STORE_COLORS[index % STORE_COLORS.length];
}

export function filterByTimeRange(
  points: PricePoint[],
  range: TimeRange,
  now = new Date(),
): PricePoint[] {
  if (range === 'All') return points;
  const months = range === '3M' ? 3 : range === '6M' ? 6 : 12;
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);
  return points.filter(p => new Date(p.purchasedAt) >= cutoff);
}

export interface YScale {
  min: number;
  max: number;
  ticks: Array<{ value: number; y: number; label: string }>;
  toY: (value: number) => number;
}

export function buildYScale(values: number[], chartAreaHeight: number): YScale {
  const rawMax = Math.max(...values, 0.20);
  const min = 0.20;
  // Round up to next 0.10 tick, ensure at least 5 ticks (0.20 to 0.60)
  const max = Math.max(Math.ceil(rawMax * 10) / 10, 0.60);
  const range = max - min;

  const toY = (value: number): number =>
    chartAreaHeight - ((value - min) / range) * chartAreaHeight;

  const tickCount = Math.round((max - min) / 0.10) + 1;
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const value = min + i * 0.10;
    return {
      value,
      y: toY(value),
      label: `${Math.round(value * 100)}¢`,
    };
  });

  return { min, max, ticks, toY };
}

export interface XScale {
  toX: (isoDate: string) => number;
  monthLabels: Array<{ label: string; x: number }>;
}

export function buildXScale(isoDates: string[], chartAreaWidth: number): XScale {
  if (isoDates.length === 0) {
    return { toX: () => 0, monthLabels: [] };
  }

  const timestamps = isoDates.map(d => new Date(d).getTime());
  const minT = Math.min(...timestamps);
  const maxT = Math.max(...timestamps);
  const span = maxT - minT || 1;

  const toX = (isoDate: string): number => {
    const t = new Date(isoDate).getTime();
    return ((t - minT) / span) * chartAreaWidth;
  };

  // Build month labels at first-of-month boundaries
  const start = new Date(minT);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(maxT);
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const monthLabels: Array<{ label: string; x: number }> = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const x = toX(cursor.toISOString());
    if (x >= 0 && x <= chartAreaWidth) {
      monthLabels.push({ label: MONTHS[cursor.getMonth()], x });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return { toX, monthLabels };
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest __tests__/lib/chartLayout.test.ts --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/chartLayout.ts __tests__/lib/chartLayout.test.ts
git commit -m "feat: add chartLayout utilities (Y/X scales, time filter, store colours)"
```

---

## Task 10: PriceHistoryChart component

**Files:**
- Create: `components/PriceHistoryChart.tsx`

This component owns all chart state (time range, unit toggle, add-price sheet visibility). It reads from `usePriceHistory` and renders a custom SVG chart.

- [ ] **Step 1: Create the component**

```tsx
// components/PriceHistoryChart.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Line, Polyline, Circle, Text as SvgText } from 'react-native-svg';
import { colors, font, spacing, radius } from '../constants/tokens';
import { usePriceHistory } from '../hooks/usePriceHistory';
import {
  filterByTimeRange,
  buildYScale,
  buildXScale,
  getStoreColor,
  CHART_MARGINS,
  DOT_RADIUS,
  SALE_RING_RADIUS,
  type TimeRange,
  type ChartUnit,
} from '../lib/chartLayout';
import type { PricePoint } from '../types/db';
import { AddPriceSheet } from './AddPriceSheet';

interface Props {
  brand: string | null;
  productName: string | null;
}

const TIME_RANGES: TimeRange[] = ['3M', '6M', '1Y', 'All'];

export function PriceHistoryChart({ brand, productName }: Props) {
  const { points, reload } = usePriceHistory(brand, productName);
  const [timeRange, setTimeRange] = useState<TimeRange>('6M');
  const [unit, setUnit] = useState<ChartUnit>('per100');
  const [chartWidth, setChartWidth] = useState(0);
  const [addPriceVisible, setAddPriceVisible] = useState(false);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setChartWidth(e.nativeEvent.layout.width);
  }, []);

  const filtered = filterByTimeRange(points, timeRange);

  // Group by chain, assign stable colours by sorted chain name
  const chains = [...new Set(filtered.map(p => p.chain))].sort();
  const chainMap = new Map<string, PricePoint[]>();
  for (const chain of chains) {
    chainMap.set(chain, filtered.filter(p => p.chain === chain));
  }

  // Determine display value based on unit toggle
  const displayValue = (p: PricePoint) =>
    unit === 'per100' ? p.normalisedPrice : p.normalisedPrice; // both same until total mode wired

  const allValues = filtered.map(displayValue);
  const CHART_H = 130;
  const areaW = Math.max(chartWidth - CHART_MARGINS.left - CHART_MARGINS.right, 0);
  const areaH = CHART_H - CHART_MARGINS.top - CHART_MARGINS.bottom;

  const yScale = buildYScale(allValues.length ? allValues : [0.40], areaH);
  const xScale = buildXScale(filtered.map(p => p.purchasedAt), areaW);

  // Best value: lowest most-recent price per chain
  const bestValue: { chain: string; value: number } | null = (() => {
    if (!chains.length) return null;
    let best: { chain: string; value: number } | null = null;
    for (const chain of chains) {
      const pts = chainMap.get(chain)!;
      const last = pts[pts.length - 1];
      const v = displayValue(last);
      if (!best || v < best.value) best = { chain, value: v };
    }
    return best;
  })();

  const toSvgX = (iso: string) => CHART_MARGINS.left + xScale.toX(iso);
  const toSvgY = (v: number) => CHART_MARGINS.top + yScale.toY(v);

  return (
    <View>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionDot} />
        <Text style={styles.sectionTitle}>PRICE HISTORY</Text>
        <TouchableOpacity onPress={() => setAddPriceVisible(true)}>
          <Text style={styles.addAction}>+ Add price</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        {/* Toolbar */}
        <View style={styles.toolbar}>
          <View style={styles.timeTabs}>
            {TIME_RANGES.map(r => (
              <TouchableOpacity
                key={r}
                onPress={() => setTimeRange(r)}
                style={[styles.timeTab, timeRange === r && styles.timeTabActive]}
              >
                <Text style={[styles.timeTabText, timeRange === r && styles.timeTabTextActive]}>
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.unitToggle}>
            {(['total', 'per100'] as ChartUnit[]).map(u => (
              <TouchableOpacity
                key={u}
                onPress={() => setUnit(u)}
                style={[styles.unitOpt, unit === u && styles.unitOptActive]}
              >
                <Text style={[styles.unitOptText, unit === u && styles.unitOptTextActive]}>
                  {u === 'per100' ? '/100g' : 'Total'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Chart or empty state */}
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {'No price data yet.\nPrices are recorded when you log a purchase.'}
            </Text>
          </View>
        ) : (
          <View onLayout={onLayout}>
            {chartWidth > 0 && (
              <Svg width={chartWidth} height={CHART_H}>
                {/* Y axis line */}
                <Line
                  x1={CHART_MARGINS.left} y1={CHART_MARGINS.top}
                  x2={CHART_MARGINS.left} y2={CHART_MARGINS.top + areaH}
                  stroke={colors.divider} strokeWidth={1}
                />
                {/* X axis line */}
                <Line
                  x1={CHART_MARGINS.left} y1={CHART_MARGINS.top + areaH}
                  x2={chartWidth - CHART_MARGINS.right} y2={CHART_MARGINS.top + areaH}
                  stroke={colors.divider} strokeWidth={1}
                />
                {/* Y grid lines + labels */}
                {yScale.ticks.map(tick => (
                  <React.Fragment key={tick.value}>
                    <Line
                      x1={CHART_MARGINS.left}
                      y1={CHART_MARGINS.top + tick.y}
                      x2={chartWidth - CHART_MARGINS.right}
                      y2={CHART_MARGINS.top + tick.y}
                      stroke={colors.divider}
                      strokeWidth={0.8}
                      strokeDasharray="3,3"
                    />
                    <SvgText
                      x={CHART_MARGINS.left - 4}
                      y={CHART_MARGINS.top + tick.y + 3}
                      textAnchor="end"
                      fontSize={font.size['2xs']}
                      fontFamily={font.family.semibold}
                      fill={colors.textTertiary}
                    >
                      {tick.label}
                    </SvgText>
                  </React.Fragment>
                ))}
                {/* X axis month labels */}
                {xScale.monthLabels.map(ml => (
                  <SvgText
                    key={ml.label + ml.x}
                    x={CHART_MARGINS.left + ml.x}
                    y={CHART_MARGINS.top + areaH + 14}
                    textAnchor="middle"
                    fontSize={font.size['2xs']}
                    fontFamily={font.family.semibold}
                    fill={colors.textTertiary}
                  >
                    {ml.label}
                  </SvgText>
                ))}

                {/* Chain lines */}
                {chains.map((chain, idx) => {
                  const pts = chainMap.get(chain)!;
                  const color = getStoreColor(idx);
                  const isSparse = pts.length < 3;
                  const regularPts = pts.filter(p => !p.isOnSale);
                  const salePts = pts.filter(p => p.isOnSale);

                  // Regular line points
                  const regularCoords = regularPts
                    .map(p => `${toSvgX(p.purchasedAt)},${toSvgY(displayValue(p))}`)
                    .join(' ');

                  return (
                    <React.Fragment key={chain}>
                      {/* Regular line */}
                      {regularPts.length > 1 && (
                        <Polyline
                          points={regularCoords}
                          fill="none"
                          stroke={color}
                          strokeWidth={2}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          strokeDasharray={isSparse ? '5,3' : undefined}
                          opacity={isSparse ? 0.8 : 1}
                        />
                      )}
                      {/* Regular dots */}
                      {regularPts.map(p => (
                        <Circle
                          key={p.purchasedAt}
                          cx={toSvgX(p.purchasedAt)}
                          cy={toSvgY(displayValue(p))}
                          r={DOT_RADIUS}
                          fill={color}
                        />
                      ))}
                      {/* Sale points with dashed arms */}
                      {salePts.map(p => {
                        const sx = toSvgX(p.purchasedAt);
                        const sy = toSvgY(displayValue(p));
                        const prev = regularPts
                          .filter(r => r.purchasedAt < p.purchasedAt)
                          .at(-1);
                        const next = regularPts
                          .find(r => r.purchasedAt > p.purchasedAt);
                        return (
                          <React.Fragment key={'sale-' + p.purchasedAt}>
                            {prev && (
                              <Line
                                x1={toSvgX(prev.purchasedAt)}
                                y1={toSvgY(displayValue(prev))}
                                x2={sx} y2={sy}
                                stroke={color} strokeWidth={1.5}
                                strokeDasharray="3,2"
                              />
                            )}
                            {next && (
                              <Line
                                x1={sx} y1={sy}
                                x2={toSvgX(next.purchasedAt)}
                                y2={toSvgY(displayValue(next))}
                                stroke={color} strokeWidth={1.5}
                                strokeDasharray="3,2"
                              />
                            )}
                            <Circle cx={sx} cy={sy} r={DOT_RADIUS} fill={color} />
                            <Circle
                              cx={sx} cy={sy} r={SALE_RING_RADIUS}
                              fill="none" stroke={colors.orange} strokeWidth={2}
                            />
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </Svg>
            )}
          </View>
        )}

        {/* Best value strip */}
        {bestValue && (
          <View style={styles.bestValue}>
            <Text style={styles.bestValueLabel}>Best value now</Text>
            <Text style={styles.bestValueAmount}>
              {bestValue.chain}
              <Text style={styles.bestValueSub}>
                {` ${(bestValue.value * 100).toFixed(0)}¢/100g`}
              </Text>
            </Text>
          </View>
        )}

        {/* Legend */}
        <View style={styles.legend}>
          {chains.map((chain, idx) => (
            <View key={chain} style={styles.legendPill}>
              <View style={[styles.legendDot, { backgroundColor: getStoreColor(idx) }]} />
              <Text style={styles.legendText}>{chain}</Text>
            </View>
          ))}
          {filtered.some(p => p.isOnSale) && (
            <View style={[styles.legendPill, styles.legendSale]}>
              <View style={styles.legendSaleIcon} />
              <Text style={styles.legendSaleText}>Sale</Text>
            </View>
          )}
        </View>
      </View>

      <AddPriceSheet
        visible={addPriceVisible}
        brand={brand}
        productName={productName}
        onClose={() => setAddPriceVisible(false)}
        onSaved={() => { setAddPriceVisible(false); reload(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
  },
  sectionDot: {
    width: 7,
    height: 7,
    borderRadius: 9999,
    backgroundColor: colors.terracotta,
  },
  sectionTitle: {
    flex: 1,
    fontFamily: font.family.bold,
    fontSize: font.size.sm,
    color: colors.terracotta,
    letterSpacing: font.tracking.category,
  },
  addAction: {
    fontFamily: font.family.bold,
    fontSize: font.size.sm,
    color: colors.green,
  },
  card: {
    marginHorizontal: spacing[3],
    backgroundColor: colors.card,
    borderRadius: radius.md,
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
    padding: spacing[3] + 2,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  timeTabs: { flexDirection: 'row', gap: 2 },
  timeTab: { paddingVertical: 3, paddingHorizontal: spacing[2] + 2, borderRadius: 9999 },
  timeTabActive: { backgroundColor: colors.chipSurface },
  timeTabText: { fontFamily: font.family.semibold, fontSize: font.size.sm, color: colors.textTertiary },
  timeTabTextActive: { color: colors.green },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: colors.cream,
    borderRadius: 9999,
    padding: 2,
    gap: 2,
  },
  unitOpt: { paddingVertical: 3, paddingHorizontal: spacing[2] + 2, borderRadius: 9999 },
  unitOptActive: {
    backgroundColor: colors.card,
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 2,
  },
  unitOptText: { fontFamily: font.family.semibold, fontSize: font.size.sm, color: colors.textTertiary },
  unitOptTextActive: { fontFamily: font.family.bold, color: colors.green },
  empty: {
    paddingVertical: spacing[10],
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: font.family.semibold,
    fontSize: font.size.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
  bestValue: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[2] + 2,
    backgroundColor: colors.cream,
    borderRadius: radius.sm,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },
  bestValueLabel: {
    fontFamily: font.family.semibold,
    fontSize: font.size.sm,
    color: colors.textSecondary,
  },
  bestValueAmount: {
    fontFamily: font.family.extrabold,
    fontSize: font.size.md,
    color: colors.orange,
  },
  bestValueSub: {
    fontFamily: font.family.medium,
    fontSize: font.size.sm,
    color: colors.textTertiary,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1] + 1,
    marginTop: spacing[2] + 1,
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.cream,
    borderRadius: 9999,
    paddingVertical: 3,
    paddingHorizontal: spacing[2] + 1,
  },
  legendDot: { width: 7, height: 7, borderRadius: 9999 },
  legendText: { fontFamily: font.family.semibold, fontSize: font.size.xs, color: colors.textSecondary },
  legendSale: { backgroundColor: '#FEF0E6' },
  legendSaleIcon: {
    width: 10,
    height: 10,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: colors.orange,
  },
  legendSaleText: { fontFamily: font.family.semibold, fontSize: font.size.xs, color: colors.orange },
});
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/PriceHistoryChart.tsx
git commit -m "feat: add PriceHistoryChart SVG component"
```

---

## Task 11: AddPriceSheet component

**Files:**
- Create: `components/AddPriceSheet.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/AddPriceSheet.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Switch,
  StyleSheet, Modal, ScrollView, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, font, spacing, radius } from '../constants/tokens';
import { useStores } from '../hooks/useStores';
import { usePurchaseHistory } from '../hooks/usePurchaseHistory';
import type { QtyUnit } from '../types/db';

interface Props {
  visible: boolean;
  brand: string | null;
  productName: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function AddPriceSheet({ visible, brand, productName, onClose, onSaved }: Props) {
  const { stores, resolveOrCreate } = useStores();
  const { addRecord } = usePurchaseHistory(null);

  const [selectedChain, setSelectedChain] = useState('');
  const [newStoreName, setNewStoreName] = useState('');
  const [addingNewStore, setAddingNewStore] = useState(false);
  const [price, setPrice] = useState('');
  const [qtyAmount, setQtyAmount] = useState('1');
  const [qtyUnit, setQtyUnit] = useState<QtyUnit>('kg');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isOnSale, setIsOnSale] = useState(false);
  const [saving, setSaving] = useState(false);

  // Default to first store when sheet opens
  useEffect(() => {
    if (visible && stores.length > 0 && !selectedChain) {
      setSelectedChain(stores[0].chain);
    }
  }, [visible, stores]);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

  const canSave = (selectedChain || (addingNewStore && newStoreName.trim())) && price.trim();

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
      // Reset form
      setPrice('');
      setIsOnSale(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Log a price</Text>

          {/* Store selection */}
          <Text style={styles.fieldLabel}>STORE</Text>
          <View style={styles.storeList}>
            {stores.map(store => (
              <TouchableOpacity
                key={store.id}
                style={styles.storeRow}
                onPress={() => { setSelectedChain(store.chain); setAddingNewStore(false); }}
              >
                <View style={[styles.radio, selectedChain === store.chain && !addingNewStore && styles.radioSelected]}>
                  {selectedChain === store.chain && !addingNewStore && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.storeName}>{store.chain}</Text>
              </TouchableOpacity>
            ))}
            {/* Add new store row */}
            {addingNewStore ? (
              <TextInput
                style={[styles.fieldInput, { marginTop: spacing[1] }]}
                placeholder="New store name"
                placeholderTextColor={colors.textTertiary}
                value={newStoreName}
                onChangeText={setNewStoreName}
                autoFocus
              />
            ) : (
              <TouchableOpacity
                style={styles.addStoreRow}
                onPress={() => { setAddingNewStore(true); setSelectedChain(''); }}
              >
                <View style={styles.addStoreIcon}>
                  <Text style={styles.addStoreIconText}>+</Text>
                </View>
                <Text style={styles.addStoreLabel}>Add new store…</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Price + Qty */}
          <View style={styles.inlineRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>PRICE</Text>
              <TextInput
                style={styles.fieldInput}
                value={price}
                onChangeText={setPrice}
                placeholder="$0.00"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>QTY</Text>
              <View style={styles.qtyRow}>
                <TextInput
                  style={[styles.fieldInput, { flex: 1 }]}
                  value={qtyAmount}
                  onChangeText={setQtyAmount}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity
                  style={styles.unitBtn}
                  onPress={() => {
                    const units: QtyUnit[] = ['g', 'kg', 'mL', 'L', 'units'];
                    const next = units[(units.indexOf(qtyUnit) + 1) % units.length];
                    setQtyUnit(next);
                  }}
                >
                  <Text style={styles.unitBtnText}>{qtyUnit}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Date */}
          <Text style={styles.fieldLabel}>DATE</Text>
          <TouchableOpacity
            style={styles.fieldInput}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={{ fontFamily: font.family.semibold, fontSize: font.size.md, color: colors.textPrimary }}>
              {formatDate(date)}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              maximumDate={new Date()}
              onChange={(_, selected) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selected) setDate(selected);
              }}
            />
          )}

          {/* Sale toggle */}
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Sale price</Text>
            <Switch
              value={isOnSale}
              onValueChange={setIsOnSale}
              trackColor={{ false: colors.divider, true: colors.orange }}
              thumbColor="#fff"
            />
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave || saving}
          >
            <Text style={styles.saveBtnText}>Save price</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[8],
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 9999,
    backgroundColor: colors.divider,
    alignSelf: 'center',
    marginVertical: spacing[3],
  },
  title: {
    fontFamily: font.family.bold,
    fontSize: font.size.xl,
    color: colors.textPrimary,
    marginBottom: spacing[4],
  },
  fieldLabel: {
    fontFamily: font.family.bold,
    fontSize: font.size.sm,
    color: colors.textTertiary,
    letterSpacing: font.tracking.label,
    marginBottom: spacing[1],
  },
  fieldInput: {
    backgroundColor: colors.cream,
    borderRadius: radius.sm + 3,
    padding: spacing[2] + 2,
    fontFamily: font.family.semibold,
    fontSize: font.size.md,
    color: colors.textPrimary,
    marginBottom: spacing[3],
  },
  storeList: { marginBottom: spacing[3] },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 2,
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  radio: {
    width: 16, height: 16, borderRadius: 9999,
    borderWidth: 2, borderColor: colors.divider,
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.green, backgroundColor: colors.green },
  radioDot: { width: 6, height: 6, borderRadius: 9999, backgroundColor: '#fff' },
  storeName: { fontFamily: font.family.semibold, fontSize: font.size.md, color: colors.textPrimary },
  addStoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 2,
    paddingVertical: spacing[2],
  },
  addStoreIcon: {
    width: 16, height: 16, borderRadius: 9999,
    borderWidth: 2, borderColor: colors.textTertiary,
    alignItems: 'center', justifyContent: 'center',
  },
  addStoreIconText: { fontSize: 11, color: colors.textTertiary, lineHeight: 13 },
  addStoreLabel: { fontFamily: font.family.semibold, fontSize: font.size.md, color: colors.textTertiary },
  inlineRow: { flexDirection: 'row', gap: spacing[2] },
  qtyRow: { flexDirection: 'row', gap: spacing[1] },
  unitBtn: {
    backgroundColor: colors.cream,
    borderRadius: radius.sm + 3,
    paddingHorizontal: spacing[2] + 2,
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  unitBtnText: { fontFamily: font.family.bold, fontSize: font.size.md, color: colors.green },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  toggleLabel: { fontFamily: font.family.semibold, fontSize: font.size.md, color: colors.textSecondary },
  saveBtn: {
    backgroundColor: colors.green,
    borderRadius: 9999,
    paddingVertical: spacing[2] + 2,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontFamily: font.family.bold, fontSize: font.size.md, color: colors.onGreen },
});
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/AddPriceSheet.tsx
git commit -m "feat: add AddPriceSheet bottom sheet component"
```

---

## Task 12: Integrate into FoodNutritionSheet

**Files:**
- Modify: `components/FoodNutritionSheet.tsx`

- [ ] **Step 1: Import PriceHistoryChart**

At the top of `FoodNutritionSheet.tsx`, add:

```ts
import { PriceHistoryChart } from './PriceHistoryChart';
```

- [ ] **Step 2: Add chart section at the bottom of the ScrollView**

Inside the `<ScrollView>` in `FoodNutritionSheet`, after all existing form fields (before the closing `</ScrollView>`), add:

```tsx
{existingEntry?.brand && existingEntry?.product_name && (
  <PriceHistoryChart
    brand={existingEntry.brand}
    productName={existingEntry.product_name}
  />
)}
```

Add a bottom spacer after it so the chart isn't flush against the done button:

```tsx
<View style={{ height: spacing[4] }} />
```

- [ ] **Step 3: Verify TypeScript and run existing tests**

```bash
npx tsc --noEmit
npx jest __tests__/components/FoodNutritionSheet.test.tsx --no-coverage
```

Expected: TypeScript clean, existing tests pass (the chart renders nothing if `existingEntry` is null, so mock-free tests are unaffected).

- [ ] **Step 4: Commit**

```bash
git add components/FoodNutritionSheet.tsx
git commit -m "feat: integrate PriceHistoryChart into FoodNutritionSheet"
```

---

## Task 13: Final verification

- [ ] **Step 1: Run the full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass. Fix any failures before continuing.

- [ ] **Step 2: TypeScript clean check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Start the app and verify the chart renders**

```bash
npx expo start --ios
```

Open a food item that has `brand` and `product_name` set. Verify:
- "PRICE HISTORY" section header appears at the bottom of the sheet
- Empty state shows "No price data yet." when no purchases exist for that brand+product
- "+ Add price" opens the sheet
- After saving a price entry, the chart refreshes and shows a dot

- [ ] **Step 4: Test the migration manually**

Run the app on a device/simulator that already has purchase history data. Verify:
- App launches without crash
- Existing purchases are preserved
- Their store names are visible in the `stores` table (check via Expo SQLite devtools or a debug log)

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: price tracking — chart, add price sheet, store FK migration"
```
