# Catalog tab (Piece B)

**Date:** 2026-05-28

## Overview

A new fourth tab — **Catalog** — that surfaces every product the user has ever bought or tagged, unified with its nutrition data and purchase history. Built on top of the [products model refactor](2026-05-28-products-refactor-design.md) (Piece A), which gave us a normalised `products` table with FK relationships from both `purchase_history.product_id` and ingredient JSON's `product_id`.

The tab's primary job is **audit and cleanup**: spot duplicates, fill missing nutrition where it matters, prune unused products. Its secondary job is reference — browse what you've bought, see price trends across brands. A shared product-detail component (introduced here) will eventually drive product-detail views in the Shop review flow and the Recipe ingredient sheet as well; for now, this spec covers only the catalog-tab surface.

## Information architecture

### Tab bar

[app/(tabs)/_layout.tsx](app/(tabs)/_layout.tsx) gains a fourth `Tabs.Screen`:

```tsx
<Tabs.Screen
  name="catalog"
  options={{
    title: 'Catalog',
    tabBarAccessibilityLabel: 'Catalog',
    tabBarIcon: ({ focused, color }) => (
      <Ionicons name={focused ? 'library' : 'library-outline'} size={22} color={color} />
    ),
  }}
/>
```

Position: appended after Recipes (last tab). Rationale: audit/reference is a deliberately-visited maintenance bench, not a daily-driver flow.

### Routes

- `/(tabs)/catalog` — the landing list view (search + audit chips + all products)
- `/catalog/[id]` — push-navigated full-screen product detail (path mirrors `/recipe/[id]`)

## Landing view

[app/(tabs)/catalog.tsx](app/(tabs)/catalog.tsx) (new file).

### Layout

A `GreenHeader` (existing component) titled **Catalog · <N>** where N is total product count. Below the header, a single `ScrollView`/`FlatList` containing:

1. **Search field** — sticky-ish, full-width, pill-shaped (matches existing pill vocab):
   - Placeholder: "Search products"
   - On change, debounce (~200ms) then apply substring filter case-insensitively to `brand`, `product_name`, and `item_name`
   - Tap-to-clear `×` button when populated
2. **Audit chip strip** — single horizontal row of pills:
   - `Missing nutrition · <N>` — only products referenced by at least one recipe ingredient *and* with all four macro columns NULL
   - `Unused · <N>` — products with no `purchase_history` row *and* no recipe `ingredient.product_id` reference
   - `Possible duplicates · <N>` — products in a near-spelling cluster of size ≥ 2 (see "Duplicate detection" below)
   - Tapping a chip activates it (terracotta fill, cream text); tapping again deactivates. Only one chip active at a time.
   - When a chip is active, the "All products" list filters to that chip's set, and the section label updates: e.g. "MISSING NUTRITION · 7".
   - The current search query intersects with the chip filter — both apply together. Chip counts re-compute when search is non-empty.
   - When all counts are 0, the chip strip renders as a single muted line: "Catalog clean — no issues to address."
3. **Section header** — uppercase terracotta label: "ALL PRODUCTS · <N>" (or the active chip's title)
4. **Product rows** — see "Row layout" below
5. **Empty state** (when `products` table is empty and search is also empty):
   - Centered: "No products yet."
   - Subtitle: "Tag an ingredient or log a shop purchase to start your catalog."
   - No CTA buttons — the user gets to products by living the app, not by a "Create product" form.

### Row layout

Each row is a `TouchableOpacity` opening `/catalog/[id]`.

**Clean row** (product has any of: a purchase, a recipe reference, complete nutrition):
- Title (bold, `textPrimary`, single-line ellipsis): `<brand> <product_name>` (e.g. "Coles Chicken Breast Fillets"). For `brand === ''`, show just `product_name` followed by `· generic` in muted terracotta.
- Meta line (12pt, `textTertiary`): `<latest_chain> · <relative_time> · <qty>` from the most recent purchase row joined to stores.
- Tail (right-aligned, orange, 13pt bold): `$<latest_price>` (formatted via `formatPrice`).

**Problem row** — same shape, but:
- Row container has `opacity: 0.7`.
- Meta line replaced with the issue text in muted terracotta (`#744234`, weight 600), prefixed with the ⊘ glyph (or `Ionicons name="alert-circle-outline"` for crispness):
  - "No nutrition on file" (Missing nutrition)
  - "Unused — never purchased or referenced" (Unused)
  - "Looks like a duplicate of *<other product_name>*" (Possible duplicate; italicises the suggested twin)
- Tail replaced with context-relevant text in `textTertiary`:
  - Missing nutrition → "used in N recipes"
  - Unused → "—"
  - Duplicate → "N purchase" or "0 purchases"

**Priority order** when multiple issues apply to the same row:
1. Possible duplicate
2. Missing nutrition
3. Unused

Only one issue line shows.

### Data source

The landing view consumes a new hook `useCatalog()`:

```ts
interface CatalogRow {
  product: ProductRow;
  latest: { price: number; chain: string; purchased_at: string; qty: string } | null;
  purchase_count: number;
  recipe_count: number;
  last_used_at: string;        // COALESCE(MAX(ph.purchased_at), product.updated_at)
  issue: 'duplicate' | 'missing_nutrition' | 'unused' | null;
  duplicate_of?: { id: string; brand: string; product_name: string };  // when issue === 'duplicate'
}

export function useCatalog(): {
  rows: CatalogRow[];        // sorted by last_used_at DESC
  counts: { missingNutrition: number; unused: number; duplicates: number; total: number };
  loading: boolean;
  reload: () => void;
}
```

Implementation (in `hooks/useCatalog.ts`):

1. **Base query** — one SELECT that produces a row per product with the joined aggregates:

   ```sql
   SELECT
     p.*,
     COUNT(DISTINCT ph.id) AS purchase_count,
     MAX(ph.purchased_at) AS latest_purchased_at,
     COALESCE(MAX(ph.purchased_at), p.updated_at) AS last_used_at
   FROM products p
   LEFT JOIN purchase_history ph ON ph.product_id = p.id AND ph.status = 'confirmed'
   GROUP BY p.id
   ```

2. **Latest purchase detail** — for each row in the result, do a second query to fetch the latest purchase's full details (price, chain, qty). Could be done inline with a correlated subquery or via a second batched query keyed by product_id. Pick the batched approach (one extra SELECT, less SQL complexity).

3. **Recipe references** — one SQL query using `json_each`:

   ```sql
   SELECT
     json_extract(ing.value, '$.product_id') AS product_id,
     COUNT(*) AS recipe_count
   FROM recipes r, json_each(r.ingredients_json) ing
   WHERE json_extract(ing.value, '$.product_id') IS NOT NULL
   GROUP BY product_id
   ```

   Build a `Map<product_id, recipe_count>` from the result. The catalog row's `recipe_count` is looked up from this map (0 if absent).

   `expo-sqlite` ships with the JSON1 extension enabled in modern builds; the test suite verifies that `json_each` resolves. If runtime testing reveals the JSON1 extension is missing in some build configuration, swap in a `LIKE '%"product_id":"<id>"%'` fallback in a helper function — but assume `json_each` works by default.

4. **Issue assignment** — done in JS over the joined rows:
   - `issue = 'duplicate'` if the product is in a duplicate cluster (see Duplicate detection)
   - else `issue = 'missing_nutrition'` if all four `*_per_basis` columns are NULL **AND** `recipe_count > 0`
   - else `issue = 'unused'` if `purchase_count === 0` AND `recipe_count === 0`
   - else `issue = null`

5. **Counts** — derived from the assigned issues.

### Duplicate detection

Reuses Fuse.js with the same threshold (0.4) and `ignoreLocation: true` settings as ingredient suggestions ([lib/suggestions/ranking.ts:11-15](lib/suggestions/ranking.ts#L11-L15)). Implementation lives in a new pure helper `lib/catalog/findDuplicates.ts`:

```ts
import Fuse from 'fuse.js';
import type { ProductRow } from '../../types/db';

export interface DuplicateCluster {
  representative: ProductRow;
  members: ProductRow[];       // includes representative; length >= 2
}

export interface DuplicateMatch {
  product: ProductRow;
  twin: ProductRow;            // the other product to surface in the row hint
}

export function findDuplicateMatches(products: ProductRow[]): Map<string, DuplicateMatch> {
  // Group by item_name first — duplicates by definition share the same item.
  const byItemName = groupBy(products, p => p.item_name.trim().toLowerCase());
  const result = new Map<string, DuplicateMatch>();

  for (const group of byItemName.values()) {
    if (group.length < 2) continue;
    const fuse = new Fuse(group, {
      keys: ['product_name'],
      threshold: 0.4,
      ignoreLocation: true,
    });
    for (const product of group) {
      const hits = fuse.search(product.product_name)
        .filter(h => h.item.id !== product.id);
      if (hits.length > 0) {
        result.set(product.id, { product, twin: hits[0].item });
      }
    }
  }
  return result;
}
```

Pure function (no SQLite touch), unit-testable.

### Search behaviour

Substring match, case-insensitive, applied in JS over the loaded rows (since the row count is small — < 200 typically — sub-millisecond filter):

```ts
function matchesSearch(row: CatalogRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const p = row.product;
  return (
    p.brand.toLowerCase().includes(q) ||
    p.product_name.toLowerCase().includes(q) ||
    p.item_name.toLowerCase().includes(q)
  );
}
```

Chip counts re-compute over the same filtered subset, so the active chip's count reflects what's visible *and* matches the search.

## Detail view

[app/catalog/[id].tsx](app/catalog/[id].tsx) (new file).

Push-navigated. Loads the product via `useProducts.getById(id)`. If the lookup returns null, renders a "Product not found" state with a back affordance (mirrors recipe-detail's not-found state).

### Layout

`GreenHeader` with custom header content:
- Top row: `←` back button (left), `⋮` menu button (right; both 44pt tap targets)
- Brand pill below header row: uppercase, 11pt, on a `colors.headerPill` translucent background (same token as the budget/count pills in the existing green-header treatment), e.g. "COLES" (when `brand === ''`, render "GENERIC")
- Product name: 22pt extrabold white, `product_name`, two-line wrap allowed
- Item-name subline: 12pt, muted green tint (`#BFD5C8`), e.g. "chicken breast"

Body (`<ScrollView>`, padding 14): vertically stacked cards.

#### Nutrition card

`<View style={styles.card}>` containing:
- Title row: "NUTRITION" (uppercase terracotta label) on the left, "✎ Edit" link on the right (`textPrimary`, 70% opacity)
- 4-column grid of macro cells: KCAL · PROTEIN · CARBS · FAT
  - Each cell: small uppercase label, large orange value (18pt extrabold), unit suffix
  - When a macro is `NULL`: cell shows "—" instead of a number
- Basis pill below the grid: `per 100g` / `per 100mL` / `per unit` (terracotta tinted)

**Missing-nutrition variant**: when all four macros are NULL, the card's body replaces the grid with:
- Centered prompt: "No nutrition on file"
- CTA button (cream pill on terracotta?): "Add macros"

Tapping ✎ Edit or the "Add macros" CTA opens the existing `IngredientSheet`-style sheet with the product pre-filled. The sheet's save handler calls `useProducts.upsert(...)` and the detail view refreshes via `planVersion` bump (or a local `reloadKey` ref).

#### Purchase History card

Title row: "PURCHASE HISTORY · N" left, "+ Log price" right.

Body:
- `PriceHistoryChart` keyed by `itemName` (the change from this spec) — see "Chart change" section.
- Below the chart, a vertically scrolling list (limited to ~5 visible, "show all" link if more) of the latest purchases for *this specific product* (not the category):
  - Each row: "<relative_time>" + "<chain> · <qty>" subline; tail = `$<price>` in orange. Sale purchases tinted differently or marked with a small orange ring (matches chart sale dots).

"+ Log price" opens an `AddPriceSheet` keyed by this product (already updated for Piece A — passes `productId={product.id}`).

When `purchase_count === 0`, the card body shows an empty state:
- "No purchases yet."
- "+ Log price" remains the CTA in the title row; no chart rendered.

#### Used in N Recipes card

Title row: "USED IN N RECIPES" (when N ≥ 1).

Body: list of recipe rows, each a `TouchableOpacity` pushing `/recipe/[id]`:
- Row: recipe title left, `→` chevron right
- Subtitle (optional): the ingredient's `item` field as it appears in *that recipe* (e.g. "chicken thighs (boneless)"), so the user sees how the product was tagged in context

When N === 0, the entire card is omitted (not even shown as empty — silence is the signal).

### ⋮ menu

Tapping the top-right `⋮` opens an Action Sheet (iOS) / bottom sheet (Android) with three destructive-ish actions:

1. **Rename product** — opens the same edit sheet as ✎ Edit, focused on the brand/product/item-name fields. Saves call `useProducts.upsert(...)` with the new values — if the new `(brand, product_name)` matches an existing product, the user is offered the merge flow instead (see below).
2. **Merge into another product** — opens the merge picker. See "Merge interaction" below.
3. **Delete product** — destructive Alert: "Delete <product>? All references in recipes and purchases will be cleared." On confirm:
   - Recipes: walk `ingredients_json` for any ingredient with `product_id === <this>` and unset that field (preserving the ingredient row, just dropping the nutrition link).
   - Purchase history: `UPDATE purchase_history SET product_id = NULL WHERE product_id = <this>` (purchases survive; they just become unlinked from a product).
   - Products: `DELETE FROM products WHERE id = <this>`.
   - All in a transaction. Pop back to the catalog list.

### Merge interaction

When the user selects **Merge into another product** from the ⋮ menu, a modal sheet opens:

**Header**: "Merge *<source.brand> <source.product_name>* into…"

**Auto-suggested target** (the "fuzzy auto-suggest" of choice 1c): if the catalog finds a fuzzy match within the same `item_name` group, the top of the picker shows it as a highlighted card:

> Suggested match:
> **Coles Chicken Breast Fillets**  ← tap to merge

Below the suggestion, a search field + list of all other products. Default sort: alphabetical by `product_name`. Searching narrows the list. Each row tappable.

When the user taps a target:

**Destructive Alert**:
> Merge "Coles Chicken Breast Fillet" into "Coles Chicken Breast Fillets"? This can't be undone.
> [Cancel] [Merge]

On confirm, a single SQLite transaction runs the following:

1. **Determine winning macros** by these rules in order:
   - `sourceHasMacros` = any of source's four `*_per_basis` columns is non-null.
   - `targetHasMacros` = any of target's four `*_per_basis` columns is non-null.
   - If only one side has macros, use that side's nutrition (basis + four macros).
   - If both sides have macros, use whichever has the more recent `updated_at`.
   - If neither side has macros, no change.
2. When the rule above selects source's macros, `UPDATE products SET basis = ?, cal_per_basis = ?, protein_per_basis = ?, carbs_per_basis = ?, fat_per_basis = ?, updated_at = ? WHERE id = <target.id>`. Otherwise skip this step.
3. `UPDATE purchase_history SET product_id = <target.id> WHERE product_id = <source.id>`.
4. **Discover affected recipes** via:
   ```sql
   SELECT DISTINCT r.id, r.ingredients_json
   FROM recipes r, json_each(r.ingredients_json) ing
   WHERE json_extract(ing.value, '$.product_id') = <source.id>
   ```
   For each returned row: parse `ingredients_json`, walk the array, rewrite any ingredient whose `product_id === <source.id>` to `<target.id>`, `JSON.stringify`, then `UPDATE recipes SET ingredients_json = ? WHERE id = ?`.
5. `DELETE FROM products WHERE id = <source.id>`.
6. `bumpPlanVersion()` to refetch recipes and the catalog.
7. Pop the detail view (the source product no longer exists); land back on the catalog list.

Step 4 is JS-driven inside the transaction rather than pure SQL because `json_replace` over array elements is awkward; reading the JSON, mutating in memory, and writing back is straightforward and works on any SQLite version with JSON1.

## Chart change: category-wide price comparison

Replaces the single-product chart introduced in Piece A. Affects `hooks/usePriceHistory.ts`, `components/PriceHistoryChart.tsx`, and all three callers.

### Hook signature change

```ts
// Before (Piece A):
export function usePriceHistory(productId: string | null): { points: PricePoint[]; reload: () => void };

// After:
export function usePriceHistory(itemName: string | null): { points: ProductPricePoint[]; reload: () => void };
```

`ProductPricePoint` extends the existing shape with brand+product identification:

```ts
export interface ProductPricePoint {
  chain: string;
  purchasedAt: string;
  normalisedPrice: number;
  isOnSale: boolean;
  productId: string;
  brand: string;
  productName: string;
}
```

### SQL

```sql
SELECT ph.*, s.chain, p.id AS product_id, p.brand, p.product_name
FROM purchase_history ph
JOIN stores s ON ph.store_id = s.id
JOIN products p ON p.id = ph.product_id
WHERE LOWER(p.item_name) = LOWER(?)
  AND ph.price IS NOT NULL
  AND ph.qty_amount IS NOT NULL
  AND ph.qty_unit IS NOT NULL
  AND ph.status = 'confirmed'
ORDER BY ph.purchased_at ASC
```

### Chart grouping

`components/PriceHistoryChart.tsx` updates:

- Group points by `(brand, product_name)` rather than by `chain`. Each unique `(brand, product_name)` pair gets a stable color via the existing `getStoreColor(idx)` helper (just renamed semantically — the function itself is index-based and doesn't care what's grouped).
- The legend pills display `<brand> <product_name>` (truncated if too long) instead of `<chain>`.
- The "Best value now" strip surfaces the cheapest `(brand, product)` of the most-recent purchases per group:
  > Best value now
  > **Macro Chicken Breast Tenderloins** 88¢/100g

### Callers

- **Catalog detail** ([app/catalog/[id].tsx]) — passes `itemName={product.item_name}`.
- **Recipe ingredient sheet** ([components/IngredientSheet.tsx]) — currently passes `productId={existingEntry.id}`. Change to `itemName={existingEntry.item_name}`.
- **Shop review sheet** ([components/ReviewItemSheet.tsx]) — currently passes `productId={resolvedProductId}` via the resolve-on-blur effect ([ReviewItemSheet.tsx:84-93](components/ReviewItemSheet.tsx#L84-L93)). Change to pass `itemName={item?.name ?? null}` (the ShoppingItemRow's `name`, which acts as the de-facto item_name for shop purposes). The `resolvedProductId` state becomes unused for the chart and can be removed — the price chart no longer needs a resolved product to render.

### Test updates

- `__tests__/hooks/usePriceHistory.test.ts` — change all `usePriceHistory('p1')` to `usePriceHistory('chicken breast')`. SQL assertion changes from `ph.product_id = ?` to `LOWER(p.item_name) = LOWER(?)`.
- `__tests__/components/IngredientSheet.test.tsx`, `__tests__/components/ReviewItemSheet.test.tsx` — adjust mocks if any assert chart prop shape.

## Tests

### `findDuplicateMatches` (pure helper)

- Two products with identical `(item_name, product_name)` casing → both surface as each other's twin.
- Two products with same `item_name`, near-spelling `product_name` ("Fillets" vs "Fillet") → both surface as twins.
- Two products with same `item_name`, distant `product_name` ("Chicken Breast" vs "Whole Chicken") → no match.
- Products with different `item_name` → never matched even with similar `product_name`.
- Single-member item_name groups → no match.
- Empty input → empty Map.

### `useCatalog`

- Empty products table → `rows: []`, all counts 0.
- Single product with no purchases and no recipe references → `issue = 'unused'`, `counts.unused === 1`.
- Single product with one purchase → `issue = null`, `last_used_at` matches the purchase date.
- Single product referenced by a recipe but no nutrition → `issue = 'missing_nutrition'`.
- Two near-duplicate products with same `item_name` → both rows have `issue = 'duplicate'`, both reference each other as `duplicate_of`.
- `purchase_count` and `recipe_count` aggregate correctly across multiple rows.
- `last_used_at` falls back to `product.updated_at` when there are no purchases.
- Sort order: `rows` descending by `last_used_at`.

### Catalog landing screen (integration)

- Header shows total product count.
- Search field filters rows by substring across brand, product_name, item_name.
- Tapping a chip filters the list and the chip becomes "active" (styled).
- Tapping the active chip again clears the filter.
- Chip counts re-compute when search query is non-empty.
- Problem rows render with the muted issue line and dimmed opacity.
- Empty catalog shows the empty-state copy.
- Tapping any row pushes `/catalog/[id]` with the correct product id.

### Catalog detail screen (integration)

- Header renders brand, product_name, item_name (or "GENERIC" when brand is empty).
- Nutrition card with complete macros renders all four values.
- Nutrition card with all-null macros shows "No nutrition on file" + "Add macros" CTA.
- Tapping ✎ Edit opens the IngredientSheet-style sheet pre-filled.
- Purchase History card with purchases renders the chart and recent list.
- Purchase History card with no purchases shows the empty state and no chart.
- Used-in-N-recipes card omitted when 0 references; shows recipe rows when ≥ 1.
- ⋮ menu opens with Rename / Merge / Delete options.
- Delete with confirmation clears recipe ingredient.product_id and purchase_history.product_id references, then deletes the product row.
- Merge picker auto-suggests the closest twin when one exists.
- Merge transaction updates ingredients_json across affected recipes, re-targets purchase_history rows, deletes source, refreshes the catalog.

### Chart changes

- `usePriceHistory('chicken breast')` queries by `LOWER(p.item_name) = LOWER(?)`.
- Returned points include `brand` and `product_name` per point.
- PriceHistoryChart groups lines by `(brand, product_name)`.
- "Best value now" identifies the cheapest most-recent point per `(brand, product)` group.

## Edge cases

- **Empty `brand`**: rendered as "GENERIC" in the detail header and as "· generic" suffix in the list row. Fuse-based duplicate detection is unaffected (matches on `product_name` within `item_name` groups; brand is independent).
- **Product with no purchases AND no recipe references** is the "unused" case. After Delete it's straightforwardly gone. After Merge it's the source row vanishing.
- **Merge target chosen that is the same as source**: button disabled in the picker; tapping is a no-op (defensive check in the merge handler also rejects).
- **Concurrent merges**: not a concern — single-user, single-threaded JS. The transaction provides DB-level atomicity.
- **JSON1 extension missing**: detected at hook-mount time via a `SELECT json_extract('{"a":1}', '$.a')` probe. If it fails, the recipes-where-used count falls back to a LIKE query. This is unlikely in practice — `expo-sqlite` builds include JSON1.
- **A product appears in *many* recipes**: the detail page's "Used in N Recipes" list renders all of them. No pagination for now; meal-planning practice keeps this < 30 even for staple ingredients.
- **Duplicate detection finds a chain of three near-twins** (A ≈ B ≈ C): each row points to one twin (the highest-ranked Fuse hit). After merging two of them, the remaining row's duplicate flag updates on next refetch. Not "transitively perfect" but good enough for an audit workflow.

## Out of scope

- **Bulk operations** (select multiple → merge all, delete all). Single-row actions only in v1.
- **"Mark as non-food / no nutrition expected"** flag on products. Non-food products simply show "No nutrition on file" with no recipe references → they end up in "Unused" if also unpurchased, otherwise in the clean state since the "Missing nutrition" filter requires a recipe reference.
- **Editing purchase history rows from the detail view.** The list is read-only here; editing pending purchases still happens via the shop-receipt flow.
- **Per-store filtering on the chart.** The legend lets you visually distinguish brands; a "show only Coles" toggle is deferred.
- **Catalog-wide undo for merge / delete.** Backup-restore is the safety net; in-app undo would require an audit log table.
- **The shared product-detail component generalisation** (factoring this view into something the Shop review and Recipe ingredient sheets also consume). This spec builds the catalog-context view; the abstraction comes later when those two flows have concrete UI redesigns in mind. The data shape (`product`, `purchase_count`, `recipe_count`) is intentionally structured to support that future shared component without rework.
