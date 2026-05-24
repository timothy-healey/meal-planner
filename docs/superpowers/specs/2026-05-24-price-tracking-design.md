# Price Tracking

## Overview

Display a normalised price history chart at the bottom of the brand + food detail screen (`FoodNutritionSheet`). One line per store chain over time. Sale events are marked with an orange ring. Users can log historical price observations (without a full purchase) via an "Add price" bottom sheet.

---

## Data Model

### Migration changes

1. **Drop `price_history` table** — unused, replaced by the approach below.

2. **Add `store_id` FK to `purchase_history`** — replace the free-text `store TEXT` column with `store_id INTEGER REFERENCES stores(id)`. Migration: for each existing row, match `store` text to `stores.chain` (case-insensitive); create a new `stores` row if no match exists. Then drop the old `store` column.

3. No `is_purchase` flag needed — all rows in `purchase_history` are purchases, including those backfilled from receipts via the "Add price" sheet.

### Normalised price

Computed at query time — never stored:

```
normalised = price / qty_amount * 100   (when qty_unit = 'g' or 'mL')
normalised = price                       (when qty_unit = 'unit')
```

Units in ¢ (i.e. multiply by 100 so values are readable whole numbers on the axis).

### Hook

```ts
// hooks/usePriceHistory.ts
interface PricePoint {
  chain: string;
  purchasedAt: string;   // ISO date string
  normalisedPrice: number; // ¢ per 100g/mL, or total price in ¢ for unit items
  isOnSale: boolean;
}

function usePriceHistory(brand: string, productName: string): PricePoint[]
```

Query: `SELECT ph.*, s.chain FROM purchase_history ph JOIN stores s ON ph.store_id = s.id WHERE ph.brand = ? AND ph.product_name = ? ORDER BY ph.purchased_at ASC`

---

## Chart Component

**File:** `components/PriceHistoryChart.tsx`

### Visual structure

```
┌─────────────────────────────────────────┐
│  [3M]  [6M●]  [1Y]  [All]    [Total|/100g●] │  ← toolbar
│                                         │
│  60¢ ┤·····················            │
│  50¢ ┤·····················            │  ← SVG chart area
│  40¢ ┤─────●─────●─────●──            │
│  30¢ ┤                  ◎             │  ← sale ring dips DOWN
│  20¢ └──────────────────────           │
│      Nov   Dec   Jan   Feb   Mar        │
│                                         │
│  Best value now        Woolworths 37¢/100g │  ← summary strip
│                                         │
│  ● Woolworths  ● Coles  ● ALDI  ◎ Sale              │  ← legend
└─────────────────────────────────────────┘
```

### Design tokens used

All values reference `constants/tokens.ts` — no hardcoded colours or sizes.

| Element | Token |
|---|---|
| Card background | `colors.card` |
| Grid lines | `colors.divider` (0.8px, dashed) |
| Axis text | `colors.textTertiary`, `font.size.sm` (11sp), `font.family.semibold` |
| Section dot | `colors.terracotta`, 7px circle |
| Section title | `colors.terracotta`, `font.size.sm`, `font.family.bold`, uppercase, `font.tracking.category` |
| "+ Add price" | `colors.green`, `font.size.sm`, `font.family.bold` |
| Time tab (active) | `colors.chipSurface` background, `colors.green` text |
| Unit toggle (active) | `colors.card` background, `colors.green` text, green shadow |
| Sale ring | `colors.orange`, 2px stroke, radius = dot radius + 3 |
| Best value label | `colors.textSecondary` |
| Best value amount | `colors.orange`, `font.family.extrabold` |
| Best value strip bg | `colors.cream` |
| Legend pills bg | `colors.cream` |
| Sale legend pill bg | `#FEF0E6` (orange-tinted cream) |
| Card border radius | `radius.md` (10) |
| Sheet border radius | `radius.lg` (16) top corners only |

### Store line colours

Derived from the brand palette — not arbitrary. Assign in chain-name sort order to keep colours stable across sessions:

| Index | Hex | Origin |
|---|---|---|
| 0 | `#2A7A66` | Lightened `colors.green` |
| 1 | `#B8513C` | Lightened `colors.terracotta` |
| 2 | `#7090B8` | Complementary dusty blue |
| 3+ | Repeat with reduced opacity | — |

### Chart rendering rules

- **Y axis**: bottom = 20¢, top = max observed price rounded up to next 10¢ tick. Always at least 5 ticks.
- **X axis**: month labels (`MMM`), spaced evenly across the selected time range.
- **Line**: 2px stroke, `round` line join and cap.
- **Dot**: 3.5px radius filled circle (same colour as line).
- **Sparse line**: fewer than 3 data points for a chain → dashed line (`strokeDasharray="5,3"`), reduced opacity (0.8).
- **Sale dot**: rendered at its actual normalised price on the Y axis (lower = cheaper = correct). Two dashed arms connect it to the adjacent regular-price dots on either side — drawn as separate `<line>` elements with `strokeDasharray="3,2"`. The sale dot itself gets the orange ring.
- **No tooltip or annotation on the chart** — the ring is the only sale indicator; no labels or badges overlaid on data points.

### Time range

Default: 6M. Options: 3M, 6M, 1Y, All. Filters `PricePoint[]` by `purchasedAt` before rendering.

### Unit toggle

Default: `/100g`. `Total` shows raw price in $ (no normalisation). Toggle state is local to the component, not persisted.

### Best value strip

Shows the chain with the lowest normalised price among the **most recent data point per chain** within the selected time range. Format: `[Chain name]  [value]¢/100g` (or `$[value]` in Total mode). Uses `colors.orange` for the value, `colors.textSecondary` for the label. Strip background: `colors.cream`, `radius.sm` (5), padding `spacing[2]` vertical `spacing[3]` horizontal.

### Empty state

When `usePriceHistory` returns an empty array, render a plain text message inside the card:

> No price data yet.  
> Prices are recorded when you log a purchase.

`colors.textTertiary`, `font.size.sm`, centred, `spacing[10]` vertical padding.

---

## "Add Price" Sheet

**Opened by:** tapping "+ Add price" in the section header.

**Fields:**

| Field | Type | Default | Notes |
|---|---|---|---|
| Store | Radio list | Last used store, else first chain alphabetically | Lists all `stores.chain` values; "Add new store…" row creates a new chain entry |
| Price | Numeric input | — | Required |
| Qty | Text input | Last used qty for this product, else `1 kg` | e.g. `500 g`, `2 L`, `1 unit` |
| Date | Date picker | Today | Editable — allows historical backfill |
| Sale price | Toggle | Off | Sets `is_sale = 1` on the saved row. |

**Save behaviour:** inserts into `purchase_history` as a regular purchase row, then dismisses the sheet and refreshes the chart.

**Sheet style:** matches existing `ReviewItemSheet` — bottom sheet, `radius.lg` top corners, `colors.card` background, drag handle, `font.size.xl` title, green pill save button.

---

## Integration

### FoodNutritionSheet

Add the `PriceHistoryChart` section directly below the nutrition card. The section header (terracotta dot + "PRICE HISTORY" title + "+ Add price" action) sits between the nutrition card and the chart card, matching the visual style of other section headers in the app (same as used in ShoppingList category headers).

The sheet already scrolls, so no layout changes are needed to accommodate the additional content.

### Charting library

Use `react-native-svg` (add via `npx expo install react-native-svg`). Render the chart as a custom SVG — no third-party charting library. This keeps the bundle small and gives exact control over the visual style documented above.

---

## Out of Scope

- Barcode-linked price history (chart is keyed on `brand + product_name`, not barcode)
- Price alerts or notifications
- Syncing prices across devices
- Bulk historical import
- Editing or deleting existing price entries
