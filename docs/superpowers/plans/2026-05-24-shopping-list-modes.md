# Shopping List Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Quick/Review shopping modes with per-trip store selection, a review sheet for logging purchases, purchase history pre-fill, and a local barcode scanner.

**Architecture:** `useShoppingMode` (AsyncStorage) controls mode + active store per plan. `usePurchaseHistory` (SQLite) records what was bought and provides cross-plan pre-fill lookups. The barcode scanner is a full-screen modal route (`app/barcode-scanner.tsx`) that hands its result back to `ReviewItemSheet` via a module-level singleton (`lib/barcodeScanResult.ts`). `shop.tsx` detects the return via `useFocusEffect` and passes the result into the sheet.

**Tech Stack:** expo-sqlite, expo-camera (new install), @react-native-async-storage/async-storage, expo-router, Ionicons, react-native-reanimated

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `lib/db/schema.ts` | Add `purchase_history` table; remove `actual_price`/`store` from `shopping_items` |
| Modify | `lib/db/migrations.ts` | Add version-gated migration to drop the removed columns |
| Modify | `types/db.ts` | Add `PurchaseHistoryRow`; remove `actual_price`/`store` from `ShoppingItemRow` |
| Create | `hooks/usePurchaseHistory.ts` | SQLite CRUD + cross-plan lookups by item name and barcode |
| Create | `hooks/useShoppingMode.ts` | AsyncStorage mode + store state per plan, saved store list |
| Create | `components/StorePickerSheet.tsx` | Bottom sheet to select or create a store |
| Create | `lib/barcodeScanResult.ts` | Module-level singleton for scanner → sheet result handoff |
| Create | `components/ReviewItemSheet.tsx` | Bottom sheet with brand/product/qty/price/sale/barcode fields |
| Create | `app/barcode-scanner.tsx` | Full-screen camera modal with barcode detection |
| Modify | `app/_layout.tsx` | Register `barcode-scanner` as a modal Stack.Screen |
| Modify | `app/(tabs)/shop.tsx` | Mode toggle, store pill, review sheet integration |
| Modify | `__tests__/lib/db/migrations.test.ts` | Update to expect `purchase_history` table |
| Create | `__tests__/hooks/usePurchaseHistory.test.ts` | Hook tests |
| Create | `__tests__/hooks/useShoppingMode.test.ts` | Hook tests |

---

## Task 1: Install expo-camera

**Files:** `package.json`, `app.json` (if needed)

- [ ] **Step 1: Install the package**

```bash
npx expo install expo-camera
```

Expected: package added to `node_modules` and `package.json`. No app.json changes needed — expo-camera auto-configures via the Expo plugin system.

- [ ] **Step 2: Verify install**

```bash
npx expo-doctor
```

Expected: no new warnings related to expo-camera.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "install expo-camera"
```

---

## Task 2: Schema + migration

**Files:**
- Modify: `lib/db/schema.ts`
- Modify: `lib/db/migrations.ts`
- Modify: `__tests__/lib/db/migrations.test.ts`

- [ ] **Step 1: Write the failing test for the new table**

Add to `__tests__/lib/db/migrations.test.ts`:

```typescript
import { runMigrations } from '../../../lib/db/migrations';

const mockDb = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  getAllAsync: jest.fn().mockResolvedValue([{ user_version: 0 }]),
  runAsync: jest.fn().mockResolvedValue(undefined),
};

describe('runMigrations', () => {
  beforeEach(() => {
    mockDb.execAsync.mockClear();
    mockDb.getAllAsync.mockClear();
    mockDb.runAsync.mockClear();
    mockDb.getAllAsync.mockResolvedValue([{ user_version: 0 }]);
  });

  it('calls execAsync with SQL containing all core table names', async () => {
    await runMigrations(mockDb as any);
    const sql: string = mockDb.execAsync.mock.calls[0][0];
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS recipes');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS weekly_plans');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS shopping_items');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS purchase_history');
  });

  it('runs version-1 migration on a fresh database', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ user_version: 0 }]);
    await runMigrations(mockDb as any);
    const allSql = mockDb.execAsync.mock.calls.map((c: any[]) => c[0]).join('\n');
    expect(allSql).toContain('user_version = 1');
  });

  it('skips version-1 migration when already at version 1', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ user_version: 1 }]);
    await runMigrations(mockDb as any);
    const allSql = mockDb.execAsync.mock.calls.map((c: any[]) => c[0]).join('\n');
    expect(allSql).not.toContain('DROP COLUMN');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/lib/db/migrations.test.ts --no-coverage
```

Expected: FAIL — `purchase_history` not found in SQL, version migration not present.

- [ ] **Step 3: Update `lib/db/schema.ts`**

Remove `actual_price` and `store` from `shopping_items`. Add `purchase_history`. Leave all other tables unchanged.

```typescript
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

  CREATE TABLE IF NOT EXISTS purchase_history (
    id              TEXT PRIMARY KEY,
    plan_id         TEXT NOT NULL REFERENCES weekly_plans(id),
    item_name       TEXT NOT NULL,
    store           TEXT NOT NULL,
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

  CREATE TABLE IF NOT EXISTS price_history (
    id          TEXT PRIMARY KEY,
    barcode     TEXT REFERENCES barcode_nutrition(barcode),
    item_name   TEXT NOT NULL,
    store       TEXT NOT NULL,
    price       REAL NOT NULL,
    qty         TEXT NOT NULL,
    date        TEXT NOT NULL,
    plan_id     TEXT REFERENCES weekly_plans(id)
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

- [ ] **Step 4: Update `lib/db/migrations.ts`**

```typescript
import type { SQLiteDatabase } from 'expo-sqlite';
import { SCHEMA_SQL } from './schema';

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(SCHEMA_SQL);

  const rows = await db.getAllAsync<{ user_version: number }>('PRAGMA user_version');
  const version = rows[0]?.user_version ?? 0;

  if (version < 1) {
    // Drop columns that were removed from shopping_items.
    // try/catch handles fresh installs where columns were never created.
    try {
      await db.execAsync('ALTER TABLE shopping_items DROP COLUMN actual_price');
    } catch {}
    try {
      await db.execAsync('ALTER TABLE shopping_items DROP COLUMN store');
    } catch {}
    await db.execAsync('PRAGMA user_version = 1');
  }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx jest __tests__/lib/db/migrations.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.ts lib/db/migrations.ts __tests__/lib/db/migrations.test.ts
git commit -m "add purchase_history table and v1 migration to drop unused shopping_items columns"
```

---

## Task 3: TypeScript types

**Files:**
- Modify: `types/db.ts`

- [ ] **Step 1: Update `types/db.ts`**

Remove `actual_price` and `store` from `ShoppingItemRow`. Add `PurchaseHistoryRow`.

```typescript
export interface RecipeRow {
  id: string;
  title: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  servings: number;
  calories_per_serve: number;
  protein_per_serve_g: number;
  cook_method: string;
  prep_minutes: number;
  cook_minutes: number;
  ingredients_json: string;
  method_steps_json: string;
  is_favourite: 0 | 1;
  source: 'imported' | 'user';
  created_at: string;
}

export interface WeeklyPlanRow {
  id: string;
  week_starting: string;
  is_active: 0 | 1;
  meta_json: string;
  strategy_json: string;
  days_json: string;
  batch_plan_json: string;
  created_at: string;
}

export interface ShoppingItemRow {
  id: string;
  plan_id: string;
  category: string;
  category_order: number;
  item_order: number;
  name: string;
  qty: string;
  estimated_price: number;
  is_oneoff: 0 | 1;
  note: string | null;
  is_checked: 0 | 1;
}

export type QtyUnit = 'g' | 'kg' | 'mL' | 'L' | 'units';

export interface PurchaseHistoryRow {
  id: string;
  plan_id: string;
  item_name: string;
  store: string;
  brand: string | null;
  product_name: string | null;
  qty_amount: number | null;
  qty_unit: QtyUnit | null;
  price: number | null;
  is_sale: 0 | 1;
  barcode: string | null;
  purchased_at: string;
}

export interface StoreRow {
  id: string;
  chain: string;
  branch: string;
  created_at: string;
}
```

- [ ] **Step 2: Check TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors. If `actual_price` or `store` are referenced elsewhere, fix each callsite by removing the reference (they were unused).

- [ ] **Step 3: Commit**

```bash
git add types/db.ts
git commit -m "add PurchaseHistoryRow type, remove actual_price/store from ShoppingItemRow"
```

---

## Task 4: `usePurchaseHistory` hook

**Files:**
- Create: `hooks/usePurchaseHistory.ts`
- Create: `__tests__/hooks/usePurchaseHistory.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/hooks/usePurchaseHistory.test.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { usePurchaseHistory } from '../../hooks/usePurchaseHistory';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const mockRows: any[] = [];
const mockDb = {
  getAllAsync: jest.fn(async (sql: string) => {
    if (sql.includes('plan_id = ?')) return mockRows;
    if (sql.includes('LOWER(item_name)')) return mockRows;
    if (sql.includes('barcode =')) return mockRows;
    return [];
  }),
  runAsync: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../providers/DatabaseProvider', () => ({
  useDb: () => mockDb,
}));

describe('usePurchaseHistory', () => {
  beforeEach(() => {
    mockRows.length = 0;
    mockDb.getAllAsync.mockClear();
    mockDb.runAsync.mockClear();
  });

  it('loads records for the current plan', async () => {
    mockRows.push({ id: '1', plan_id: 'p1', item_name: 'Chicken', store: 'Coles',
      brand: null, product_name: null, qty_amount: 500, qty_unit: 'g',
      price: 12, is_sale: 0, barcode: null, purchased_at: '2026-05-12T10:00:00Z' });
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.records).toHaveLength(1);
  });

  it('addRecord inserts a row and reloads', async () => {
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.addRecord({
        plan_id: 'p1',
        item_name: 'Chicken',
        store: 'Coles',
        brand: 'Coles',
        product_name: 'RSPCA Chicken Breast',
        qty_amount: 500,
        qty_unit: 'g',
        price: 12,
        is_sale: 0,
        barcode: null,
        purchased_at: '2026-05-12T10:00:00Z',
      });
    });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO purchase_history'),
      expect.any(Array)
    );
  });

  it('getLatestForItem returns most recent non-sale record across all plans', async () => {
    const record = { id: '1', plan_id: 'p1', item_name: 'Chicken', store: 'Coles',
      brand: 'Coles', product_name: null, qty_amount: 500, qty_unit: 'g',
      price: 12, is_sale: 0, barcode: null, purchased_at: '2026-05-12T10:00:00Z' };
    mockDb.getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('LOWER(item_name)') && sql.includes('is_sale = 0')) return [record];
      return [];
    });
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const found = await result.current.getLatestForItem('chicken');
    expect(found?.brand).toBe('Coles');
  });

  it('getLatestForBarcode returns most recent record with matching barcode', async () => {
    const record = { id: '2', plan_id: 'p1', item_name: 'Chicken', store: 'Coles',
      brand: 'Coles', product_name: 'RSPCA', qty_amount: 500, qty_unit: 'g',
      price: 12, is_sale: 0, barcode: '9310172050024', purchased_at: '2026-05-12T10:00:00Z' };
    mockDb.getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('barcode =')) return [record];
      return [];
    });
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const found = await result.current.getLatestForBarcode('9310172050024');
    expect(found?.product_name).toBe('RSPCA');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/hooks/usePurchaseHistory.test.ts --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `hooks/usePurchaseHistory.ts`**

```typescript
import { useEffect, useState, useCallback } from 'react';
import { useDb } from '../providers/DatabaseProvider';
import { generateId } from '../lib/uuid';
import type { PurchaseHistoryRow, QtyUnit } from '../types/db';

export interface AddPurchaseData {
  plan_id: string;
  item_name: string;
  store: string;
  brand: string | null;
  product_name: string | null;
  qty_amount: number | null;
  qty_unit: QtyUnit | null;
  price: number | null;
  is_sale: 0 | 1;
  barcode: string | null;
  purchased_at: string;
}

export function usePurchaseHistory(planId: string | null) {
  const db = useDb();
  const [records, setRecords] = useState<PurchaseHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!planId) { setRecords([]); setLoading(false); return; }
    const rows = await db.getAllAsync<PurchaseHistoryRow>(
      'SELECT * FROM purchase_history WHERE plan_id = ? ORDER BY purchased_at DESC',
      [planId]
    );
    setRecords(rows);
    setLoading(false);
  }, [planId, db]);

  useEffect(() => { load(); }, [load]);

  const addRecord = useCallback(async (data: AddPurchaseData) => {
    const id = generateId();
    await db.runAsync(
      `INSERT INTO purchase_history
         (id, plan_id, item_name, store, brand, product_name,
          qty_amount, qty_unit, price, is_sale, barcode, purchased_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.plan_id, data.item_name, data.store, data.brand,
       data.product_name, data.qty_amount, data.qty_unit, data.price,
       data.is_sale, data.barcode, data.purchased_at]
    );
    await load();
  }, [db, load]);

  const getLatestForItem = useCallback(async (itemName: string): Promise<PurchaseHistoryRow | null> => {
    const rows = await db.getAllAsync<PurchaseHistoryRow>(
      `SELECT * FROM purchase_history
       WHERE LOWER(item_name) = LOWER(?) AND is_sale = 0
       ORDER BY purchased_at DESC LIMIT 1`,
      [itemName]
    );
    if (rows.length > 0) return rows[0];
    // Fall back to most recent sale record if no non-sale exists
    const saleRows = await db.getAllAsync<PurchaseHistoryRow>(
      `SELECT * FROM purchase_history
       WHERE LOWER(item_name) = LOWER(?)
       ORDER BY purchased_at DESC LIMIT 1`,
      [itemName]
    );
    return saleRows[0] ?? null;
  }, [db]);

  const getLatestForBarcode = useCallback(async (barcode: string): Promise<PurchaseHistoryRow | null> => {
    const rows = await db.getAllAsync<PurchaseHistoryRow>(
      `SELECT * FROM purchase_history
       WHERE barcode = ?
       ORDER BY purchased_at DESC LIMIT 1`,
      [barcode]
    );
    return rows[0] ?? null;
  }, [db]);

  return { records, loading, addRecord, getLatestForItem, getLatestForBarcode };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest __tests__/hooks/usePurchaseHistory.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add hooks/usePurchaseHistory.ts __tests__/hooks/usePurchaseHistory.test.ts
git commit -m "add usePurchaseHistory hook"
```

---

## Task 5: `useShoppingMode` hook

**Files:**
- Create: `hooks/useShoppingMode.ts`
- Create: `__tests__/hooks/useShoppingMode.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/hooks/useShoppingMode.test.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useShoppingMode } from '../../hooks/useShoppingMode';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('useShoppingMode', () => {
  beforeEach(() => AsyncStorage.clear());

  it('defaults to quick mode with no store', async () => {
    const { result } = renderHook(() => useShoppingMode('plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.mode).toBe('quick');
    expect(result.current.activeStore).toBeNull();
  });

  it('setMode to quick clears the active store', async () => {
    const { result } = renderHook(() => useShoppingMode('plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.setMode('review', 'Coles Bondi'); });
    await act(async () => { await result.current.setMode('quick'); });
    expect(result.current.mode).toBe('quick');
    expect(result.current.activeStore).toBeNull();
  });

  it('setMode to review sets mode and active store', async () => {
    const { result } = renderHook(() => useShoppingMode('plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.setMode('review', 'Coles Bondi'); });
    expect(result.current.mode).toBe('review');
    expect(result.current.activeStore).toBe('Coles Bondi');
  });

  it('persists mode across hook remounts', async () => {
    const { result, unmount } = renderHook(() => useShoppingMode('plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.setMode('review', 'Woolworths'); });
    unmount();
    const { result: result2 } = renderHook(() => useShoppingMode('plan-1'));
    await waitFor(() => expect(result2.current.loading).toBe(false));
    expect(result2.current.mode).toBe('review');
    expect(result2.current.activeStore).toBe('Woolworths');
  });

  it('addStore saves a new store and updates savedStores', async () => {
    const { result } = renderHook(() => useShoppingMode('plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.addStore('Aldi Newtown'); });
    expect(result.current.savedStores.map(s => s.name)).toContain('Aldi Newtown');
  });

  it('savedStores are sorted by lastUsed descending', async () => {
    const { result } = renderHook(() => useShoppingMode('plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.setMode('review', 'Old Store'); });
    await act(async () => { await result.current.setMode('review', 'New Store'); });
    expect(result.current.savedStores[0].name).toBe('New Store');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/hooks/useShoppingMode.test.ts --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `hooks/useShoppingMode.ts`**

```typescript
import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ShoppingMode = 'quick' | 'review';

export interface SavedStore {
  name: string;
  lastUsed: string; // ISO datetime
}

interface PersistedModeState {
  mode: ShoppingMode;
  store: string | null;
}

const STORES_KEY = 'shopping_stores';

function modeKey(planId: string) {
  return `shopping_mode_${planId}`;
}

export function useShoppingMode(planId: string | null) {
  const [mode, setModeState] = useState<ShoppingMode>('quick');
  const [activeStore, setActiveStore] = useState<string | null>(null);
  const [savedStores, setSavedStores] = useState<SavedStore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [modeRaw, storesRaw] = await Promise.all([
        planId ? AsyncStorage.getItem(modeKey(planId)) : null,
        AsyncStorage.getItem(STORES_KEY),
      ]);
      if (modeRaw) {
        const parsed: PersistedModeState = JSON.parse(modeRaw);
        setModeState(parsed.mode);
        setActiveStore(parsed.store);
      }
      if (storesRaw) {
        const stores: SavedStore[] = JSON.parse(storesRaw);
        setSavedStores(stores.sort((a, b) => b.lastUsed.localeCompare(a.lastUsed)));
      }
      setLoading(false);
    }
    load();
  }, [planId]);

  const addStore = useCallback(async (name: string) => {
    const now = new Date().toISOString();
    const existing: SavedStore[] = JSON.parse(await AsyncStorage.getItem(STORES_KEY) ?? '[]');
    const updated = [
      { name, lastUsed: now },
      ...existing.filter(s => s.name !== name),
    ].sort((a, b) => b.lastUsed.localeCompare(a.lastUsed));
    await AsyncStorage.setItem(STORES_KEY, JSON.stringify(updated));
    setSavedStores(updated);
  }, []);

  const setMode = useCallback(async (newMode: ShoppingMode, store?: string) => {
    const newStore = newMode === 'review' ? (store ?? null) : null;
    setModeState(newMode);
    setActiveStore(newStore);
    if (planId) {
      const state: PersistedModeState = { mode: newMode, store: newStore };
      await AsyncStorage.setItem(modeKey(planId), JSON.stringify(state));
    }
    if (newMode === 'review' && store) {
      await addStore(store);
    }
  }, [planId, addStore]);

  return { mode, activeStore, savedStores, loading, setMode, addStore };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest __tests__/hooks/useShoppingMode.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add hooks/useShoppingMode.ts __tests__/hooks/useShoppingMode.test.ts
git commit -m "add useShoppingMode hook"
```

---

## Task 6: `StorePickerSheet` component

**Files:**
- Create: `components/StorePickerSheet.tsx`

No unit tests for this component — it is purely presentational and wired to tested hooks.

- [ ] **Step 1: Create `components/StorePickerSheet.tsx`**

```typescript
import React, { useState } from 'react';
import {
  View, Modal, TouchableOpacity, TextInput,
  ScrollView, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './ui/AppText';
import { colors, spacing, radius } from '../constants/tokens';
import type { SavedStore } from '../hooks/useShoppingMode';

interface Props {
  visible: boolean;
  stores: SavedStore[];
  onConfirm: (storeName: string) => void;
  onClose: () => void;
}

export function StorePickerSheet({ visible, stores, onConfirm, onClose }: Props) {
  const [selected, setSelected] = useState<string | null>(stores[0]?.name ?? null);
  const [newStore, setNewStore] = useState('');
  const [adding, setAdding] = useState(false);

  function handleConfirm() {
    const name = adding ? newStore.trim() : selected;
    if (!name) return;
    onConfirm(name);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <AppText weight="extrabold" size="lg" color="textPrimary" style={styles.heading}>
            Where are you shopping?
          </AppText>
          <AppText weight="regular" size="sm" color="textNote" style={styles.sub}>
            Saved with your purchases for this trip
          </AppText>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {stores.map((s) => (
              <TouchableOpacity
                key={s.name}
                style={[styles.storeRow, selected === s.name && !adding && styles.storeRowSelected]}
                onPress={() => { setSelected(s.name); setAdding(false); }}
                activeOpacity={0.7}
              >
                <View style={styles.storeRowContent}>
                  <AppText weight="bold" size="md" color="textPrimary">{s.name}</AppText>
                  <AppText weight="regular" size="sm" color="textTertiary">
                    Last used {formatLastUsed(s.lastUsed)}
                  </AppText>
                </View>
                {selected === s.name && !adding && (
                  <Ionicons name="checkmark" size={16} color={colors.green} />
                )}
              </TouchableOpacity>
            ))}

            {adding ? (
              <View style={styles.newStoreInput}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Coles Bondi"
                  placeholderTextColor={colors.textTertiary}
                  value={newStore}
                  onChangeText={setNewStore}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleConfirm}
                />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addRow}
                onPress={() => { setAdding(true); setSelected(null); }}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={16} color={colors.textTertiary} />
                <AppText weight="semibold" size="sm" color="textSecondary">
                  Add new store…
                </AppText>
              </TouchableOpacity>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.confirmBtn, !(selected || (adding && newStore.trim())) && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            activeOpacity={0.85}
          >
            <AppText weight="extrabold" size="md" color="onGreen">Start reviewing</AppText>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function formatLastUsed(iso: string): string {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing[4],
    paddingBottom: spacing[8],
    maxHeight: '80%',
  },
  handle: {
    width: 32, height: 4, borderRadius: radius.full,
    backgroundColor: colors.divider, alignSelf: 'center', marginBottom: spacing[3],
  },
  heading: { marginBottom: spacing[1] },
  sub: { marginBottom: spacing[4] },
  list: { marginBottom: spacing[3] },
  storeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing[3], borderRadius: radius.md,
    backgroundColor: colors.cream, borderWidth: 1.5,
    borderColor: colors.divider, marginBottom: spacing[2],
  },
  storeRowSelected: { borderColor: colors.green, backgroundColor: 'rgba(28,69,60,0.04)' },
  storeRowContent: { flex: 1, gap: spacing[1] },
  newStoreInput: {
    backgroundColor: colors.cream, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.green,
    paddingHorizontal: spacing[3], marginBottom: spacing[2],
  },
  input: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13, color: colors.textPrimary,
    paddingVertical: spacing[3],
  },
  addRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    padding: spacing[3], borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.divider,
    borderStyle: 'dashed', marginBottom: spacing[2],
  },
  confirmBtn: {
    backgroundColor: colors.orange, borderRadius: radius.full,
    paddingVertical: spacing[3], alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.45 },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/StorePickerSheet.tsx
git commit -m "add StorePickerSheet component"
```

---

## Task 7: Scanner result handoff singleton

**Files:**
- Create: `lib/barcodeScanResult.ts`

- [ ] **Step 1: Create `lib/barcodeScanResult.ts`**

```typescript
import type { PurchaseHistoryRow } from '../types/db';

export interface ScanResult {
  barcode: string;
  record: PurchaseHistoryRow | null;
}

let pending: ScanResult | null = null;

export function setPendingScanResult(result: ScanResult): void {
  pending = result;
}

export function takePendingScanResult(): ScanResult | null {
  const result = pending;
  pending = null;
  return result;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/barcodeScanResult.ts
git commit -m "add barcodeScanResult singleton for scanner→sheet handoff"
```

---

## Task 8: `ReviewItemSheet` component

**Files:**
- Create: `components/ReviewItemSheet.tsx`

- [ ] **Step 1: Create `components/ReviewItemSheet.tsx`**

```typescript
import React, { useState, useEffect } from 'react';
import {
  View, Modal, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './ui/AppText';
import { colors, spacing, radius } from '../constants/tokens';
import { formatPrice } from '../lib/format';
import type { ShoppingItemRow, PurchaseHistoryRow, QtyUnit } from '../types/db';
import type { AddPurchaseData } from '../hooks/usePurchaseHistory';
import type { ScanResult } from '../lib/barcodeScanResult';

const QTY_UNITS: QtyUnit[] = ['g', 'kg', 'mL', 'L', 'units'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

interface Props {
  visible: boolean;
  item: ShoppingItemRow | null;
  store: string;
  latestRecord: PurchaseHistoryRow | null;
  pendingScan: ScanResult | null;
  onSave: (data: AddPurchaseData) => void;
  onClose: () => void;
  onPendingScanConsumed: () => void;
}

export function ReviewItemSheet({
  visible, item, store, latestRecord, pendingScan,
  onSave, onClose, onPendingScanConsumed,
}: Props) {
  const [brand, setBrand] = useState('');
  const [productName, setProductName] = useState('');
  const [qtyAmount, setQtyAmount] = useState('');
  const [qtyUnit, setQtyUnit] = useState<QtyUnit>('g');
  const [price, setPrice] = useState('');
  const [isSale, setIsSale] = useState(false);
  const [barcode, setBarcode] = useState('');
  const baselinePrice = latestRecord && !latestRecord.is_sale ? latestRecord.price : null;

  // Pre-fill from history when sheet opens
  useEffect(() => {
    if (!visible) return;
    if (latestRecord) {
      setBrand(latestRecord.brand ?? '');
      setProductName(latestRecord.product_name ?? '');
      setQtyAmount(latestRecord.qty_amount != null ? String(latestRecord.qty_amount) : '');
      setQtyUnit(latestRecord.qty_unit ?? 'g');
      setPrice(latestRecord.price != null ? String(latestRecord.price) : '');
      setIsSale(false);
      setBarcode(latestRecord.barcode ?? '');
    } else {
      setBrand(''); setProductName(''); setQtyAmount('');
      setQtyUnit('g'); setPrice(''); setIsSale(false); setBarcode('');
    }
  }, [visible, latestRecord]);

  // Apply scan result when returning from scanner
  useEffect(() => {
    if (!pendingScan) return;
    setBarcode(pendingScan.barcode);
    if (pendingScan.record) {
      setBrand(pendingScan.record.brand ?? '');
      setProductName(pendingScan.record.product_name ?? '');
      setQtyAmount(pendingScan.record.qty_amount != null ? String(pendingScan.record.qty_amount) : '');
      setQtyUnit(pendingScan.record.qty_unit ?? 'g');
      setPrice(pendingScan.record.price != null ? String(pendingScan.record.price) : '');
    }
    onPendingScanConsumed();
  }, [pendingScan]);

  function handleSave() {
    if (!item) return;
    onSave({
      plan_id: item.plan_id,
      item_name: item.name,
      store,
      brand: brand.trim() || null,
      product_name: productName.trim() || null,
      qty_amount: qtyAmount ? parseFloat(qtyAmount) : null,
      qty_unit: qtyUnit,
      price: price ? parseFloat(price) : null,
      is_sale: isSale ? 1 : 0,
      barcode: barcode.trim() || null,
      purchased_at: new Date().toISOString(),
    });
  }

  function openScanner() {
    router.push('/barcode-scanner');
  }

  if (!item) return null;

  const hasPrefill = !!latestRecord;
  const showSaleNote = isSale && baselinePrice != null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <AppText weight="extrabold" size="xl" color="textPrimary" style={styles.heading}>
            {item.name}
          </AppText>

          {hasPrefill && latestRecord && (
            <View style={styles.prefillBadge}>
              <AppText weight="semibold" size="2xs" color="green">
                ↩ Last bought {formatDate(latestRecord.purchased_at)}
                {latestRecord.price != null ? ` · ${formatPrice(latestRecord.price)}` : ''}
              </AppText>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} style={styles.fields}>
            <Field label="Brand">
              <TextInput
                style={styles.input}
                value={brand}
                onChangeText={setBrand}
                placeholder="e.g. Coles, Macro, Lilydale"
                placeholderTextColor={colors.textTertiary}
              />
            </Field>

            <Field label="Product name">
              <TextInput
                style={styles.input}
                value={productName}
                onChangeText={setProductName}
                placeholder="e.g. RSPCA Chicken Breast"
                placeholderTextColor={colors.textTertiary}
              />
            </Field>

            <View style={styles.twoCol}>
              <View style={styles.colFlex}>
                <AppText weight="bold" size="2xs" color="textTertiary" style={styles.fieldLabel}>
                  QTY / SIZE
                </AppText>
                <View style={styles.qtyRow}>
                  <TextInput
                    style={[styles.input, styles.qtyInput]}
                    value={qtyAmount}
                    onChangeText={setQtyAmount}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                  />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.unitScroll}
                    contentContainerStyle={styles.unitScrollContent}
                  >
                    {QTY_UNITS.map((u) => (
                      <TouchableOpacity
                        key={u}
                        style={[styles.unitChip, qtyUnit === u && styles.unitChipSelected]}
                        onPress={() => setQtyUnit(u)}
                        activeOpacity={0.7}
                      >
                        <AppText
                          weight="bold"
                          size="2xs"
                          color={qtyUnit === u ? 'onGreen' : 'textTertiary'}
                        >
                          {u}
                        </AppText>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <View style={styles.colFlex}>
                <AppText weight="bold" size="2xs" color="textTertiary" style={styles.fieldLabel}>
                  PRICE PAID
                </AppText>
                <View style={styles.priceRow}>
                  <TextInput
                    style={[styles.input, styles.priceInput]}
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="decimal-pad"
                    placeholder="$0.00"
                    placeholderTextColor={colors.textTertiary}
                  />
                  <View style={styles.saleToggle}>
                    <Switch
                      value={isSale}
                      onValueChange={setIsSale}
                      trackColor={{ false: colors.checkboxBorder, true: colors.orange }}
                      thumbColor="white"
                      style={styles.switch}
                    />
                    <AppText
                      weight="bold"
                      size="2xs"
                      color={isSale ? 'orange' : 'textTertiary'}
                    >
                      Sale
                    </AppText>
                  </View>
                </View>
                {showSaleNote && (
                  <AppText weight="medium" size="2xs" color="textNote" style={styles.saleNote}>
                    Sale price — baseline stays {formatPrice(baselinePrice!)}
                  </AppText>
                )}
              </View>
            </View>

            <AppText weight="bold" size="2xs" color="textTertiary" style={styles.fieldLabel}>
              BARCODE
            </AppText>
            <View style={styles.barcodeRow}>
              <TextInput
                style={[styles.input, styles.barcodeInput]}
                value={barcode}
                onChangeText={setBarcode}
                placeholder="— or scan →"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
              />
              <TouchableOpacity style={styles.scanBtn} onPress={openScanner} activeOpacity={0.85}>
                <Ionicons name="camera-outline" size={15} color={colors.onGreen} />
                <AppText weight="bold" size="sm" color="onGreen"> Scan</AppText>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.doneBtn} onPress={handleSave} activeOpacity={0.85}>
            <AppText weight="extrabold" size="md" color="onGreen">Done</AppText>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={fieldStyles.wrap}>
      <AppText weight="bold" size="2xs" color="textTertiary" style={fieldStyles.label}>{label.toUpperCase()}</AppText>
      {children}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { marginBottom: spacing[3] },
  label: { marginBottom: spacing[1], letterSpacing: 0.8 },
});

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.card, borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg, padding: spacing[4],
    paddingBottom: spacing[8], maxHeight: '90%',
  },
  handle: {
    width: 32, height: 4, borderRadius: radius.full,
    backgroundColor: colors.divider, alignSelf: 'center', marginBottom: spacing[3],
  },
  heading: { marginBottom: spacing[2] },
  prefillBadge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(28,69,60,0.07)',
    borderRadius: radius.xs, paddingHorizontal: spacing[2],
    paddingVertical: spacing[1], marginBottom: spacing[3],
  },
  fields: { flex: 1 },
  fieldLabel: { marginBottom: spacing[1], letterSpacing: 0.8 },
  input: {
    backgroundColor: colors.cream, borderWidth: 1.5, borderColor: colors.divider,
    borderRadius: radius.sm + 2, paddingHorizontal: spacing[3],
    paddingVertical: spacing[2], fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13, color: colors.textPrimary,
  },
  twoCol: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },
  colFlex: { flex: 1 },
  qtyRow: { flexDirection: 'row', gap: spacing[1], alignItems: 'center' },
  qtyInput: { width: 64 },
  unitScroll: { flex: 1 },
  unitScrollContent: { gap: spacing[1], alignItems: 'center' },
  unitChip: {
    paddingHorizontal: spacing[2], paddingVertical: spacing[1],
    borderRadius: radius.full, backgroundColor: colors.cream,
    borderWidth: 1.5, borderColor: colors.divider,
  },
  unitChipSelected: { backgroundColor: colors.green, borderColor: colors.green },
  priceRow: { flexDirection: 'row', gap: spacing[1], alignItems: 'center' },
  priceInput: { flex: 1 },
  saleToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  switch: { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] },
  saleNote: { marginTop: spacing[1] },
  barcodeRow: { flexDirection: 'row', gap: spacing[2], alignItems: 'center', marginBottom: spacing[4] },
  barcodeInput: { flex: 1 },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.green,
    borderRadius: radius.sm + 2, paddingHorizontal: spacing[3],
    paddingVertical: spacing[2] + 1,
  },
  doneBtn: {
    backgroundColor: colors.orange, borderRadius: radius.full,
    paddingVertical: spacing[3], alignItems: 'center', marginTop: spacing[2],
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/ReviewItemSheet.tsx lib/barcodeScanResult.ts
git commit -m "add ReviewItemSheet component"
```

---

## Task 9: `BarcodeScannerScreen`

**Files:**
- Create: `app/barcode-scanner.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Add modal route to `app/_layout.tsx`**

In the `<Stack>` inside `_layout.tsx`, add after the existing `category-order` entry:

```typescript
<Stack.Screen name="barcode-scanner" options={{ presentation: 'fullScreenModal', headerShown: false }} />
```

- [ ] **Step 2: Create `app/barcode-scanner.tsx`**

```typescript
import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../components/ui/AppText';
import { colors, spacing, radius } from '../constants/tokens';
import { setPendingScanResult } from '../lib/barcodeScanResult';
import { usePurchaseHistory } from '../hooks/usePurchaseHistory';
import { usePlan } from '../hooks/usePlan';

export default function BarcodeScannerScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [matchedRecord, setMatchedRecord] = useState<any>(null);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const { plan } = usePlan();
  const { getLatestForBarcode } = usePurchaseHistory(plan?.row.id ?? null);

  // Reset state each time we enter the screen
  useFocusEffect(useCallback(() => {
    setScanned(false);
    setMatchedRecord(null);
    setScannedBarcode(null);
  }, []));

  async function handleBarcodeScanned({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);
    setScannedBarcode(data);
    const record = await getLatestForBarcode(data);
    setMatchedRecord(record);
  }

  function handleUse() {
    if (!scannedBarcode) return;
    setPendingScanResult({ barcode: scannedBarcode, record: matchedRecord });
    router.back();
  }

  function handleCancel() {
    router.back();
  }

  if (!permission) {
    return <View style={[styles.container, { paddingTop: insets.top }]} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
            <AppText weight="semibold" size="sm" color="onGreenSubtle">‹ Cancel</AppText>
          </TouchableOpacity>
          <AppText weight="extrabold" size="xl" color="onGreen">Scan Barcode</AppText>
          <View style={styles.cancelBtn} />
        </View>
        <View style={styles.permissionBody}>
          <AppText weight="semibold" size="md" color="textPrimary" style={styles.permissionText}>
            Camera access is needed to scan barcodes.
          </AppText>
          <TouchableOpacity style={styles.grantBtn} onPress={requestPermission} activeOpacity={0.85}>
            <AppText weight="extrabold" size="md" color="onGreen">Grant Access</AppText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Green header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn} accessibilityRole="button" accessibilityLabel="Cancel">
          <AppText weight="semibold" size="sm" color="onGreenSubtle">‹ Cancel</AppText>
        </TouchableOpacity>
        <AppText weight="extrabold" size="xl" color="onGreen">Scan Barcode</AppText>
        <View style={styles.cancelBtn} />
      </View>

      {/* Viewfinder */}
      <View style={styles.viewfinder}>
        <CameraView
          style={StyleSheet.absoluteFill}
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'] }}
        />
        <View style={styles.bracketContainer}>
          <View style={styles.bracket}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            <View style={styles.scanLine} />
          </View>
        </View>
      </View>

      {/* Hint */}
      <View style={styles.hint}>
        <AppText weight="medium" size="sm" color="textSecondary">
          Point at the barcode on the product
        </AppText>
      </View>

      {/* Result area */}
      <View style={styles.result}>
        {!scanned && (
          <AppText weight="regular" size="sm" color="textTertiary" style={{ textAlign: 'center' }}>
            Waiting for barcode…
          </AppText>
        )}

        {scanned && matchedRecord && (
          <>
            <AppText weight="bold" size="2xs" color="textTertiary" style={styles.resultLabel}>
              FOUND IN YOUR HISTORY
            </AppText>
            <View style={styles.matchCard}>
              <View style={styles.matchInfo}>
                <AppText weight="bold" size="md" color="textPrimary">
                  {matchedRecord.product_name || matchedRecord.item_name}
                </AppText>
                <AppText weight="regular" size="sm" color="textSecondary">
                  {matchedRecord.brand}{matchedRecord.brand ? ' · ' : ''}last bought {formatDate(matchedRecord.purchased_at)}
                </AppText>
              </View>
              <TouchableOpacity style={styles.useBtn} onPress={handleUse} activeOpacity={0.85}>
                <AppText weight="bold" size="sm" color="onGreen">Use</AppText>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setScanned(false)} style={styles.rescanLink}>
              <AppText weight="semibold" size="sm" color="textSecondary">Scan again</AppText>
            </TouchableOpacity>
          </>
        )}

        {scanned && !matchedRecord && (
          <>
            <AppText weight="bold" size="2xs" color="textTertiary" style={styles.resultLabel}>
              BARCODE SCANNED
            </AppText>
            <View style={styles.noMatchCard}>
              <AppText weight="bold" size="sm" color="textTertiary" style={{ textAlign: 'center' }}>
                Not in your history yet
              </AppText>
              <AppText weight="regular" size="sm" color="textNote" style={{ textAlign: 'center', marginTop: spacing[1] }}>
                Barcode saved — fill in the details manually
              </AppText>
            </View>
            <TouchableOpacity style={styles.useBtn} onPress={handleUse} activeOpacity={0.85}>
              <AppText weight="bold" size="sm" color="onGreen">Continue</AppText>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const CORNER_SIZE = 18;
const CORNER_WEIGHT = 2;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.green },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    backgroundColor: colors.green,
  },
  cancelBtn: { width: 70 },
  viewfinder: { height: 200, backgroundColor: '#111', position: 'relative' },
  bracketContainer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  bracket: { width: 180, height: 100, position: 'relative' },
  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE, borderColor: colors.onGreen },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_WEIGHT, borderLeftWidth: CORNER_WEIGHT, borderTopLeftRadius: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_WEIGHT, borderRightWidth: CORNER_WEIGHT, borderTopRightRadius: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_WEIGHT, borderLeftWidth: CORNER_WEIGHT, borderBottomLeftRadius: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_WEIGHT, borderRightWidth: CORNER_WEIGHT, borderBottomRightRadius: 3 },
  scanLine: { position: 'absolute', left: 8, right: 8, top: '50%', height: 1.5, backgroundColor: colors.orange, shadowColor: colors.orange, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 4 },
  hint: { backgroundColor: colors.card, borderBottomWidth: 1, borderColor: colors.divider, paddingVertical: spacing[2], alignItems: 'center' },
  result: { flex: 1, backgroundColor: colors.cream, padding: spacing[4] },
  resultLabel: { letterSpacing: 0.8, marginBottom: spacing[2] },
  matchCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: radius.md, padding: spacing[3], borderWidth: 1.5, borderColor: 'rgba(28,69,60,0.15)', marginBottom: spacing[2] },
  matchInfo: { flex: 1, gap: spacing[1] },
  noMatchCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing[4], borderWidth: 1.5, borderColor: colors.divider, borderStyle: 'dashed', marginBottom: spacing[3] },
  useBtn: { backgroundColor: colors.orange, borderRadius: radius.full, paddingVertical: spacing[2], paddingHorizontal: spacing[4], alignItems: 'center' },
  rescanLink: { alignItems: 'center', paddingVertical: spacing[2] },
  permissionBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing[6], backgroundColor: colors.cream },
  permissionText: { textAlign: 'center', marginBottom: spacing[4] },
  grantBtn: { backgroundColor: colors.orange, borderRadius: radius.full, paddingVertical: spacing[3], paddingHorizontal: spacing[6] },
});
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/barcode-scanner.tsx app/_layout.tsx
git commit -m "add BarcodeScannerScreen modal route"
```

---

## Task 10: Wire up `shop.tsx`

**Files:**
- Modify: `app/(tabs)/shop.tsx`

- [ ] **Step 1: Update `shop.tsx`**

Replace the full file with the wired-up version:

```typescript
import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedScrollHandler, useAnimatedStyle,
  interpolate, Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { GreenHeader } from '../../components/ui/GreenHeader';
import { AppText } from '../../components/ui/AppText';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { EmptyState } from '../../components/ui/EmptyState';
import { CategorySection } from '../../components/CategorySection';
import { BasketSection } from '../../components/BasketSection';
import { AddItemSheet } from '../../components/AddItemSheet';
import { ReviewItemSheet } from '../../components/ReviewItemSheet';
import { StorePickerSheet } from '../../components/StorePickerSheet';
import { usePlan } from '../../hooks/usePlan';
import { useShoppingItems } from '../../hooks/useShoppingItems';
import { usePurchaseHistory } from '../../hooks/usePurchaseHistory';
import { useShoppingMode } from '../../hooks/useShoppingMode';
import { takePendingScanResult } from '../../lib/barcodeScanResult';
import type { ShoppingItemRow, PurchaseHistoryRow } from '../../types/db';
import type { ScanResult } from '../../lib/barcodeScanResult';
import { useCategoryOrder } from '../../hooks/useCategoryOrder';
import { formatWeekOf, formatPrice, formatItemCount } from '../../lib/format';
import { colors, spacing, radius, shadow } from '../../constants/tokens';

const TITLE_COLLAPSE_START = 10;
const TITLE_COLLAPSE_END = 55;

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const { plan } = usePlan();
  const { items, toggleItem, addItem, updateItem, deleteItem } = useShoppingItems(plan?.row.id ?? null);
  const { applySavedOrder } = useCategoryOrder();
  const { addRecord, getLatestForItem } = usePurchaseHistory(plan?.row.id ?? null);
  const { mode, activeStore, savedStores, setMode } = useShoppingMode(plan?.row.id ?? null);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItemRow | null>(null);
  const [reviewItem, setReviewItem] = useState<ShoppingItemRow | null>(null);
  const [reviewLatest, setReviewLatest] = useState<PurchaseHistoryRow | null>(null);
  const [storePickerVisible, setStorePickerVisible] = useState(false);
  const [pendingScan, setPendingScan] = useState<ScanResult | null>(null);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const titleRowStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [TITLE_COLLAPSE_START, TITLE_COLLAPSE_END], [1, 0], Extrapolation.CLAMP);
    const maxHeight = interpolate(scrollY.value, [TITLE_COLLAPSE_START, TITLE_COLLAPSE_END], [62, 0], Extrapolation.CLAMP);
    return { opacity, maxHeight, overflow: 'hidden' };
  });

  // Pick up scanner result when returning from barcode-scanner route
  useFocusEffect(useCallback(() => {
    const result = takePendingScanResult();
    if (result) setPendingScan(result);
  }, []));

  const uncheckedItems = items.filter((i) => i.is_checked === 0);
  const checkedItems = items.filter((i) => i.is_checked === 1);
  const allCategories = [...new Set(items.map((i) => i.category))];
  const allCategoryNames = [...new Set(uncheckedItems.map((i) => i.category))];
  const isCategoryOneoff = (cat: string) =>
    uncheckedItems.some((i) => i.category === cat && i.is_oneoff === 1);
  const sortedNames = applySavedOrder(allCategoryNames);
  const regularCategories = sortedNames.filter((c) => !isCategoryOneoff(c));
  const oneoffCategories = sortedNames.filter((c) => isCategoryOneoff(c));
  const orderedCategories = [...regularCategories, ...oneoffCategories];

  const totalItems = items.length;
  const checkedCount = checkedItems.length;
  const totalBudget = items.reduce((sum, i) => sum + i.estimated_price, 0);
  const progress = totalItems > 0 ? checkedCount / totalItems : 0;
  const itemsLeft = totalItems - checkedCount;

  async function handleToggle(itemId: string) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    if (mode === 'review' && item.is_checked === 0) {
      const latest = await getLatestForItem(item.name);
      setReviewLatest(latest);
      setReviewItem(item);
    } else {
      toggleItem(itemId);
    }
  }

  async function handleReviewSave(data: Parameters<typeof addRecord>[0]) {
    if (!reviewItem) return;
    toggleItem(reviewItem.id);
    await addRecord(data);
    setReviewItem(null);
    setReviewLatest(null);
  }

  function handleModeToggle(newMode: 'quick' | 'review') {
    if (newMode === mode) return;
    if (newMode === 'review') {
      setStorePickerVisible(true);
    } else {
      setMode('quick');
    }
  }

  function handleStoreConfirm(storeName: string) {
    setStorePickerVisible(false);
    setMode('review', storeName);
  }

  if (!plan) {
    return (
      <View style={styles.outerEmpty}>
        <View style={[styles.emptyContainer, { marginTop: insets.top }]}>
          <EmptyState onImport={() => router.push('/settings')} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GreenHeader>
        <View style={styles.headerContent}>
          <Animated.View style={[styles.titleRow, titleRowStyle, { paddingBottom: spacing[2] }]}>
            <AppText weight="extrabold" color="onGreen" size="3xl">Shopping List</AppText>
            <View style={styles.titleRowRight}>
              {/* Mode toggle pill */}
              <View style={styles.modeSeg}>
                <TouchableOpacity
                  style={[styles.segOpt, mode === 'quick' && styles.segOptActive]}
                  onPress={() => handleModeToggle('quick')}
                  activeOpacity={0.8}
                >
                  <AppText weight="bold" size="2xs" color={mode === 'quick' ? 'green' : 'onGreenSubtle'}>
                    Quick
                  </AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segOpt, mode === 'review' && styles.segOptActive]}
                  onPress={() => handleModeToggle('review')}
                  activeOpacity={0.8}
                >
                  <AppText weight="bold" size="2xs" color={mode === 'review' ? 'green' : 'onGreenSubtle'}>
                    Review
                  </AppText>
                </TouchableOpacity>
              </View>
              {/* Reorder button */}
              <TouchableOpacity
                onPress={() => router.push('/category-order')}
                style={styles.reorderBtn}
                accessibilityLabel="Reorder categories"
                accessibilityRole="button"
              >
                <Ionicons name="swap-vertical-outline" size={22} color={colors.onGreen} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Week label + store pill */}
          <View style={styles.weekStoreRow}>
            <AppText weight="semibold" color="onGreenSubtle" size="xs">
              Week of {formatWeekOf(plan.row.week_starting)}
            </AppText>
            {mode === 'review' && activeStore && (
              <View style={styles.storePill}>
                <Ionicons name="location-outline" size={10} color={colors.onGreenSubtle} />
                <AppText weight="bold" size="2xs" color="onGreenSubtle">{activeStore}</AppText>
              </View>
            )}
          </View>

          <View style={styles.pillsRow}>
            <View style={styles.pill}>
              <AppText weight="bold" color="onGreen" size="2xs">
                Budget {formatPrice(totalBudget)}
              </AppText>
            </View>
            <View style={styles.pill}>
              <AppText weight="bold" color="onGreen" size="2xs">
                {formatItemCount(checkedCount, totalItems)}
              </AppText>
            </View>
          </View>

          <ProgressBar progress={progress} />

          <AppText weight="semibold" color="onGreenSubtle" size="2xs" style={styles.itemsLeft}>
            {itemsLeft} item{itemsLeft !== 1 ? 's' : ''} left
          </AppText>
        </View>
      </GreenHeader>

      <Animated.ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {orderedCategories.map((cat) => {
          const catItems = uncheckedItems.filter((i) => i.category === cat);
          return (
            <CategorySection
              key={cat}
              category={cat}
              items={catItems}
              isOneoff={isCategoryOneoff(cat)}
              onToggle={handleToggle}
              onDelete={deleteItem}
              onEdit={setEditingItem}
            />
          );
        })}
        {checkedItems.length > 0 && (
          <BasketSection
            items={checkedItems}
            onToggle={handleToggle}
            onDelete={deleteItem}
            onEdit={setEditingItem}
          />
        )}
      </Animated.ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setSheetVisible(true)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Add item to shopping list"
      >
        <Ionicons name="add" size={32} color={colors.onGreen} />
      </TouchableOpacity>

      <AddItemSheet
        visible={sheetVisible || editingItem !== null}
        categories={allCategories}
        onAdd={addItem}
        onSave={(id, data) => { updateItem(id, data); setEditingItem(null); }}
        onClose={() => { setSheetVisible(false); setEditingItem(null); }}
        initialItem={editingItem ?? undefined}
      />

      <ReviewItemSheet
        visible={reviewItem !== null}
        item={reviewItem}
        store={activeStore ?? ''}
        latestRecord={reviewLatest}
        pendingScan={pendingScan}
        onSave={handleReviewSave}
        onClose={() => { setReviewItem(null); setReviewLatest(null); }}
        onPendingScanConsumed={() => setPendingScan(null)}
      />

      <StorePickerSheet
        visible={storePickerVisible}
        stores={savedStores}
        onConfirm={handleStoreConfirm}
        onClose={() => setStorePickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  outerEmpty: { flex: 1, backgroundColor: colors.green },
  emptyContainer: { flex: 1, backgroundColor: colors.cream },
  headerContent: { paddingBottom: spacing[1], gap: spacing[1] },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  modeSeg: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: radius.full, padding: 2, gap: 2 },
  segOpt: { borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: spacing[1] },
  segOptActive: { backgroundColor: colors.onGreen },
  reorderBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  weekStoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  storePill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: radius.full,
    paddingHorizontal: spacing[2], paddingVertical: spacing[1],
  },
  pillsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2] },
  pill: { backgroundColor: colors.headerPill, paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: 9999 },
  itemsLeft: {},
  body: { flex: 1 },
  bodyContent: { paddingBottom: 100 },
  fab: {
    position: 'absolute', bottom: spacing[6], right: spacing[5],
    width: 60, height: 60, borderRadius: radius.full,
    backgroundColor: colors.orange, justifyContent: 'center', alignItems: 'center',
    ...shadow.pill,
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/(tabs)/shop.tsx
git commit -m "wire up shopping mode toggle, store picker, and review sheet in shop.tsx"
```

---

## Manual Smoke Test Checklist

After all tasks complete, test on device/simulator:

- [ ] Quick mode: check off items with no sheet appearing
- [ ] Tap "Review" → store picker sheet appears
- [ ] Add new store → appears in list, mode activates with store pill in header
- [ ] Header collapses on scroll hiding mode toggle and store pill
- [ ] Review mode: check off item → review sheet opens pre-filled from history (second+ trip)
- [ ] Sale toggle: track turns orange, price field stays neutral, note appears
- [ ] Scan button opens full-screen camera modal
- [ ] Camera: scan a previously logged barcode → "Found in your history" card appears
- [ ] Camera: scan an unknown barcode → "Not in your history yet" + Continue
- [ ] Tap Use / Continue → fields fill in review sheet
- [ ] Tap Done on review sheet → item checks off
- [ ] Switch back to Quick mid-trip → items check off without sheet
- [ ] Reopen app → mode and store persist for same plan
