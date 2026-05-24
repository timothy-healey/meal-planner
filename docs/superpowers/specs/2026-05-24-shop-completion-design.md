# Shop Completion — Pending Purchases & Receipt Screen

> **Visual reference:** [2026-05-24-shop-completion-mockups.html](2026-05-24-shop-completion-mockups.html) — open in a browser. Implementation must match these mockups (header CTA layout, receipt-paper aesthetic, colours, dashed dividers, tabular-nums, etc.).

## Overview

Today, checking an item off in Review mode immediately writes a row to `purchase_history`. Unchecking the item flips `is_checked` but leaves the row in place, so the purchase persists even if the user didn't actually buy it. Re-checking creates a second row.

This change introduces a **pending → confirmed** lifecycle for purchase records, plus a dedicated **"Done shopping" receipt screen** where the user reviews and confirms the trip before anything is written to history.

## Goals

- Capture each Review-mode check as a *pending* purchase that can be edited or removed before it commits to history.
- Provide a deliberate "I'm done shopping" action that bulk-confirms the trip and clears checked items off the shop list.
- Display chain + branch on the receipt (and clean up the store picker to capture them properly).

## Non-goals

- Quick mode is unchanged — no purchase tracking, no Complete button.
- No changes to the budget pill / progress bar elsewhere (though both are removed from the Shop header — see UI section).
- No garbage collection of orphaned pending rows from prior plans (deferred).
- No bulk migration of existing `chain` values that already include a branch as one string (e.g. "Coles Bondi" stays as-is; new entries use the split fields).

---

## Data model

### Migration v4 — add `status` column

```sql
ALTER TABLE purchase_history
  ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed';
```

- Existing rows take the `'confirmed'` default → history and charts unaffected.
- No index. Selectivity is poor (two values, >99% `confirmed` in steady state) and dataset is tiny; revisit only if a real perf problem appears.
- `PRAGMA user_version = 4` after the ALTER.
- `SCHEMA_SQL` updated to include `status TEXT NOT NULL DEFAULT 'confirmed'` so fresh installs match.

### Type change

`types/db.ts` — `PurchaseHistoryRow` gains:

```ts
status: 'pending' | 'confirmed';
```

### Lifecycle of a pending row

1. User checks an item in Review mode → `ReviewItemSheet` opens → Save inserts a row with `status='pending'`. Shopping item toggles to checked.
2. User unchecks that item (from basket or by re-tapping in the list) → the corresponding pending row is **deleted**. Shopping item toggles to unchecked.
3. User re-checks → the review sheet opens fresh (no preloaded data); creates a new pending row.
4. User taps **Done shopping** → receipt screen.
5. User edits a row on the receipt → reopens `ReviewItemSheet` preloaded with the pending row; Save updates the pending row in place.
6. User removes a row on the receipt (swipe-to-delete) → pending row deleted, shopping item unchecked.
7. User taps **Confirm** → single transaction: bulk update pending → confirmed for this plan, then delete all `is_checked=1` shopping items for this plan.

### Scoping

Pending rows are scoped by `plan_id`. The Shop screen and receipt only consider pending rows for the active plan. Orphaned pending rows from older plans stay in the DB but never surface (deferred GC).

### Read-side filtering

All purchase-history read queries gain `WHERE status = 'confirmed'`:

| Function | File |
|---|---|
| `getLatestForItem` | `hooks/usePurchaseHistory.ts` |
| `getLatestForBarcode` | `hooks/usePurchaseHistory.ts` |
| `load` (the records list) | `hooks/usePurchaseHistory.ts` |
| price history queries | `hooks/usePriceHistory.ts` |
| export query | `lib/exportContext.ts` |

This guarantees pending rows never leak into the chart, the "latest price" suggestion in the review sheet, or the export.

---

## Store picker — capture branch

The `stores` table already has `chain` and `branch` columns; the picker currently captures one free-text name and writes `branch=''`.

### UI changes — `components/StorePickerSheet.tsx`

- Existing saved-store rows: still selectable as today.
- "Add new store" enters edit mode with **two stacked text inputs**:
  - **Chain** (placeholder: "Coles")
  - **Branch** (placeholder: "Bondi · optional")
- Confirm is enabled when chain is non-empty.
- A saved store now displays as `{chain}` with `{branch}` underneath in a smaller, lighter weight (hidden if blank).

### Type/data changes

- `SavedStore` in `hooks/useShoppingMode.ts` gains `branch: string` (default `''`). AsyncStorage payload migrates lazily on read — entries without a branch key are treated as `branch: ''`.
- `setMode` and `addStore` accept `{ chain, branch }` instead of a single `storeName: string`.
- `activeStore` in `useShoppingMode` becomes `{ chain: string; branch: string } | null`.
- The Shop header location (`📍 {chain}`) shows chain only; branch is shown only on the receipt.
- `usePurchaseHistory.resolveOrCreateStore` accepts `{ chain, branch }` and matches on the tuple `LOWER(chain)=? AND LOWER(branch)=?` so "Coles Bondi" and "Coles Brunswick" are distinct.
- `AddPurchaseData` gains an optional `branch?: string` (defaults to `''`). `AddPriceSheet` is unchanged — it still captures one chain name, which routes to `resolveOrCreateStore({ chain, branch: '' })`. Updating `AddPriceSheet` to capture branch is deferred (out of scope).

### Known limitation

Existing store rows where the entire name is in `chain` (e.g. `chain='Coles Bondi', branch=''`) won't be deduped against newly-entered split values. Acceptable — users can manually clean up if desired, or just keep using the old entry by selecting it from the list.

---

## UI — Shop screen header

### Goals

Reduce header chrome. Replace the progress bar + budget pill + "items left" with the new Done-shopping CTA.

### Layout — locked

| Row | Content |
|---|---|
| Title row | `Shopping List` · Quick/Review segment · reorder icon |
| Week line | `Week of {date} · 📍 {chain}` (chain only — branch suppressed) |
| CTA row | Full-width orange button: `Done shopping · {pendingCount} of {totalItems}` on the left, `${total} ›` on the right |

### Removed

- Budget pill (`Budget $XX.XX`)
- Item-count pill (`X / Y items`) — the count now lives inside the CTA
- Progress bar
- "X items left" text

### CTA visibility

- Visible only when `mode === 'review'` **and** there is at least one pending row for the active plan.
- When hidden, the CTA row collapses (no empty space). Header shows just title row + week line.
- Quick mode never shows the CTA.

### CTA content

- Label left: `Done shopping · {pendingCount} of {totalItems}` (pendingCount = number of pending rows; totalItems = total items on the shop list).
- Label right: `${pendingTotal} ›` — formatted via `formatPrice` over `SUM(COALESCE(price, 0))` across pending rows. Rows with null price contribute $0.00.
- Tapping pushes the receipt modal route.

### CTA style

- Orange background (`colors.orange`), white text, full-width within header padding, radius `999` (pill), `paddingVertical` ≈ 11dp.
- Font: Plus Jakarta Sans `extrabold`, size `sm` (11dp).
- Subtle press feedback via existing TouchableOpacity `activeOpacity={0.85}` and a light haptic on press (matches Pill convention).

---

## UI — Receipt screen

### Route

New route `app/shop-receipt.tsx`, registered in `app/_layout.tsx` with `presentation: 'modal'` (matches settings, category-order).

### Header (green band)

- `×` close button (left)
- Title: `Done shopping`
- Subtitle: `Tap a line to edit · swipe to remove`

### Body — receipt-paper aesthetic

Background: pale cream (`#fbfbf2`, slightly warmer than `colors.cream`). Add two new tokens to `constants/tokens.ts`:

- `colors.paper = '#fbfbf2'` — receipt background
- `colors.paperDivider = '#b8b8a0'` — dashed divider colour

Reference these in the receipt component rather than hard-coding hex.

```
                 COLES
                 BONDI
          25 May 2026 · 4:32 PM
- - - - - - - - - - - - - - - - -

Avocado                    $3.50
×2

Spinach                    $4.00
120g · Coles brand

…
- - - - - - - - - - - - - - - - -
              — 6 items —
```

- Centred chain (size `lg`, weight `extrabold`, `letterSpacing: 1.8`)
- Centred branch underneath (size `xs`, weight `bold`, `letterSpacing: 1`, `opacity: 0.75`)
- Branch line **hidden** if empty
- Centred date/time line: `{D MMM YYYY · HH:mm}` formatted from the earliest pending row's `purchased_at` (set when that row was first inserted at check time — represents when the shop started). Not recomputed when rows are edited.
- Dashed dividers: 1px dashed `#b8b8a0`, vertical margin `10`
- Items: name (bold) and qty/brand subtitle (`#898970`, size `xs`) on the left, price on the right (extrabold, tabular nums)
- Item count footer: `— X items —`, centred, `#898970`

### Typography

Plus Jakarta Sans throughout — no new font. Prices use `fontVariant: ['tabular-nums']` so they align vertically without a monospace face.

### Interactions

- **Tap row** → opens `ReviewItemSheet` preloaded with this pending row's data. Save updates the existing pending row in place. Cancel just dismisses.
- **Swipe left on row** → reveals a single `Remove` action button (red, full row height). Tap removes the pending row AND unchecks the corresponding shopping item.
- **Close (×)** → dismisses without committing. Pending rows persist. User can keep shopping.
- **Confirm** → see footer.

### Footer (sticky)

- Top: dashed divider line (continuous with body)
- Total row: `TOTAL` (extrabold, size `2xl`) on the left, `${pendingTotal}` (extrabold, orange, tabular nums) on the right
- Below: full-width `Confirm` button (orange pill, white text, extrabold, size `md`, `paddingVertical: 14`)
- Confirm action:
  1. Single DB transaction:
     - `UPDATE purchase_history SET status='confirmed' WHERE plan_id=? AND status='pending'`
     - `DELETE FROM shopping_items WHERE plan_id=? AND is_checked=1`
  2. Light success haptic
  3. Navigate back to the Shop tab

### Empty state

Shouldn't be reachable (CTA hidden when zero pending). If it happens (e.g. user removed every row via swipe), show a small centred "Nothing left — shop again?" with a `Close` button.

---

## Hooks / data layer changes

### `hooks/usePurchaseHistory.ts`

| Function | Change |
|---|---|
| `addRecord(data, status?)` | Optional second arg `status: 'pending' \| 'confirmed'` (default `'confirmed'`). Shop-screen review-sheet flow passes `'pending'` explicitly; standalone callers (e.g. AddPriceSheet) keep the default. |
| `deletePending(planId, itemName)` | New. `DELETE FROM purchase_history WHERE plan_id=? AND LOWER(item_name)=LOWER(?) AND status='pending'`. |
| `updatePending(id, data)` | New. Updates an existing pending row in place (used by receipt-row edits). |
| `confirmShop(planId)` | New. The bulk update + delete-checked-items transaction. Reloads records on success. |
| `pendingRecords` | New derived state — pending rows for the current plan. Drives Shop header CTA. |
| `load` / `records` | Filtered to `status='confirmed'` so callers see only history. |
| `getLatestForItem` | Adds `AND status='confirmed'`. |
| `getLatestForBarcode` | Adds `AND status='confirmed'`. |

#### Call-site audit for `addRecord`

- `app/(tabs)/shop.tsx:125` (`handleReviewSave`) → passes `status: 'pending'` (the new flow).
- `components/AddPriceSheet.tsx:54` (adding a price from the chart, `plan_id: null`) → uses the default `'confirmed'`. Not tied to a shop trip.

No other production call sites.

### `hooks/useShoppingMode.ts`

- `SavedStore` gains `branch: string`.
- `setMode(mode, { chain, branch })` accepts the split shape (renamed param).
- `activeStore` becomes `{ chain, branch } | null`.
- AsyncStorage payload key `shopping_stores` stays the same; entries are upgraded on read (defaulting `branch` to `''`).

### `hooks/useShoppingItems.ts`

No structural change. The Shop screen orchestrates the "uncheck → delete pending" pairing rather than baking it into this hook.

---

## Component changes summary

| File | Change |
|---|---|
| `lib/db/migrations.ts` | v4 migration block — `ALTER TABLE purchase_history ADD COLUMN status …`, then `PRAGMA user_version = 4`. |
| `lib/db/schema.ts` | Add `status TEXT NOT NULL DEFAULT 'confirmed'` to the `purchase_history` create. |
| `types/db.ts` | Add `status` to `PurchaseHistoryRow`. |
| `hooks/usePurchaseHistory.ts` | New `pendingRecords`, `deletePending`, `updatePending`, `confirmShop`; filter reads by `status='confirmed'`; `addRecord` writes `'pending'` by default. |
| `hooks/useShoppingMode.ts` | Split chain/branch in `SavedStore` and `activeStore`. |
| `hooks/usePriceHistory.ts` | Filter chart queries by `status='confirmed'`. |
| `lib/exportContext.ts` | Filter export by `status='confirmed'`. |
| `components/StorePickerSheet.tsx` | Two-input "Add new store" mode; saved-row display shows chain over branch. |
| `app/(tabs)/shop.tsx` | New header CTA row; remove budget pill, progress bar, and "items left" text; any check→uncheck transition in Review mode (whether tapped in the basket or back in the list) also deletes the corresponding pending row; navigate to receipt on CTA tap. |
| `app/shop-receipt.tsx` | New modal route. |
| `app/_layout.tsx` | Register the receipt route. |

---

## Testing

### Migration

- Add a v3→v4 case to `__tests__/lib/db/migrations.test.ts`: pre-seed v3 rows, run migration, assert all rows have `status='confirmed'` and `user_version=4`.
- Fresh-install case: schema includes the column with the default.

### `usePurchaseHistory`

- `addRecord` defaults to `status='pending'`.
- `addRecord({ status: 'confirmed' })` writes `'confirmed'`.
- `deletePending` removes a pending row, leaves confirmed rows alone.
- `updatePending` updates only pending rows.
- `confirmShop` flips all pending rows for the plan to `'confirmed'` AND deletes checked shopping items, in one transaction.
- `getLatestForItem` ignores pending rows.
- `getLatestForBarcode` ignores pending rows.
- `pendingRecords` reflects pending rows for the active plan only.

### Receipt screen

- Renders chain/branch header (branch hidden when empty).
- Total = sum of pending row prices for the plan.
- Swipe-to-remove deletes the pending row AND unchecks the item.
- Tap row opens `ReviewItemSheet` with preloaded data; save updates the pending row in place (no second row created).
- Close button dismisses without committing.
- Confirm performs the transaction, navigates back, and shows no pending rows on return.

### Shop header CTA

- Hidden in Quick mode.
- Hidden in Review mode when no pending rows exist.
- Visible in Review mode with ≥1 pending row; shows correct count and total.
- Tap navigates to the receipt modal.

### Store picker

- New "Add new store" UI captures chain and branch; only chain is required.
- `resolveOrCreateStore` matches on the (chain, branch) tuple and de-dupes correctly.

---

## Out of scope / deferred

- Garbage collection of pending rows from previous plans.
- Editing the chain/branch of an existing saved store from the picker.
- Migrating existing single-string chains into split chain/branch entries.
- "Undo" on Confirm.
