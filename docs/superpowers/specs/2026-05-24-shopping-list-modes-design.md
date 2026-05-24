# Shopping List Modes

**Date:** 2026-05-24
**Status:** Approved

## Overview

Two shopping modes — Quick (check off, no interruption) and Review (each check-off opens a sheet to log brand, product name, qty, price, and barcode). Purchase history is stored locally per item and used to pre-fill the review sheet on future trips.

---

## Mode Toggle

A Quick / Review segmented pill sits in the header title row, replacing the reorder button's position.

- The title row collapses as the user scrolls, naturally hiding the toggle mid-shop
- Mode is persisted in AsyncStorage keyed to `plan_id` so it survives app restarts
- Switching back to Quick mid-trip is allowed; it stops triggering the review sheet for subsequent check-offs

The reorder icon stays in the title row, to the right of the mode pill (pill + reorder icon sit together on the right side, matching the current layout's right-side reorder button).

---

## Store Selection

Store selection is only relevant in Review mode, since it is stored with purchase history records.

**Trigger:** When the user taps "Review" in the mode toggle, a `StorePickerSheet` slides up before the mode activates.

**Sheet contents:**
- List of previously used stores (name + "last used" date), most recent pre-selected
- "Add new store…" row to type a new store name
- "Start reviewing" confirm button

**After selection:**
- Mode switches to Review
- A location-pin pill (stroke icon) appears next to the week label in the header showing the store name
- Store is locked for the remainder of the trip — no mid-trip changes

**Store persistence:** Store names are saved in AsyncStorage as a simple list. No dedicated DB table needed.

---

## Review Item Sheet

Opens automatically when the user checks off an item while in Review mode. Implemented as `ReviewItemSheet`.

**Fields:**

| Field | Notes |
|---|---|
| Brand | Text input |
| Product name | Text input |
| Qty / size | Decimal number input + unit dropdown (`g`, `kg`, `mL`, `L`, `units`) |
| Price paid | Number input, with an inline Sale toggle |
| Barcode | Text input, with a camera scan button |

**Sale toggle:** Sits inline next to the price field. When active, the toggle track turns orange and the toggle label turns orange. The price field itself stays visually neutral. A small note appears below: "Sale price — baseline stays $X.XX". Sale prices are stored in history but excluded when determining the baseline price for pre-fill.

**Pre-fill behaviour:**
1. On open, fetch the most recent `purchase_history` row where `item_name` matches (case-insensitive). Pre-fill all fields from that record.
2. If no history exists, all fields start blank with placeholder text.
3. A "Last bought DD Mon · $X.XX" badge is shown when pre-filled from history.

**Barcode scan button:** Opens `BarcodeScannerScreen`. On return:
- If the scanned barcode matches a `purchase_history` record, a result card shows the match ("Found in your history") with a "Use" button to fill all fields from that record.
- If no match, the barcode is saved into the barcode field and a "Not in your history yet" message is shown. The user fills the other fields manually.

---

## Barcode Scanner Screen

Full-screen camera view. Implemented as `BarcodeScannerScreen` (a new route or modal).

- Green header matching the app, with a "‹ Cancel" back action
- Dark viewfinder with corner-bracket framing and an orange scan-line
- Hint text below the viewfinder: "Point at the barcode on the product"
- On scan, looks up the barcode in local `purchase_history` only — no external API
- Result card appears below the viewfinder showing the match or no-match state
- Camera library: `expo-camera` with barcode scanning enabled

---

## Database Changes

### Remove from `shopping_items`
- `actual_price REAL`
- `store TEXT`

These columns are currently unused in the UI. Purchase tracking moves entirely to `purchase_history`.

### New table: `purchase_history`

```sql
CREATE TABLE purchase_history (
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
  purchased_at    TEXT NOT NULL  -- ISO 8601 datetime
);

CREATE INDEX idx_purchase_history_item_name ON purchase_history(item_name);
CREATE INDEX idx_purchase_history_barcode   ON purchase_history(barcode);
```

---

## New Hooks

### `useShoppingMode(planId)`
- State: `mode` (`'quick' | 'review'`), `activeStore` (`string | null`)
- Persists to AsyncStorage under key `shopping_mode_<planId>`
- `setMode(mode, store?)` — switching to review requires a store name
- `savedStores` — list of all previously used stores, sorted by recency

### `usePurchaseHistory(planId)`
- `records` — all purchase history for the current plan (for display purposes)
- `addRecord(data)` — inserts a new row, called when the review sheet is saved
- `getLatestForItem(itemName)` — searches across **all plans**, returns most recent non-sale record for pre-fill (falls back to most recent sale record if no non-sale exists)
- `getLatestForBarcode(barcode)` — searches across **all plans**, returns most recent record matching barcode

---

## New Components

| Component | Description |
|---|---|
| `ReviewItemSheet` | Bottom sheet with the review form. Props: `item`, `onSave`, `onClose`, `latestRecord?` |
| `BarcodeScannerScreen` | Full-screen camera. Returns scanned barcode + matched history record (if any) |
| `StorePickerSheet` | Bottom sheet for selecting/creating a store. Props: `stores`, `onConfirm`, `onClose` |

---

## Modified Components

### `shop.tsx`
- Import `useShoppingMode`
- Render mode toggle pill in header title row
- Render store pill when in Review mode
- On item check-off: if Review mode, open `ReviewItemSheet` instead of calling `toggleItem` directly; call `toggleItem` + `addRecord` together on review save

### `SwipeableShoppingItem.tsx`
- No changes to swipe actions (Details view deferred to nutrition spec)

---

## Out of Scope

- Item detail screen (deferred to nutrition/recipe spec)
- External barcode database lookup
- Price history charts or analytics views
- Nutritional data (separate spec)
