# Ingredient brand & product suggestions

**Date:** 2026-05-27

## Overview

When the user types in the **Brand** or **Product name** fields of the `IngredientSheet`, surface a dropdown of suggestions drawn from previously-logged food data. Product suggestions are scoped by brand once a brand has been entered. Picking a brand fills the brand field; picking a product fills brand + product, and — when nutrition is on file for that product — autofills the entire nutrition card (basis, calories, protein, carbs, fat).

This sits on top of the existing `IngredientSheet` from `2026-05-27-edit-ingredients-design.md`. No new database tables; reads existing `food_nutrition` and `purchase_history` rows.

## User-visible behaviour

### When the dropdown shows

- Only when the **ingredient name field** has ≥1 character (the soft-boost relies on it).
- Only when **Brand** or **Product name** input has focus.
- Hidden on blur, on scroll outside the dropdown, on outside tap, and after a selection.

### Brand field

- Suggests **distinct brand names** drawn from `food_nutrition.brand` ∪ `purchase_history.brand`.
- Each row: brand name (bold, primary) + a subtle secondary line `"{N} products · {latest product} {relative time}"`.
- **No pie-slice emblem** on brand rows — brand alone has no nutrition.
- Tap → fills the Brand input. Focus stays on the field (user can tab/move to Product themselves).

### Product field

- Suggests `(brand, product_name)` pairs.
- If Brand input is non-empty, filter candidates to that exact brand (case-insensitive).
- Each row: product name (primary) + secondary `"{brand} · {relative time}"` when no brand filter; just `"{relative time}"` when filter active.
- Pie-slice emblem (Ionicons `pie-chart`, brand green, 16dp) appears on the right when the candidate has a `food_nutrition` row — signalling "tap to autofill nutrition." Absent emblem = tap fills brand+product text only.
- Tap → fills Brand (if empty) + Product Name; if the candidate has a `food_nutrition` row, also fills basis, calories, protein, carbs, fat from that row and remembers its `food_nutrition.id` for the save (see Persistence).

### Empty query, focus on field

When the field is focused but empty, the dropdown still appears (provided the name field has ≥1 char). Candidates are sorted by item-name match against the ingredient name, then by recency. No fuzzy ranking is performed because there is no query.

### Matching & ranking (typed query)

Fuzzy matching via Fuse.js. The user typing in **Brand** scores against the `brand` field; typing in **Product name** scores against the `productName` field.

Composite score per candidate (lower is better):

```
finalScore = fuseScore
           × (1 − 0.2 × exp(−daysSinceLastUsed / 30))   // recency boost
           × (itemNameMatchesIngredient ? 0.5 : 1.0)    // soft item_name boost
```

Where `itemNameMatchesIngredient` is true when a separate Fuse pass on `(candidate.itemName, currentIngredientName)` returns a score below 0.4.

Results are sorted ascending by `finalScore`, then descending by `lastUsedAt` for ties. Top 5 rendered; no scroll within the dropdown.

### Match highlight

The portion of the rendered primary text matched by Fuse is highlighted using `rgba(232, 123, 58, 0.18)` background, `colors.orange` foreground, `font.family.extrabold`. The matched ranges come from Fuse's `includeMatches: true` output. Empty-query rows have no highlight (there is no query to match).

## Component

A new presentational component `SuggestionDropdown` in [components/SuggestionDropdown.tsx](components/SuggestionDropdown.tsx):

```ts
interface Suggestion {
  kind: 'brand' | 'product';
  brand: string;
  productName: string | null;                // null only on kind='brand'
  productCount?: number;                     // brand rows: how many distinct products
  latestProductName?: string | null;         // brand rows: most-recent product
  lastUsedAt: string;                        // ISO
  foodNutritionId: string | null;            // product rows: present → has nutrition
  matches: { field: 'brand' | 'product'; indices: [number, number][] }[];
}

interface Props {
  suggestions: Suggestion[];
  onPick: (s: Suggestion) => void;
}
```

Rendered inline beneath the focused input (not absolutely positioned), inside the existing `KeyboardAwareScrollView`. Pushes subsequent fields down by ~200dp; the scroll view's existing keyboard-aware behaviour handles bringing the focused input back into view (see Keyboard interaction below).

### Styling

- Container: `marginTop: 6`, `backgroundColor: colors.card`, `borderWidth: 1.5`, `borderColor: colors.divider`, `borderRadius: radius.md`, plus `shadow.card` for elevation.
- Each row: `paddingHorizontal: spacing[3] + 2`, `paddingVertical: 11dp`, `flexDirection: row`, `alignItems: center`, `gap: spacing[3]`, `borderBottomWidth: 1`, `borderBottomColor: colors.divider`. Last row drops the bottom border.
- Primary text: `font.family.bold`, `font.size.md` (13dp), `colors.textPrimary`.
- Secondary text: `font.family.medium`, `font.size.sm` (11dp), `colors.textTertiary`, `marginTop: 2`.
- Pie-slice emblem: width 16, `colors.green`.
- Matched substring inside primary text: see Match highlight above.

## Data hook

A new hook `useIngredientSuggestions` in [hooks/useIngredientSuggestions.ts](hooks/useIngredientSuggestions.ts).

### Public surface

```ts
type Candidate = {
  brand: string;
  productName: string | null;
  itemName: string | null;              // from food_nutrition; null when purchase_history-only
  foodNutritionId: string | null;
  lastUsedAt: string;                   // ISO; max across both source tables
};

type QueryParams = {
  field: 'brand' | 'product';
  text: string;                         // current input text (may be empty)
  ingredientName: string;               // sheet's current name field
  brandFilter?: string;                 // exact-match filter for product field
};

function useIngredientSuggestions(): {
  query: (p: QueryParams) => Promise<Suggestion[]>;
  invalidate: () => void;               // call after a save that mutates food_nutrition
};
```

### SQL

One query, run once per sheet-open and memoised for the sheet's lifetime (invalidated on save):

```sql
SELECT brand, product_name, item_name, id AS food_nutrition_id, updated_at AS last_used_at
FROM food_nutrition
WHERE brand IS NOT NULL AND TRIM(brand) <> ''
UNION ALL
SELECT brand, product_name, NULL AS item_name, NULL AS food_nutrition_id,
       MAX(purchased_at) AS last_used_at
FROM purchase_history
WHERE brand IS NOT NULL AND TRIM(brand) <> ''
GROUP BY brand, product_name
```

### Dedup

In JS, group by `(LOWER(TRIM(brand)), LOWER(TRIM(product_name ?? '')))`. When both source tables produce the same key, the `food_nutrition` row wins: its `id`, `item_name`, and `updated_at` are kept; `lastUsedAt` becomes `MAX(food_nutrition.updated_at, purchase_history.MAX(purchased_at))`.

### Ranking pipeline

Given the deduped candidate list and `QueryParams`:

1. **Brand filter** (product field only): if `brandFilter` is non-empty, drop candidates whose `LOWER(TRIM(brand))` ≠ `LOWER(TRIM(brandFilter))`.
2. **Build target Suggestion list**:
   - When `field === 'brand'`: project candidates down to one entry per distinct brand (case-insensitive), aggregating product count, latest product name, and `MAX(lastUsedAt)`. Each becomes `kind: 'brand'`.
   - When `field === 'product'`: each surviving candidate becomes `kind: 'product'` directly.
3. **Empty query branch** (`text.trim() === ''`):
   - For each target, compute `itemNameMatch` via a Fuse pass against `ingredientName` with `threshold: 0.4` (for product targets, use `candidate.itemName`; for brand targets, use the latest product's item name).
   - Sort by `(itemNameMatch ? 0 : 1) ASC, lastUsedAt DESC`.
   - Return top 5; `matches: []`.
4. **Fuzzy query branch**:
   - Build a Fuse index over the target list with `keys: [field === 'brand' ? 'brand' : 'productName']`, `threshold: 0.4`, `includeMatches: true`, `includeScore: true`, `ignoreLocation: true`.
   - Run `fuse.search(text)`.
   - For each hit, compute `finalScore = result.score × recencyMul × itemNameMul` (formulas above). `daysSinceLastUsed` = `(Date.now() - Date.parse(lastUsedAt)) / 86_400_000`; values below 0 clamp to 0.
   - Sort ascending by `finalScore`, descending by `lastUsedAt` for ties.
   - Return top 5 with `matches` populated from Fuse's `matches` array (only the indices for the active field).

### Caching

The candidate list itself is fetched once on first `query()` call after `invalidate()`. The Fuse index is built lazily on the first non-empty query and stored alongside. Cleared by `invalidate()`. `invalidate()` is called from `IngredientSheet`'s save handler whenever `onSave` returns a nutrition payload.

## Integration into `IngredientSheet`

Three state additions:

```ts
const [brandFocused, setBrandFocused] = useState(false);
const [productFocused, setProductFocused] = useState(false);
const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

// id from a chosen has-nutrition suggestion; null when typed freely
const autofilledFoodNutritionId = useRef<string | null>(existingEntry?.id ?? null);
```

A `useEffect` watches `(brandFocused, productFocused, name, brand, productName)` and calls `query()` with the appropriate params, setting `suggestions`. Debouncing is not added in v1 (see Performance below).

Rendering: `<SuggestionDropdown />` is mounted directly below the `Brand` input when `brandFocused && suggestions.length > 0 && name.trim().length > 0`, and below the `Product name` input under the analogous condition.

### Selection handlers

```ts
function handlePickBrand(s: Suggestion) {
  setBrand(s.brand);
  // do not steal focus; do not autofill nutrition
  setBrandFocused(false);
  setSuggestions([]);
}

async function handlePickProduct(s: Suggestion) {
  if (!brand) setBrand(s.brand);
  setProductName(s.productName ?? '');
  if (s.foodNutritionId) {
    const row = await foodNutrition.getById(s.foodNutritionId);
    if (row) {
      setBasis(row.basis);
      setCal(row.cal_per_basis != null ? String(row.cal_per_basis) : '');
      setProtein(row.protein_per_basis != null ? String(row.protein_per_basis) : '');
      setCarbs(row.carbs_per_basis != null ? String(row.carbs_per_basis) : '');
      setFat(row.fat_per_basis != null ? String(row.fat_per_basis) : '');
      calIsAuto.current = false;
      autofilledFoodNutritionId.current = row.id;
    }
  }
  setProductFocused(false);
  setSuggestions([]);
}
```

### Save semantics & breaking the autofill link

`handleSave` passes the remembered `food_nutrition.id` (from `autofilledFoodNutritionId.current`) into the nutrition payload. The existing `useFoodNutrition.upsert` already accepts an optional `id` and upserts in place — so picking an existing product and tweaking values updates the canonical record. When the id is null, upsert generates a new id as today.

In **add mode**, the ref starts null. It is set to a row id only when the user picks a has-nutrition suggestion. To prevent silently mutating a canonical row after the user has reassigned the ingredient to a different product, the wrapped `onChangeText` for both the Brand and Product Name inputs clears `autofilledFoodNutritionId.current` to null. The next save then creates a fresh row.

In **edit mode**, the ref starts at `existingEntry.id` and the existing behaviour applies — typing into Brand or Product still updates the canonical row, which is how the sheet behaves today. This spec does not change that; suggestions are an additive layer.

Net effect: picking a suggestion is reversible (start typing again to break the link), and the only way a row is mutated is if the user opens the sheet on it directly or picks-then-saves without further edits.

## Keyboard interaction

The `IngredientSheet` already wraps its lower fields in `KeyboardAwareScrollView` from `react-native-keyboard-controller` (per `2026-05-27-keyboard-avoidance-design.md`). KAS scrolls the **focused input** above the keyboard but does not know about content rendered _beneath_ it — so without intervention, the dropdown can render below the keyboard line and be invisible.

Fix: drive KAS's `bottomOffset` prop from the dropdown's measured height.

- Add a `dropdownHeight` state on `IngredientSheet`, defaulting to 0.
- The `SuggestionDropdown` reports its rendered height via `onLayout` to its parent. The parent stores the value.
- KAS receives `bottomOffset={dropdownHeight + spacing[3]}` (the extra `spacing[3]` keeps a small visual gap between the dropdown's bottom edge and the keyboard top).
- When the dropdown unmounts (`suggestions.length === 0` or both fields blur), `dropdownHeight` resets to 0 and `bottomOffset` collapses back to its baseline.

With this, focusing the Brand or Product field triggers KAS to scroll so that the input _plus_ the full dropdown sits above the keyboard. If the combined height exceeds the available viewport (a 5-row dropdown is ~280dp, comfortable even on small screens with the keyboard up), KAS naturally caps scroll at the scroll view's bounds — the user can still scroll manually within the dropdown's bounded area.

No other component changes are needed; the existing `KeyboardProvider` wrap and `KeyboardAvoidingView` behaviour from the keyboard-avoidance work continue unchanged.

## Performance

At the expected scale (single-user app, hundreds of brands at most, low thousands of `(brand, product)` pairs after years of use), the query and Fuse search run comfortably without optimisation:

- SQL UNION ALL + JS dedup of ~3 000 rows: ~50–250ms on first sheet open. Memoised after.
- Fuse search over ~1 500 deduped targets per keystroke: <30ms.

No debouncing in v1. Headroom kicks in around 5 000 distinct `(brand, product)` pairs — at which point the three mitigations from the brainstorm (debounce → SQL prefix filter → FTS5) stack cleanly without touching the UI.

No new SQLite indexes; existing `idx_food_nutrition_item_name` and `idx_purchase_history_item_name` aren't used by this query and a `brand` index wouldn't help a full-scan-and-fuzzy approach.

## Dependencies

Add `fuse.js` (≈12kb gzipped, pure JS, zero native deps) to `package.json`.

## Testing

- **`useIngredientSuggestions` unit tests:**
  - Empty query, with ingredient name → results sorted by item-name match then recency.
  - Typed query with no recency data → ordering matches raw fuse score.
  - Same fuse score, different recency → more recent wins.
  - Item-name boost: candidate with matching `item_name` outranks a similarly-scoring candidate with mismatching `item_name`.
  - Dedup: same `(brand, product_name)` in both tables produces one suggestion with `foodNutritionId` populated.
  - Brand filter on product field: applied case-insensitively; rows from other brands excluded.
  - Brand projection: brand field returns one row per brand with correct `productCount` and `latestProductName`.
  - `invalidate()` clears the cache and the next `query()` re-fetches.
- **`SuggestionDropdown` component tests:**
  - Renders one row per suggestion, max 5.
  - Pie-slice emblem present iff `kind === 'product' && foodNutritionId != null`.
  - Match highlight applied to the indices in `matches`.
  - `onPick` fires the correct suggestion on press.
- **`IngredientSheet` integration tests:**
  - Dropdown hidden when name field is empty, shown after typing 1 char + focusing brand/product.
  - Tapping a brand suggestion fills the brand field; nutrition fields untouched.
  - Tapping a product suggestion with nutrition autofills basis + cal/protein/carbs/fat.
  - Tapping a product suggestion without nutrition fills brand+product text only.
  - Save after autofill writes back to the same `food_nutrition.id`.
  - Add mode: autofill → edit Brand or Product → save creates a fresh row (autofill id cleared).
  - Edit mode: autofill id starts at `existingEntry.id` and is unaffected by editing brand/product (existing behaviour preserved).

## Out of scope

- Suggestions in the ingredient name field itself.
- Suggestions in the unit picker or custom unit input.
- Cross-recipe deduplication of `food_nutrition` rows (two distinct rows for the "same" product remain distinct).
- Server-side or third-party nutrition lookups.
- Editing or deleting a suggestion from the dropdown (the existing nutrition record can still be edited by opening any recipe that links to it).
- Surface for "this product is new — no suggestions"; a hidden dropdown is sufficient signal.
