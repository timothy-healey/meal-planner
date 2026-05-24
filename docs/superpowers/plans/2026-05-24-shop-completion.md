# Shop Completion — Pending Purchases & Receipt Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace immediate-write purchase logging with a pending → confirmed lifecycle. Add a "Done shopping" header CTA in Review mode that opens a receipt-paper modal where the user reviews, edits, and confirms the trip in one transaction.

**Architecture:** Adds a `status` column to `purchase_history` ('pending' | 'confirmed') so a pending row can be safely deleted on uncheck or amended in place via the receipt screen. The shop screen header gains a single orange CTA bound to pending rows for the active plan; tapping it pushes a modal `shop-receipt` route. All existing history queries filter `status = 'confirmed'` so pending data never leaks into reports, the price chart, or "latest price" suggestions. The store picker is updated to capture chain + branch separately so the receipt can display the branch under the chain.

**Tech Stack:** React Native (Expo SDK 56), expo-router, expo-sqlite, expo-haptics, react-native-reanimated, react-native-gesture-handler (Pan), Plus Jakarta Sans, AsyncStorage.

**Spec / mockups:** [docs/superpowers/specs/2026-05-24-shop-completion-design.md](../specs/2026-05-24-shop-completion-design.md) · [docs/superpowers/specs/2026-05-24-shop-completion-mockups.html](../specs/2026-05-24-shop-completion-mockups.html)

---

## File Structure

**New files**

| File | Responsibility |
|---|---|
| `app/shop-receipt.tsx` | Receipt modal screen — renders pending rows, total, Confirm button. Owns the swipe-to-remove + tap-to-edit interactions and the confirm transaction. |
| `components/ReceiptRow.tsx` | Single swipe-to-reveal row (Pan + Reanimated). Exposes `onTap` and `onRemove` callbacks. Modelled on `components/SwipeableShoppingItem.tsx` but single-action (Remove only). |
| `__tests__/app/shop-receipt.test.tsx` | Receipt screen tests (rendering, totals, confirm flow, empty state). |

**Modified files**

| File | Reason |
|---|---|
| `constants/tokens.ts` | Add `colors.paper`, `colors.paperDivider`. |
| `types/db.ts` | Add `status` field to `PurchaseHistoryRow`. |
| `lib/db/schema.ts` | Add `status TEXT NOT NULL DEFAULT 'confirmed'` to `purchase_history`. |
| `lib/db/migrations.ts` | Add v3 → v4 migration that adds the column. |
| `__tests__/lib/db/migrations.test.ts` | Cover v4. |
| `hooks/usePurchaseHistory.ts` | Filter reads by `status='confirmed'`; `addRecord` accepts a status; add `deletePending`, `updatePending`, `confirmShop`, `pendingRecords`. Accept `branch` in `AddPurchaseData`. |
| `__tests__/hooks/usePurchaseHistory.test.ts` | New tests for the lifecycle helpers + status filtering. |
| `hooks/usePriceHistory.ts` | Filter rows by `status='confirmed'`. |
| `lib/exportContext.ts` | Filter rows by `status='confirmed'`. |
| `hooks/useShoppingMode.ts` | `SavedStore` and `activeStore` become `{ chain, branch }`. Lazy migrate AsyncStorage entries on read. |
| `__tests__/hooks/useShoppingMode.test.ts` | Update for the new shape; add migration case. |
| `components/StorePickerSheet.tsx` | "Add new store" mode uses two inputs (chain, branch). Saved rows render chain over branch. |
| `components/ReviewItemSheet.tsx` | Accept an optional `pendingRow` prop. When set, preload values from it instead of `latestRecord`; on save, pass `branch` through. |
| `app/(tabs)/shop.tsx` | New header layout (drop budget pill / progress / "items left"); orange "Done shopping" CTA; route uncheck-in-review-mode to also delete the pending row; navigate to receipt on CTA tap; pass `chain` and `branch` to the review sheet. |
| `app/_layout.tsx` | Register the new `shop-receipt` modal route. |

---

## Task 1 — Add `paper` colour tokens

**Files:**
- Modify: `constants/tokens.ts`

- [ ] **Step 1: Edit `constants/tokens.ts`** — inside the `colors` object, add the two new entries near the `Surfaces` group:

```ts
  // Surfaces
  cream: '#F4F5EB', // screen background, card surfaces
  card:  '#FAFAF4', // recipe cards, stat pills — warm white tinted toward brand
  paper:        '#fbfbf2', // receipt screen background (warmer than cream)
  paperDivider: '#b8b8a0', // dashed dividers on receipt screen
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add constants/tokens.ts
git commit -m "feat(tokens): add paper and paperDivider colours for receipt screen"
```

---

## Task 2 — Add `status` to schema + type

**Files:**
- Modify: `types/db.ts`
- Modify: `lib/db/schema.ts`

- [ ] **Step 1: Update `types/db.ts`** — extend `PurchaseHistoryRow`:

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
  status: 'pending' | 'confirmed';
}
```

- [ ] **Step 2: Update `lib/db/schema.ts`** — modify the `purchase_history` `CREATE TABLE` block (lines 44-57) to include the column. Replace the existing definition with:

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
  purchased_at    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'confirmed'
);
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: compiler will now flag the test fixtures that build `PurchaseHistoryRow` objects without `status`. Note the failures but **do not fix them yet** — they'll be fixed when the corresponding tests are updated in later tasks. If the failure list is unexpectedly large, stop and re-read this plan; otherwise continue.

- [ ] **Step 4: Commit**

```bash
git add types/db.ts lib/db/schema.ts
git commit -m "feat(db): add status column to purchase_history schema and type"
```

---

## Task 3 — Migration v4: add `status` column

**Files:**
- Modify: `lib/db/migrations.ts`
- Test: `__tests__/lib/db/migrations.test.ts`

- [ ] **Step 1: Write the failing tests** — append two cases to `__tests__/lib/db/migrations.test.ts` (inside the existing `describe` block):

```ts
  it('runs version-4 migration on a v3 database (adds status column)', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ user_version: 3 }]);
    await runMigrations(mockDb as any);
    const allSql = mockDb.execAsync.mock.calls.map((c: any[]) => c[0]).join('\n');
    expect(allSql).toContain("ALTER TABLE purchase_history ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed'");
    expect(allSql).toContain('user_version = 4');
  });

  it('skips version-4 migration when already at version 4', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ user_version: 4 }]);
    await runMigrations(mockDb as any);
    const allSql = mockDb.execAsync.mock.calls.map((c: any[]) => c[0]).join('\n');
    expect(allSql).not.toContain('ADD COLUMN status');
  });
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx jest __tests__/lib/db/migrations.test.ts`
Expected: the two new cases fail; existing cases still pass.

- [ ] **Step 3: Implement the migration** — at the bottom of `runMigrations` in `lib/db/migrations.ts`, before the closing brace, append:

```ts
  if (version < 4) {
    // Fresh installs already get the column via SCHEMA_SQL — the ALTER is wrapped
    // in try/catch so re-running on a fresh DB is a no-op.
    try {
      await db.execAsync(
        "ALTER TABLE purchase_history ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed'"
      );
    } catch {}
    await db.execAsync('PRAGMA user_version = 4');
  }
```

- [ ] **Step 4: Run all migration tests**

Run: `npx jest __tests__/lib/db/migrations.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/db/migrations.ts __tests__/lib/db/migrations.test.ts
git commit -m "feat(db): migration v4 — add status column to purchase_history"
```

---

## Task 4 — `usePurchaseHistory`: filter reads by `status='confirmed'`, `addRecord` accepts status

**Files:**
- Modify: `hooks/usePurchaseHistory.ts`
- Test: `__tests__/hooks/usePurchaseHistory.test.ts`

- [ ] **Step 1: Update the test fixtures and add new failing cases** — open `__tests__/hooks/usePurchaseHistory.test.ts`.

First, update the existing fixture rows in the file to include `status: 'confirmed'` so they continue to load. Wherever a row literal like `{ id: '1', plan_id: 'p1', item_name: 'Chicken', ... }` is built, append `, status: 'confirmed'`.

Then append the following new tests:

```ts
  it('load excludes pending rows', async () => {
    mockRows.push({
      id: '1', plan_id: 'p1', item_name: 'Chicken', store_id: 's1',
      brand: null, product_name: null, qty_amount: null, qty_unit: null,
      price: 10, is_sale: 0, barcode: null,
      purchased_at: '2026-05-12T10:00:00Z', status: 'confirmed',
    });
    // The mock above is the simulated query result. We assert that the load
    // query carries the status filter so the DB never returns pending rows.
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const loadCall = mockDb.getAllAsync.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('plan_id = ?')
    );
    expect(loadCall?.[0]).toMatch(/status = 'confirmed'/);
  });

  it('getLatestForItem filters to confirmed only', async () => {
    mockDb.getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('LOWER(item_name)')) {
        expect(sql).toMatch(/status = 'confirmed'/);
        return [];
      }
      return [];
    });
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await result.current.getLatestForItem('chicken');
  });

  it('getLatestForBarcode filters to confirmed only', async () => {
    mockDb.getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('barcode =')) {
        expect(sql).toMatch(/status = 'confirmed'/);
        return [];
      }
      return [];
    });
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await result.current.getLatestForBarcode('9310172050024');
  });

  it("addRecord defaults to status='confirmed'", async () => {
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.addRecord({
        plan_id: 'p1', item_name: 'Chicken', store: 'Coles', brand: null,
        product_name: null, qty_amount: null, qty_unit: null,
        price: 10, is_sale: 0, barcode: null,
        purchased_at: '2026-05-12T10:00:00Z',
      });
    });
    const insert = mockDb.runAsync.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('INSERT INTO purchase_history')
    );
    expect(insert?.[1]).toContain('confirmed');
  });

  it("addRecord writes status='pending' when requested", async () => {
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.addRecord(
        {
          plan_id: 'p1', item_name: 'Chicken', store: 'Coles', brand: null,
          product_name: null, qty_amount: null, qty_unit: null,
          price: 10, is_sale: 0, barcode: null,
          purchased_at: '2026-05-12T10:00:00Z',
        },
        'pending',
      );
    });
    const insert = mockDb.runAsync.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('INSERT INTO purchase_history')
    );
    expect(insert?.[1]).toContain('pending');
  });
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx jest __tests__/hooks/usePurchaseHistory.test.ts`
Expected: the new tests fail (no status in SQL / no status parameter on `addRecord`); pre-existing tests still pass thanks to the fixture updates.

- [ ] **Step 3: Update `hooks/usePurchaseHistory.ts`** — apply these changes (only the diffs that change behaviour are shown — keep everything else as-is):

Replace the `load` body so the SQL includes the filter:

```ts
  const load = useCallback(async () => {
    if (!planId) { setRecords([]); setLoading(false); return; }
    const rows = await db.getAllAsync<PurchaseHistoryRow>(
      "SELECT * FROM purchase_history WHERE plan_id = ? AND status = 'confirmed' ORDER BY purchased_at DESC",
      [planId]
    );
    setRecords(rows);
    setLoading(false);
  }, [planId, db]);
```

Replace `addRecord` with:

```ts
  const addRecord = useCallback(async (
    data: AddPurchaseData,
    status: 'pending' | 'confirmed' = 'confirmed',
  ) => {
    const id = generateId();
    const storeId = await resolveOrCreateStore(db, data.store);
    await db.runAsync(
      `INSERT INTO purchase_history
         (id, plan_id, item_name, store_id, brand, product_name,
          qty_amount, qty_unit, price, is_sale, barcode, purchased_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.plan_id, data.item_name, storeId, data.brand,
       data.product_name, data.qty_amount, data.qty_unit, data.price,
       data.is_sale, data.barcode, data.purchased_at, status]
    );
    await load();
  }, [db, load]);
```

Update `getLatestForItem` SQL strings:

```ts
  const getLatestForItem = useCallback(async (itemName: string): Promise<PurchaseHistoryRow | null> => {
    const rows = await db.getAllAsync<PurchaseHistoryRow>(
      `SELECT * FROM purchase_history
       WHERE LOWER(item_name) = LOWER(?) AND is_sale = 0 AND status = 'confirmed'
       ORDER BY purchased_at DESC LIMIT 1`,
      [itemName]
    );
    if (rows.length > 0) return rows[0];
    const saleRows = await db.getAllAsync<PurchaseHistoryRow>(
      `SELECT * FROM purchase_history
       WHERE LOWER(item_name) = LOWER(?) AND status = 'confirmed'
       ORDER BY purchased_at DESC LIMIT 1`,
      [itemName]
    );
    return saleRows[0] ?? null;
  }, [db]);
```

Update `getLatestForBarcode` SQL:

```ts
  const getLatestForBarcode = useCallback(async (barcode: string): Promise<PurchaseHistoryRow | null> => {
    const rows = await db.getAllAsync<PurchaseHistoryRow>(
      `SELECT * FROM purchase_history
       WHERE barcode = ? AND status = 'confirmed'
       ORDER BY purchased_at DESC LIMIT 1`,
      [barcode]
    );
    return rows[0] ?? null;
  }, [db]);
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx jest __tests__/hooks/usePurchaseHistory.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add hooks/usePurchaseHistory.ts __tests__/hooks/usePurchaseHistory.test.ts
git commit -m "feat(purchase-history): filter reads to confirmed, status param on addRecord"
```

---

## Task 5 — `usePurchaseHistory.deletePending`

**Files:**
- Modify: `hooks/usePurchaseHistory.ts`
- Test: `__tests__/hooks/usePurchaseHistory.test.ts`

- [ ] **Step 1: Write failing tests** — append to `__tests__/hooks/usePurchaseHistory.test.ts`:

```ts
  it('deletePending issues a delete scoped to plan + item name + pending', async () => {
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.deletePending('p1', 'Chicken');
    });
    const del = mockDb.runAsync.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('DELETE FROM purchase_history')
    );
    expect(del?.[0]).toMatch(/plan_id = \?/);
    expect(del?.[0]).toMatch(/LOWER\(item_name\) = LOWER\(\?\)/);
    expect(del?.[0]).toMatch(/status = 'pending'/);
    expect(del?.[1]).toEqual(['p1', 'Chicken']);
  });
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx jest __tests__/hooks/usePurchaseHistory.test.ts -t deletePending`
Expected: fails — `deletePending is not a function`.

- [ ] **Step 3: Implement** — in `hooks/usePurchaseHistory.ts`, add this `useCallback` before the `return` statement:

```ts
  const deletePending = useCallback(async (planIdArg: string, itemName: string) => {
    await db.runAsync(
      `DELETE FROM purchase_history
       WHERE plan_id = ? AND LOWER(item_name) = LOWER(?) AND status = 'pending'`,
      [planIdArg, itemName],
    );
    await load();
  }, [db, load]);
```

Update the `return` to expose it:

```ts
  return { records, loading, addRecord, deletePending, getLatestForItem, getLatestForBarcode };
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx jest __tests__/hooks/usePurchaseHistory.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add hooks/usePurchaseHistory.ts __tests__/hooks/usePurchaseHistory.test.ts
git commit -m "feat(purchase-history): deletePending(planId, itemName)"
```

---

## Task 6 — `usePurchaseHistory.updatePending`

**Files:**
- Modify: `hooks/usePurchaseHistory.ts`
- Test: `__tests__/hooks/usePurchaseHistory.test.ts`

- [ ] **Step 1: Write failing test** — append to `__tests__/hooks/usePurchaseHistory.test.ts`:

```ts
  it('updatePending updates an existing pending row in place', async () => {
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.updatePending('row-1', {
        plan_id: 'p1', item_name: 'Chicken', store: 'Coles', brand: 'Macro',
        product_name: 'Free Range', qty_amount: 500, qty_unit: 'g',
        price: 13.5, is_sale: 0, barcode: null,
        purchased_at: '2026-05-12T10:00:00Z',
      });
    });
    const upd = mockDb.runAsync.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('UPDATE purchase_history')
    );
    expect(upd?.[0]).toMatch(/WHERE id = \? AND status = 'pending'/);
    expect(upd?.[1]?.[upd[1].length - 1]).toBe('row-1');
  });
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx jest __tests__/hooks/usePurchaseHistory.test.ts -t updatePending`
Expected: fails — `updatePending is not a function`.

- [ ] **Step 3: Implement** — in `hooks/usePurchaseHistory.ts`, add before the `return`:

```ts
  const updatePending = useCallback(async (id: string, data: AddPurchaseData) => {
    const storeId = await resolveOrCreateStore(db, data.store);
    await db.runAsync(
      `UPDATE purchase_history
       SET item_name = ?, store_id = ?, brand = ?, product_name = ?,
           qty_amount = ?, qty_unit = ?, price = ?, is_sale = ?,
           barcode = ?, purchased_at = ?
       WHERE id = ? AND status = 'pending'`,
      [
        data.item_name, storeId, data.brand, data.product_name,
        data.qty_amount, data.qty_unit, data.price, data.is_sale,
        data.barcode, data.purchased_at, id,
      ],
    );
    await load();
  }, [db, load]);
```

Add `updatePending` to the return value:

```ts
  return { records, loading, addRecord, deletePending, updatePending, getLatestForItem, getLatestForBarcode };
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx jest __tests__/hooks/usePurchaseHistory.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add hooks/usePurchaseHistory.ts __tests__/hooks/usePurchaseHistory.test.ts
git commit -m "feat(purchase-history): updatePending(id, data)"
```

---

## Task 7 — `usePurchaseHistory.confirmShop` + `pendingRecords`

**Files:**
- Modify: `hooks/usePurchaseHistory.ts`
- Test: `__tests__/hooks/usePurchaseHistory.test.ts`

- [ ] **Step 1: Write failing tests** — append:

```ts
  it('confirmShop runs the bulk update and deletes checked items in a transaction', async () => {
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.confirmShop('p1'); });

    const calls = mockDb.runAsync.mock.calls.map((c: any[]) => c[0] as string);
    expect(calls).toEqual(expect.arrayContaining([
      expect.stringContaining('BEGIN'),
      expect.stringMatching(/UPDATE purchase_history SET status = 'confirmed' WHERE plan_id = \? AND status = 'pending'/),
      expect.stringMatching(/DELETE FROM shopping_items WHERE plan_id = \? AND is_checked = 1/),
      expect.stringContaining('COMMIT'),
    ]));
  });

  it('pendingRecords reflects pending rows for the active plan', async () => {
    mockRows.push({
      id: '1', plan_id: 'p1', item_name: 'Chicken', store_id: 's1',
      brand: null, product_name: null, qty_amount: null, qty_unit: null,
      price: 10, is_sale: 0, barcode: null,
      purchased_at: '2026-05-12T10:00:00Z', status: 'pending',
    });
    mockDb.getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes("status = 'pending'") && sql.includes('plan_id = ?')) {
        return mockRows;
      }
      return [];
    });
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pendingRecords).toHaveLength(1);
    expect(result.current.pendingRecords[0].status).toBe('pending');
  });
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx jest __tests__/hooks/usePurchaseHistory.test.ts -t confirmShop`
Run: `npx jest __tests__/hooks/usePurchaseHistory.test.ts -t pendingRecords`
Expected: both fail (functions/state don't exist).

- [ ] **Step 3: Implement** — in `hooks/usePurchaseHistory.ts`:

a) Add a second state for pending rows and a loader. Near the top of the hook, after `const [records, ...]`:

```ts
  const [pendingRecords, setPendingRecords] = useState<PurchaseHistoryRow[]>([]);
```

b) Extend `load` to also load pending rows for the plan. Replace the `load` body added in Task 4 with:

```ts
  const load = useCallback(async () => {
    if (!planId) {
      setRecords([]); setPendingRecords([]); setLoading(false); return;
    }
    const [confirmed, pending] = await Promise.all([
      db.getAllAsync<PurchaseHistoryRow>(
        "SELECT * FROM purchase_history WHERE plan_id = ? AND status = 'confirmed' ORDER BY purchased_at DESC",
        [planId],
      ),
      db.getAllAsync<PurchaseHistoryRow>(
        "SELECT * FROM purchase_history WHERE plan_id = ? AND status = 'pending' ORDER BY purchased_at ASC",
        [planId],
      ),
    ]);
    setRecords(confirmed);
    setPendingRecords(pending);
    setLoading(false);
  }, [planId, db]);
```

c) Add `confirmShop` before the `return`:

```ts
  const confirmShop = useCallback(async (planIdArg: string) => {
    await db.runAsync('BEGIN');
    try {
      await db.runAsync(
        "UPDATE purchase_history SET status = 'confirmed' WHERE plan_id = ? AND status = 'pending'",
        [planIdArg],
      );
      await db.runAsync(
        'DELETE FROM shopping_items WHERE plan_id = ? AND is_checked = 1',
        [planIdArg],
      );
      await db.runAsync('COMMIT');
    } catch (e) {
      await db.runAsync('ROLLBACK');
      throw e;
    }
    await load();
  }, [db, load]);
```

d) Extend the return:

```ts
  return {
    records, pendingRecords, loading,
    addRecord, deletePending, updatePending, confirmShop,
    getLatestForItem, getLatestForBarcode,
  };
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx jest __tests__/hooks/usePurchaseHistory.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add hooks/usePurchaseHistory.ts __tests__/hooks/usePurchaseHistory.test.ts
git commit -m "feat(purchase-history): pendingRecords + confirmShop transaction"
```

---

## Task 8 — `usePriceHistory` + `exportContext`: filter `status='confirmed'`

**Files:**
- Modify: `hooks/usePriceHistory.ts`
- Modify: `lib/exportContext.ts`
- Test: `__tests__/hooks/usePriceHistory.test.ts`
- Test: `__tests__/lib/exportContext.test.ts`

- [ ] **Step 1: Look at the existing usePriceHistory test** — open `__tests__/hooks/usePriceHistory.test.ts` and find the assertion (or assertions) that check the SQL. Add a single new test that asserts the SQL filters by status:

```ts
  it('queries only confirmed purchase rows', async () => {
    const { result } = renderHook(() => usePriceHistory('Coles', 'Free Range'));
    await waitFor(() => expect(result.current.points).toEqual([]));
    const sqlCalls = mockDb.getAllAsync.mock.calls.map((c: any[]) => c[0] as string);
    expect(sqlCalls.some(s => /status = 'confirmed'/.test(s))).toBe(true);
  });
```

(Mirror this against the existing test mock structure — keep the variable names consistent with the rest of that file.)

- [ ] **Step 2: Run test to verify failure**

Run: `npx jest __tests__/hooks/usePriceHistory.test.ts -t "only confirmed"`
Expected: fails.

- [ ] **Step 3: Update `hooks/usePriceHistory.ts`** — replace the SQL in `load` (lines 20-30 in the current file):

```ts
    const rows = await db.getAllAsync<PurchaseWithChain>(
      `SELECT ph.*, s.chain
       FROM purchase_history ph
       JOIN stores s ON ph.store_id = s.id
       WHERE ph.brand = ? AND ph.product_name = ?
         AND ph.price IS NOT NULL
         AND ph.qty_amount IS NOT NULL
         AND ph.qty_unit IS NOT NULL
         AND ph.status = 'confirmed'
       ORDER BY ph.purchased_at ASC`,
      [brand, productName],
    );
```

- [ ] **Step 4: Update `lib/exportContext.ts`** — modify the purchase query (lines 40-46). Replace the `WHERE` clause:

```ts
    `SELECT ph.item_name, ph.brand, ph.product_name, s.chain AS store,
            ph.qty_amount, ph.qty_unit, ph.price, ph.is_sale, ph.barcode
     FROM purchase_history ph
     LEFT JOIN stores s ON ph.store_id = s.id
     WHERE ph.plan_id = ? AND ph.status = 'confirmed' ORDER BY ph.purchased_at ASC`,
```

- [ ] **Step 5: Add a test for the export filter** — append to `__tests__/lib/exportContext.test.ts`:

```ts
  it('only exports confirmed purchases', async () => {
    // Trigger the build and capture the SQL passed to getAllAsync.
    await buildClaudeContext(mockDb as any, 'plan-1');
    const sqls = mockDb.getAllAsync.mock.calls.map((c: any[]) => c[0] as string);
    expect(sqls.some(s => /status = 'confirmed'/.test(s))).toBe(true);
  });
```

(If the existing file uses a different mock variable name, adapt accordingly.)

- [ ] **Step 6: Run tests**

Run: `npx jest __tests__/hooks/usePriceHistory.test.ts __tests__/lib/exportContext.test.ts`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add hooks/usePriceHistory.ts lib/exportContext.ts __tests__/hooks/usePriceHistory.test.ts __tests__/lib/exportContext.test.ts
git commit -m "feat: filter price history + export to confirmed purchases"
```

---

## Task 9 — `AddPurchaseData` branch field + `resolveOrCreateStore` tuple match

**Files:**
- Modify: `hooks/usePurchaseHistory.ts`
- Test: `__tests__/hooks/usePurchaseHistory.test.ts`

- [ ] **Step 1: Write the failing test** — append:

```ts
  it('addRecord resolves store by (chain, branch) tuple', async () => {
    mockDb.getFirstAsync.mockImplementation(async (sql: string, params: any[]) => {
      // Expect both chain and branch in the lookup.
      expect(sql).toMatch(/LOWER\(chain\) = LOWER\(\?\)/);
      expect(sql).toMatch(/LOWER\(branch\) = LOWER\(\?\)/);
      expect(params).toEqual(['Coles', 'Bondi']);
      return { id: 'store-bondi' };
    });
    const { result } = renderHook(() => usePurchaseHistory('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.addRecord({
        plan_id: 'p1', item_name: 'Chicken', store: 'Coles', branch: 'Bondi',
        brand: null, product_name: null, qty_amount: null, qty_unit: null,
        price: 10, is_sale: 0, barcode: null,
        purchased_at: '2026-05-12T10:00:00Z',
      });
    });
    const insert = mockDb.runAsync.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('INSERT INTO purchase_history')
    );
    expect(insert?.[1]).toContain('store-bondi');
  });
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx jest __tests__/hooks/usePurchaseHistory.test.ts -t "tuple"`
Expected: fails.

- [ ] **Step 3: Update `hooks/usePurchaseHistory.ts`**:

a) Extend `AddPurchaseData`:

```ts
export interface AddPurchaseData {
  plan_id: string | null;
  item_name: string;
  store: string;
  branch?: string;
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

b) Replace `resolveOrCreateStore` to match on chain + branch tuple:

```ts
async function resolveOrCreateStore(
  db: SQLiteDatabase,
  chainName: string,
  branchName: string = '',
): Promise<string> {
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM stores WHERE LOWER(chain) = LOWER(?) AND LOWER(branch) = LOWER(?)',
    [chainName, branchName],
  );
  if (existing) return existing.id;
  const id = generateId();
  await db.runAsync(
    'INSERT INTO stores (id, chain, branch, created_at) VALUES (?, ?, ?, ?)',
    [id, chainName, branchName, new Date().toISOString()],
  );
  return id;
}
```

c) Update both `addRecord` and `updatePending` call sites — change `resolveOrCreateStore(db, data.store)` to `resolveOrCreateStore(db, data.store, data.branch ?? '')`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx jest __tests__/hooks/usePurchaseHistory.test.ts`
Expected: all pass (the older test at the top of the file with `store: 'Coles'` and no branch should still pass because `branch` defaults to `''`).

- [ ] **Step 5: Commit**

```bash
git add hooks/usePurchaseHistory.ts __tests__/hooks/usePurchaseHistory.test.ts
git commit -m "feat(purchase-history): match stores by (chain, branch) tuple"
```

---

## Task 10 — `useShoppingMode`: split chain/branch in `SavedStore` and `activeStore`

**Files:**
- Modify: `hooks/useShoppingMode.ts`
- Test: `__tests__/hooks/useShoppingMode.test.ts`

- [ ] **Step 1: Update existing tests + add migration test** — open `__tests__/hooks/useShoppingMode.test.ts`. Replace every `'Coles Bondi'` / `'Woolworths'` / `'Aldi Newtown'` / `'Old Store'` / `'New Store'` literal that's currently passed to `setMode` or `addStore` with the new object shape, and update assertions that compare `activeStore` and `savedStores`. Updated file body (replace the whole `describe` block):

```ts
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
    await act(async () => { await result.current.setMode('review', { chain: 'Coles', branch: 'Bondi' }); });
    await act(async () => { await result.current.setMode('quick'); });
    expect(result.current.mode).toBe('quick');
    expect(result.current.activeStore).toBeNull();
  });

  it('setMode to review sets mode and active store (chain + branch)', async () => {
    const { result } = renderHook(() => useShoppingMode('plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.setMode('review', { chain: 'Coles', branch: 'Bondi' }); });
    expect(result.current.mode).toBe('review');
    expect(result.current.activeStore).toEqual({ chain: 'Coles', branch: 'Bondi' });
  });

  it('persists mode across hook remounts', async () => {
    const { result, unmount } = renderHook(() => useShoppingMode('plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.setMode('review', { chain: 'Woolworths', branch: '' }); });
    unmount();
    const { result: result2 } = renderHook(() => useShoppingMode('plan-1'));
    await waitFor(() => expect(result2.current.loading).toBe(false));
    expect(result2.current.mode).toBe('review');
    expect(result2.current.activeStore).toEqual({ chain: 'Woolworths', branch: '' });
  });

  it('addStore saves a new store and updates savedStores', async () => {
    const { result } = renderHook(() => useShoppingMode('plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.addStore({ chain: 'Aldi', branch: 'Newtown' }); });
    expect(result.current.savedStores).toContainEqual(
      expect.objectContaining({ chain: 'Aldi', branch: 'Newtown' }),
    );
  });

  it('savedStores are sorted by lastUsed descending', async () => {
    const { result } = renderHook(() => useShoppingMode('plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.setMode('review', { chain: 'Old', branch: '' }); });
    await act(async () => { await result.current.setMode('review', { chain: 'New', branch: '' }); });
    expect(result.current.savedStores[0].chain).toBe('New');
  });

  it('migrates legacy single-name AsyncStorage entries on read', async () => {
    await AsyncStorage.setItem(
      'shopping_stores',
      JSON.stringify([{ name: 'Coles Bondi', lastUsed: '2026-05-01T00:00:00Z' }]),
    );
    const { result } = renderHook(() => useShoppingMode('plan-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.savedStores[0]).toEqual(
      expect.objectContaining({ chain: 'Coles Bondi', branch: '' }),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx jest __tests__/hooks/useShoppingMode.test.ts`
Expected: most tests fail.

- [ ] **Step 3: Rewrite `hooks/useShoppingMode.ts`** — replace the whole file:

```ts
import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ShoppingMode = 'quick' | 'review';

export interface StoreLocation {
  chain: string;
  branch: string;
}

export interface SavedStore extends StoreLocation {
  lastUsed: string; // ISO datetime
}

interface PersistedModeState {
  mode: ShoppingMode;
  store: StoreLocation | null;
}

interface LegacyOrCurrentSavedStore {
  name?: string;        // legacy
  chain?: string;
  branch?: string;
  lastUsed: string;
}

const STORES_KEY = 'shopping_stores';

function modeKey(planId: string) {
  return `shopping_mode_${planId}`;
}

function migrateStore(entry: LegacyOrCurrentSavedStore): SavedStore {
  if (entry.chain != null) {
    return { chain: entry.chain, branch: entry.branch ?? '', lastUsed: entry.lastUsed };
  }
  return { chain: entry.name ?? '', branch: '', lastUsed: entry.lastUsed };
}

function sameStore(a: StoreLocation, b: StoreLocation): boolean {
  return a.chain === b.chain && a.branch === b.branch;
}

export function useShoppingMode(planId: string | null) {
  const [mode, setModeState] = useState<ShoppingMode>('quick');
  const [activeStore, setActiveStore] = useState<StoreLocation | null>(null);
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
        const raw: LegacyOrCurrentSavedStore[] = JSON.parse(storesRaw);
        const migrated = raw.map(migrateStore);
        setSavedStores(migrated.sort((a, b) => b.lastUsed.localeCompare(a.lastUsed)));
      }
      setLoading(false);
    }
    load();
  }, [planId]);

  const addStore = useCallback(async (store: StoreLocation) => {
    const now = new Date().toISOString();
    const existingRaw = await AsyncStorage.getItem(STORES_KEY);
    const existing: SavedStore[] = existingRaw
      ? (JSON.parse(existingRaw) as LegacyOrCurrentSavedStore[]).map(migrateStore)
      : [];
    const updated = [
      { ...store, lastUsed: now },
      ...existing.filter(s => !sameStore(s, store)),
    ].sort((a, b) => b.lastUsed.localeCompare(a.lastUsed));
    await AsyncStorage.setItem(STORES_KEY, JSON.stringify(updated));
    setSavedStores(updated);
  }, []);

  const setMode = useCallback(async (newMode: ShoppingMode, store?: StoreLocation) => {
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

- [ ] **Step 4: Run tests to verify pass**

Run: `npx jest __tests__/hooks/useShoppingMode.test.ts`
Expected: all pass.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: TS errors will appear in `app/(tabs)/shop.tsx`, `components/StorePickerSheet.tsx`, and `components/ReviewItemSheet.tsx` because callers pass `string` to `setMode`. These are fixed in Tasks 11–15. Continue if the errors are limited to those three files.

- [ ] **Step 6: Commit**

```bash
git add hooks/useShoppingMode.ts __tests__/hooks/useShoppingMode.test.ts
git commit -m "feat(shopping-mode): split chain/branch in SavedStore and activeStore"
```

---

## Task 11 — `StorePickerSheet`: two-input add-new + show branch

**Files:**
- Modify: `components/StorePickerSheet.tsx`

- [ ] **Step 1: Replace `components/StorePickerSheet.tsx`** with:

```tsx
import React, { useState } from 'react';
import {
  View, Modal, TouchableOpacity, TextInput,
  ScrollView, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './ui/AppText';
import { colors, font, spacing, radius } from '../constants/tokens';
import type { SavedStore } from '../hooks/useShoppingMode';

interface Props {
  visible: boolean;
  stores: SavedStore[];
  onConfirm: (store: { chain: string; branch: string }) => void;
  onClose: () => void;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatLastUsed(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function storeKey(s: { chain: string; branch: string }) {
  return `${s.chain}__${s.branch}`;
}

export function StorePickerSheet({ visible, stores, onConfirm, onClose }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(
    stores[0] ? storeKey(stores[0]) : null,
  );
  const [newChain, setNewChain] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [adding, setAdding] = useState(false);

  function handleConfirm() {
    if (adding) {
      const chain = newChain.trim();
      if (!chain) return;
      onConfirm({ chain, branch: newBranch.trim() });
      return;
    }
    const sel = stores.find(s => storeKey(s) === selectedKey);
    if (!sel) return;
    onConfirm({ chain: sel.chain, branch: sel.branch });
  }

  const canSave = adding ? !!newChain.trim() : !!selectedKey;

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
            {stores.map((s) => {
              const key = storeKey(s);
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.storeRow, selectedKey === key && !adding && styles.storeRowSelected]}
                  onPress={() => { setSelectedKey(key); setAdding(false); }}
                  activeOpacity={0.7}
                >
                  <View style={styles.storeRowContent}>
                    <AppText weight="bold" size="md" color="textPrimary">{s.chain}</AppText>
                    {s.branch ? (
                      <AppText weight="semibold" size="sm" color="textTertiary">{s.branch}</AppText>
                    ) : null}
                    <AppText weight="regular" size="sm" color="textTertiary">
                      Last used {formatLastUsed(s.lastUsed)}
                    </AppText>
                  </View>
                  {selectedKey === key && !adding && (
                    <Ionicons name="checkmark" size={16} color={colors.green} />
                  )}
                </TouchableOpacity>
              );
            })}

            {adding ? (
              <View style={styles.newStoreInputs}>
                <TextInput
                  style={styles.input}
                  placeholder="Chain (e.g. Coles)"
                  placeholderTextColor={colors.textTertiary}
                  value={newChain}
                  onChangeText={setNewChain}
                  autoFocus
                  returnKeyType="next"
                />
                <TextInput
                  style={[styles.input, { marginTop: spacing[2] }]}
                  placeholder="Branch — optional (e.g. Bondi)"
                  placeholderTextColor={colors.textTertiary}
                  value={newBranch}
                  onChangeText={setNewBranch}
                  returnKeyType="done"
                  onSubmitEditing={handleConfirm}
                />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addRow}
                onPress={() => { setAdding(true); setSelectedKey(null); }}
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
            style={[styles.confirmBtn, !canSave && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            activeOpacity={0.85}
            disabled={!canSave}
          >
            <AppText weight="extrabold" size="md" color="onGreen">Start reviewing</AppText>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
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
  storeRowContent: { flex: 1, gap: 2 },
  newStoreInputs: {
    marginBottom: spacing[2],
  },
  input: {
    backgroundColor: colors.cream, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.green,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
    fontFamily: font.family.semibold,
    fontSize: font.size.md, color: colors.textPrimary,
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

- [ ] **Step 2: Type-check (will still show shop.tsx errors — expected)**

Run: `npx tsc --noEmit`
Expected: errors remain only in `app/(tabs)/shop.tsx` and `components/ReviewItemSheet.tsx`. Continue.

- [ ] **Step 3: Commit**

```bash
git add components/StorePickerSheet.tsx
git commit -m "feat(store-picker): capture chain and branch as separate inputs"
```

---

## Task 12 — `ReviewItemSheet`: optional `pendingRow` prop for in-place edit

**Files:**
- Modify: `components/ReviewItemSheet.tsx`

- [ ] **Step 1: Update the `Props` interface and the body of `components/ReviewItemSheet.tsx`** — apply these targeted changes:

a) Replace the imports block (lines 16-22) with:

```tsx
import { colors, font, radius, spacing } from "../constants/tokens";
import type { AddPurchaseData } from "../hooks/usePurchaseHistory";
import type { ScanResult } from "../lib/barcodeScanResult";
import { formatPrice } from "../lib/format";
import type { PurchaseHistoryRow, QtyUnit, ShoppingItemRow } from "../types/db";
import { PriceHistoryChart } from "./PriceHistoryChart";
import { AppText } from "./ui/AppText";
```

(No change to the symbol list — just paste over to keep the file consistent.)

b) Replace the `Props` interface (lines 45-54):

```tsx
interface Props {
  visible: boolean;
  item: ShoppingItemRow | null;
  store: string;          // chain
  branch: string;         // may be ''
  latestRecord: PurchaseHistoryRow | null;
  pendingRow: PurchaseHistoryRow | null;
  pendingScan: ScanResult | null;
  onSave: (data: AddPurchaseData, pendingRowId: string | null) => void;
  onClose: () => void;
  onPendingScanConsumed: () => void;
}
```

c) Update the destructure on lines 56-65 to include `branch` and `pendingRow`:

```tsx
export function ReviewItemSheet({
  visible,
  item,
  store,
  branch,
  latestRecord,
  pendingRow,
  pendingScan,
  onSave,
  onClose,
  onPendingScanConsumed,
}: Props) {
```

d) Replace the prefill effect (lines 79-101) so `pendingRow` takes precedence over `latestRecord`:

```tsx
  useEffect(() => {
    if (!visible) return;
    setUnitPickerOpen(false);
    const source = pendingRow ?? latestRecord;
    if (source) {
      setBrand(source.brand ?? "");
      setProductName(source.product_name ?? "");
      setQtyAmount(source.qty_amount != null ? String(source.qty_amount) : "");
      setQtyUnit(source.qty_unit ?? "g");
      setPrice(source.price != null ? String(source.price) : "");
      setIsSale(pendingRow ? source.is_sale === 1 : false);
      setBarcode(source.barcode ?? "");
    } else {
      setBrand("");
      setProductName("");
      setQtyAmount("");
      setQtyUnit("g");
      setPrice("");
      setIsSale(false);
      setBarcode("");
    }
  }, [visible, latestRecord, pendingRow]);
```

e) Replace `handleSave` (lines 124-139) to pass branch and pending id through:

```tsx
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

f) Update the prefill badge (lines 174-180) so it doesn't show "last bought" when we're editing a pending row:

```tsx
          {!pendingRow && hasPrefill && latestRecord && (
            <View style={styles.prefillBadge}>
              <AppText weight="semibold" size="sm" color="textSecondary">
                {`↩ Last bought ${formatDate(latestRecord.purchased_at)}${latestRecord.price != null ? ` · ${formatPrice(latestRecord.price)}` : ""}`}
              </AppText>
            </View>
          )}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: errors now point at `app/(tabs)/shop.tsx` only (the caller of this component). Fixed in Task 15.

- [ ] **Step 3: Commit**

```bash
git add components/ReviewItemSheet.tsx
git commit -m "feat(review-sheet): accept pendingRow prop for in-place editing"
```

---

## Task 13 — `ReceiptRow` component (swipe-to-remove + tap-to-edit)

**Files:**
- Create: `components/ReceiptRow.tsx`

- [ ] **Step 1: Create `components/ReceiptRow.tsx`**:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useFocusEffect } from 'expo-router';
import { AppText } from './ui/AppText';
import { colors, font, spacing } from '../constants/tokens';
import { formatPrice } from '../lib/format';

const ACTION_WIDTH = 90;
const SPRING = { damping: 20, stiffness: 200 };

interface Props {
  name: string;
  subtitle: string | null;   // qty + brand + product line, formatted by caller
  price: number | null;
  onTap: () => void;
  onRemove: () => void;
}

export function ReceiptRow({ name, subtitle, price, onTap, onRemove }: Props) {
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      return () => { translateX.value = withSpring(0, SPRING); };
    }, []),
  );

  const handleRemove = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onRemove();
  };

  const handleTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    translateX.value = withSpring(0, SPRING);
    onTap();
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-5, 5])
    .failOffsetY([-10, 10])
    .onBegin(() => { startX.value = translateX.value; })
    .onUpdate((e) => {
      translateX.value = Math.max(-ACTION_WIDTH, Math.min(0, startX.value + e.translationX));
    })
    .onEnd(() => {
      translateX.value = withSpring(
        translateX.value < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0,
        SPRING,
      );
    });

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.outer}>
      <GestureDetector gesture={pan}>
        <View style={styles.container}>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.removeAction}
              onPress={handleRemove}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Remove from receipt"
            >
              <Ionicons name="trash-outline" size={22} color={colors.onGreen} />
            </TouchableOpacity>
          </View>
          <Animated.View style={[styles.content, contentStyle]}>
            <TouchableOpacity
              style={styles.row}
              onPress={handleTap}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${name}`}
            >
              <View style={styles.left}>
                <AppText weight="bold" size="md" color="green">{name}</AppText>
                {subtitle ? (
                  <AppText weight="semibold" size="xs" color="textTertiary">
                    {subtitle}
                  </AppText>
                ) : null}
              </View>
              <AppText weight="extrabold" size="md" color="green" style={styles.price}>
                {price != null ? formatPrice(price) : '—'}
              </AppText>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { position: 'relative' },
  container: { position: 'relative' },
  actions: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row', justifyContent: 'flex-end',
  },
  removeAction: {
    width: ACTION_WIDTH,
    backgroundColor: colors.terracotta,
    justifyContent: 'center', alignItems: 'center',
  },
  content: {
    backgroundColor: colors.paper,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing[2] + 1, // 9dp
  },
  left: { flex: 1, gap: 2 },
  price: {
    fontVariant: ['tabular-nums'],
  },
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: passes for this file.

- [ ] **Step 3: Commit**

```bash
git add components/ReceiptRow.tsx
git commit -m "feat: add ReceiptRow component with swipe-to-remove + tap-to-edit"
```

---

## Task 14 — `shop-receipt` modal route + register in `_layout.tsx`

**Files:**
- Create: `app/shop-receipt.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Register the route in `app/_layout.tsx`** — add a new `Stack.Screen` after `category-order` (line 44):

```tsx
          <Stack.Screen name="shop-receipt" options={{ presentation: 'modal' }} />
```

- [ ] **Step 2: Create `app/shop-receipt.tsx`**:

```tsx
import React, { useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../components/ui/AppText';
import { ReceiptRow } from '../components/ReceiptRow';
import { ReviewItemSheet } from '../components/ReviewItemSheet';
import { usePlan } from '../hooks/usePlan';
import { usePurchaseHistory } from '../hooks/usePurchaseHistory';
import { useShoppingMode } from '../hooks/useShoppingMode';
import { useShoppingItems } from '../hooks/useShoppingItems';
import { colors, spacing, radius } from '../constants/tokens';
import { formatPrice } from '../lib/format';
import type { AddPurchaseData } from '../hooks/usePurchaseHistory';
import type { PurchaseHistoryRow, ShoppingItemRow } from '../types/db';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const dd = d.getDate();
  const mmm = MONTHS[d.getMonth()];
  const yyyy = d.getFullYear();
  const hh = String(d.getHours() % 12 || 12);
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ampm = d.getHours() < 12 ? 'AM' : 'PM';
  return `${dd} ${mmm} ${yyyy} · ${hh}:${mm} ${ampm}`;
}

function rowSubtitle(row: PurchaseHistoryRow): string | null {
  const parts: string[] = [];
  if (row.qty_amount != null && row.qty_unit != null) {
    parts.push(`${row.qty_amount}${row.qty_unit}`);
  }
  if (row.brand) parts.push(row.brand);
  if (row.product_name && row.product_name !== row.brand) parts.push(row.product_name);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export default function ShopReceiptScreen() {
  const insets = useSafeAreaInsets();
  const { plan } = usePlan();
  const planId = plan?.row.id ?? null;
  const { activeStore } = useShoppingMode(planId);
  const { items, toggleItem } = useShoppingItems(planId);
  const {
    pendingRecords,
    deletePending,
    updatePending,
    confirmShop,
  } = usePurchaseHistory(planId);

  const [editing, setEditing] = useState<PurchaseHistoryRow | null>(null);

  const earliestPurchasedAt = useMemo(() => {
    if (pendingRecords.length === 0) return new Date().toISOString();
    return pendingRecords[0].purchased_at;
  }, [pendingRecords]);

  const total = useMemo(
    () => pendingRecords.reduce((sum, r) => sum + (r.price ?? 0), 0),
    [pendingRecords],
  );

  const chain = activeStore?.chain ?? '';
  const branch = activeStore?.branch ?? '';
  const isEmpty = pendingRecords.length === 0;

  function findItemFor(row: PurchaseHistoryRow): ShoppingItemRow | undefined {
    return items.find(
      i => i.name.toLowerCase() === row.item_name.toLowerCase(),
    );
  }

  async function handleRemove(row: PurchaseHistoryRow) {
    if (!planId) return;
    const item = findItemFor(row);
    await deletePending(planId, row.item_name);
    if (item && item.is_checked === 1) {
      await toggleItem(item.id);
    }
  }

  async function handleSaveEdit(data: AddPurchaseData, pendingRowId: string | null) {
    if (pendingRowId) {
      await updatePending(pendingRowId, data);
    }
    setEditing(null);
  }

  async function handleConfirm() {
    if (!planId || isEmpty) return;
    await confirmShop(planId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <TouchableOpacity
          style={styles.close}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close receipt"
        >
          <Ionicons name="close" size={26} color={colors.onGreen} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AppText weight="extrabold" size="xl" color="onGreen">Done shopping</AppText>
          {!isEmpty && (
            <AppText weight="semibold" size="xs" color="onGreenSubtle">
              Tap a line to edit · swipe to remove
            </AppText>
          )}
        </View>
      </View>

      {isEmpty ? (
        <View style={styles.empty}>
          <AppText weight="bold" size="lg" color="textPrimary" style={styles.emptyText}>
            Nothing left — shop again?
          </AppText>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.back()}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Close receipt"
          >
            <AppText weight="extrabold" size="md" color="onGreen">Close</AppText>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView style={styles.paper} contentContainerStyle={styles.paperContent}>
            <AppText weight="extrabold" size="xl" color="green" style={styles.storeLine}>
              {chain.toUpperCase()}
            </AppText>
            {branch ? (
              <AppText weight="bold" size="sm" color="green" style={styles.branchLine}>
                {branch.toUpperCase()}
              </AppText>
            ) : null}
            <AppText weight="semibold" size="xs" color="textTertiary" style={styles.dateLine}>
              {formatDateTime(earliestPurchasedAt)}
            </AppText>

            <View style={styles.dashed} />

            {pendingRecords.map((row) => (
              <ReceiptRow
                key={row.id}
                name={row.item_name}
                subtitle={rowSubtitle(row)}
                price={row.price}
                onTap={() => setEditing(row)}
                onRemove={() => handleRemove(row)}
              />
            ))}

            <View style={styles.dashed} />

            <AppText weight="bold" size="xs" color="textTertiary" style={styles.itemCount}>
              — {pendingRecords.length} item{pendingRecords.length === 1 ? '' : 's'} —
            </AppText>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[3] }]}>
            <View style={styles.totalLine}>
              <AppText weight="extrabold" size="2xl" color="green">TOTAL</AppText>
              <AppText weight="extrabold" size="2xl" color="orange" style={styles.totalAmount}>
                {formatPrice(total)}
              </AppText>
            </View>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={handleConfirm}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Confirm shop"
            >
              <AppText weight="extrabold" size="md" color="onGreen">Confirm</AppText>
            </TouchableOpacity>
          </View>
        </>
      )}

      <ReviewItemSheet
        visible={editing !== null}
        item={editing ? {
          // ReviewItemSheet uses only .name and .plan_id from this object; the rest is filler.
          id: editing.id,
          plan_id: editing.plan_id ?? '',
          name: editing.item_name,
          category: '',
          category_order: 0,
          item_order: 0,
          qty: '',
          estimated_price: 0,
          is_oneoff: 0,
          note: null,
          is_checked: 1,
        } : null}
        store={chain}
        branch={branch}
        latestRecord={null}
        pendingRow={editing}
        pendingScan={null}
        onSave={handleSaveEdit}
        onClose={() => setEditing(null)}
        onPendingScanConsumed={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  header: {
    backgroundColor: colors.green,
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing[3],
  },
  close: { padding: spacing[1] },
  paper: { flex: 1 },
  paperContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: 150,
  },
  storeLine: { textAlign: 'center', letterSpacing: 1.8 },
  branchLine: { textAlign: 'center', letterSpacing: 1, opacity: 0.75, marginTop: 2 },
  dateLine: { textAlign: 'center', marginTop: spacing[1] + 2 },
  dashed: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.paperDivider,
    marginVertical: spacing[3] + 2,
  },
  itemCount: { textAlign: 'center', letterSpacing: 0.5 },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.paperDivider,
    borderStyle: 'dashed',
  },
  totalLine: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  totalAmount: { fontVariant: ['tabular-nums'] },
  confirmBtn: {
    backgroundColor: colors.orange, borderRadius: radius.full,
    paddingVertical: spacing[3] + 2, alignItems: 'center',
  },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing[5], gap: spacing[5],
  },
  emptyText: { textAlign: 'center' },
  emptyBtn: {
    backgroundColor: colors.green, borderRadius: radius.full,
    paddingHorizontal: spacing[6], paddingVertical: spacing[3],
  },
});
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: passes for receipt screen (shop.tsx still has errors — fixed in Task 15).

- [ ] **Step 4: Commit**

```bash
git add app/shop-receipt.tsx app/_layout.tsx
git commit -m "feat: shop-receipt modal screen with pending list and confirm action"
```

---

## Task 15 — Shop screen: header CTA + uncheck-deletes-pending + navigation

**Files:**
- Modify: `app/(tabs)/shop.tsx`

This task rewrites the Shop screen UI and wiring. Apply changes in order.

- [ ] **Step 1: Update imports** — replace the imports block at the top of `app/(tabs)/shop.tsx` with:

```tsx
import React, { useState, useCallback, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { GreenHeader } from '../../components/ui/GreenHeader';
import { AppText } from '../../components/ui/AppText';
import { EmptyState } from '../../components/ui/EmptyState';
import { ShopSkeleton } from '../../components/ui/ShopSkeleton';
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
import type { AddPurchaseData } from '../../hooks/usePurchaseHistory';
import { useCategoryOrder } from '../../hooks/useCategoryOrder';
import { formatWeekOf, formatPrice } from '../../lib/format';
import { colors, spacing, radius, shadow } from '../../constants/tokens';
```

(Removed: `ProgressBar` import, `formatItemCount` import. Added: `Haptics`.)

- [ ] **Step 2: Update hook usage** — replace the hook calls at the top of `ShopScreen()` (lines 39-44 in current file) with:

```tsx
  const insets = useSafeAreaInsets();
  const { plan, loading: planLoading } = usePlan();
  const planId = plan?.row.id ?? null;
  const { items, loading: itemsLoading, toggleItem, addItem, updateItem, deleteItem } = useShoppingItems(planId);
  const { applySavedOrder, reload: reloadCategoryOrder } = useCategoryOrder();
  const { pendingRecords, addRecord, deletePending, getLatestForItem } = usePurchaseHistory(planId);
  const { mode, activeStore, savedStores, setMode } = useShoppingMode(planId);
```

- [ ] **Step 3: Update local state for the review sheet** — replace the `reviewLatest`/`reviewItem` state and add a pending lookup. Replace lines 47-51 with:

```tsx
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItemRow | null>(null);
  const [reviewItem, setReviewItem] = useState<ShoppingItemRow | null>(null);
  const [reviewLatest, setReviewLatest] = useState<PurchaseHistoryRow | null>(null);
  const [storePickerVisible, setStorePickerVisible] = useState(false);
  const [pendingScan, setPendingScan] = useState<ScanResult | null>(null);
```

(No structural change to that block — keep as-is. Just confirm it still matches above.)

- [ ] **Step 4: Update the memoised derived state** — replace the `useMemo` block (lines 71-108) with a smaller version that no longer computes budget / items-left / progress:

```tsx
  const {
    uncheckedItems,
    checkedItems,
    allCategories,
    orderedCategories,
    oneoffCategorySet,
  } = useMemo(() => {
    const unchecked = items.filter((i) => i.is_checked === 0);
    const checked = items.filter((i) => i.is_checked === 1);
    const allCats = [...new Set(items.map((i) => i.category))];
    const uncheckedCatNames = [...new Set(unchecked.map((i) => i.category))];
    const oneoffCats = new Set(
      unchecked.filter((i) => i.is_oneoff === 1).map((i) => i.category),
    );
    const sorted = applySavedOrder(uncheckedCatNames);
    const regular = sorted.filter((c) => !oneoffCats.has(c));
    const oneoff = sorted.filter((c) => oneoffCats.has(c));
    return {
      uncheckedItems: unchecked,
      checkedItems: checked,
      allCategories: allCats,
      orderedCategories: [...regular, ...oneoff],
      oneoffCategorySet: oneoffCats,
    };
  }, [items, applySavedOrder]);

  const pendingCount = pendingRecords.length;
  const totalItems = items.length;
  const pendingTotal = useMemo(
    () => pendingRecords.reduce((sum, r) => sum + (r.price ?? 0), 0),
    [pendingRecords],
  );
  const showCompleteCta = mode === 'review' && pendingCount > 0;
```

- [ ] **Step 5: Update `handleToggle`** — replace the existing `handleToggle` (lines 110-120) so an uncheck in Review mode also deletes the pending row:

```tsx
  async function handleToggle(itemId: string) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    if (mode === 'review' && item.is_checked === 0) {
      const latest = await getLatestForItem(item.name);
      setReviewLatest(latest);
      setReviewItem(item);
      return;
    }
    // Toggle path: if we're in Review mode and turning an item OFF,
    // also delete the corresponding pending purchase row so it doesn't persist.
    if (mode === 'review' && item.is_checked === 1 && planId) {
      await deletePending(planId, item.name);
    }
    toggleItem(itemId);
  }
```

- [ ] **Step 6: Update `handleReviewSave`** — replace lines 122-128 so it writes status='pending' and ignores the `pendingRowId` from the receipt-edit shape (the receipt screen handles its own edits):

```tsx
  async function handleReviewSave(data: AddPurchaseData /* pendingRowId is unused on the shop screen */) {
    if (!reviewItem) return;
    toggleItem(reviewItem.id);
    await addRecord(data, 'pending');
    setReviewItem(null);
    setReviewLatest(null);
  }
```

- [ ] **Step 7: Update `handleStoreConfirm`** — replace lines 139-142:

```tsx
  function handleStoreConfirm(store: { chain: string; branch: string }) {
    setStorePickerVisible(false);
    setMode('review', store);
  }
```

- [ ] **Step 8: Replace the header JSX** — find the `<GreenHeader>` block (roughly lines 160-229 in the current file) and replace it with:

```tsx
      <GreenHeader>
        <View style={styles.headerContent}>
          <Animated.View style={[styles.titleRow, titleRowStyle, { paddingBottom: spacing[2] }]}>
            <AppText weight="extrabold" color="onGreen" size="3xl">Shopping List</AppText>
            <View style={styles.titleRowRight}>
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

          <View style={styles.weekStoreRow}>
            <AppText weight="semibold" color="onGreenSubtle" size="xs">
              Week of {formatWeekOf(plan.row.week_starting)}
              {mode === 'review' && activeStore ? `  ·  📍 ${activeStore.chain}` : ''}
            </AppText>
          </View>

          {showCompleteCta && (
            <TouchableOpacity
              style={styles.completeCta}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/shop-receipt');
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Done shopping — review receipt"
            >
              <AppText weight="extrabold" size="sm" color="onGreen">
                {`Done shopping · ${pendingCount} of ${totalItems}`}
              </AppText>
              <AppText weight="extrabold" size="sm" color="onGreen">
                {`${formatPrice(pendingTotal)} ›`}
              </AppText>
            </TouchableOpacity>
          )}
        </View>
      </GreenHeader>
```

- [ ] **Step 9: Update the `ReviewItemSheet` JSX** — find where it's rendered (near the bottom of the file) and update the props:

```tsx
      <ReviewItemSheet
        visible={reviewItem !== null}
        item={reviewItem}
        store={activeStore?.chain ?? ''}
        branch={activeStore?.branch ?? ''}
        latestRecord={reviewLatest}
        pendingRow={null}
        pendingScan={pendingScan}
        onSave={handleReviewSave}
        onClose={() => { setReviewItem(null); setReviewLatest(null); }}
        onPendingScanConsumed={() => setPendingScan(null)}
      />
```

- [ ] **Step 10: Update the styles** — replace the `styles` block at the bottom of the file with:

```tsx
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  outerEmpty: { flex: 1, backgroundColor: colors.green },
  emptyContainer: { flex: 1, backgroundColor: colors.cream },
  headerContent: { paddingBottom: spacing[1], gap: spacing[1] },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  modeSeg: {
    flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: radius.full, padding: 2, gap: 2,
  },
  segOpt: { borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: spacing[1] },
  segOptActive: { backgroundColor: colors.onGreen },
  reorderBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  weekStoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  completeCta: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.orange,
    paddingHorizontal: spacing[4],
    paddingVertical: 11,
    borderRadius: radius.full,
    marginTop: spacing[1],
  },
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

(Removed: `storePill`, `pillsRow`, `pill`, `itemsLeft` — they were tied to the budget/progress UI. Added: `completeCta`.)

- [ ] **Step 11: Type-check + run all tests**

Run: `npx tsc --noEmit`
Expected: passes.

Run: `npx jest`
Expected: all tests pass.

- [ ] **Step 12: Smoke test in the app**

Boot the app (`npm start` and run on a simulator/device). Walk through:

1. Switch to **Review** mode → store picker appears → add a new store with `chain="Coles"` and `branch="Bondi"` → confirm.
2. Verify the header no longer shows the budget pill, item-count pill, progress bar, or "items left" text.
3. Verify the week line reads `Week of … · 📍 Coles`.
4. Tap an unchecked item → review sheet opens → fill price → Save.
5. Verify the orange `Done shopping · 1 of N · $X.XX ›` CTA appears.
6. Uncheck the item from the basket → verify the CTA hides again (no pending rows).
7. Re-check → tap CTA → receipt opens.
8. Verify the receipt shows `COLES` over `BONDI`, the row(s), and a `TOTAL` matching what you entered.
9. Swipe a row left → tap the trash → row disappears, item is un-checked back on the shop list (verify by closing the modal).
10. Re-check items → reopen receipt → tap a row → review sheet opens preloaded with the pending data → update price → Save → receipt total updates.
11. Tap **Confirm** → modal dismisses, basket clears, CTA hides, `purchase_history` has the rows now as `confirmed` (verify by checking the price-history chart or by re-running a price-tracking flow).
12. Switch back to **Quick** mode → confirm the CTA never shows.

- [ ] **Step 13: Commit**

```bash
git add 'app/(tabs)/shop.tsx'
git commit -m "feat(shop): Done shopping CTA + uncheck deletes pending row"
```

---

## Spec Coverage Check

Verify before handing off:

- [x] Migration v4 (Task 3)
- [x] Schema status column (Task 2)
- [x] Type `status` field (Task 2)
- [x] Read filters by `status='confirmed'` — purchase_history hook (Task 4), usePriceHistory (Task 8), exportContext (Task 8)
- [x] `addRecord` status param (Task 4)
- [x] `deletePending` (Task 5)
- [x] `updatePending` (Task 6)
- [x] `confirmShop` transaction (Task 7)
- [x] `pendingRecords` derived state (Task 7)
- [x] `AddPurchaseData.branch` + tuple match in `resolveOrCreateStore` (Task 9)
- [x] `useShoppingMode` chain/branch split + lazy AsyncStorage migration (Task 10)
- [x] `StorePickerSheet` two-input add (Task 11)
- [x] `ReviewItemSheet` `pendingRow` preload (Task 12)
- [x] `ReceiptRow` swipe-to-remove + tap-to-edit (Task 13)
- [x] `shop-receipt` modal + route registration (Task 14)
- [x] Shop screen header (CTA, removed pills/progress) (Task 15)
- [x] Uncheck-in-review-deletes-pending (Task 15, Step 5)
- [x] `paper`/`paperDivider` tokens (Task 1)
- [x] Receipt empty-state — "Nothing left — shop again?" (Task 14, Step 2)
