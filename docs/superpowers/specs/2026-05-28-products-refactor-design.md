# Products model refactor (Piece A)

**Date:** 2026-05-28

## Overview

This refactor is **Piece A** of a two-part body of work motivated by the upcoming **Catalog tab** (Piece B — separate spec). Piece B is a new tab for browsing every product the user has ever bought, with nutrition and purchase details unified, aimed primarily at audit & cleanup (spot duplicates, fill missing nutrition, edit macros centrally) and secondarily at insights (price trends, recipe usage).

Building that tab on top of the current data model would be painful: nutrition rows are loosely shaped (nullable brand / product), are linked into recipes via a positional `(recipe_id, ingredient_index)` table that requires reindexing on delete, and `purchase_history` carries free-text `brand`/`product_name` columns that drift from the nutrition catalog. This spec replaces that arrangement with a single normalised `products` table that becomes the canonical identity for "a specific thing you might buy" — food or otherwise — and rewires every consumer to reference it by id.

After this lands, the catalog tab can be designed against a clean schema, and a shared product-detail UI can be reused from the Shop, Recipe, and (future) Catalog screens with field-level filtering.

## Data model

### New table: `products`

Replaces `food_nutrition`. One row per `(brand, product_name)` combination; macros are nullable so a non-edible product (cat litter, shampoo) is a row with the macro columns left `NULL`.

```sql
CREATE TABLE IF NOT EXISTS products (
  id                TEXT PRIMARY KEY,
  brand             TEXT NOT NULL,         -- '' (empty string) means generic / unbranded
  product_name      TEXT NOT NULL,
  item_name         TEXT NOT NULL,         -- category-ish label, e.g. "chicken breast", "shampoo"
  basis             TEXT NOT NULL DEFAULT 'per_100g'
                      CHECK (basis IN ('per_100g', 'per_100mL', 'per_unit')),
  cal_per_basis     REAL,
  protein_per_basis REAL,
  carbs_per_basis   REAL,
  fat_per_basis     REAL,
  updated_at        TEXT NOT NULL,
  UNIQUE (brand, product_name)
);

CREATE INDEX IF NOT EXISTS idx_products_item_name ON products(item_name);
```

Notes:

- `brand` uses `''` as the canonical "generic / unbranded" value. SQLite treats `''` as an ordinary value in `UNIQUE`, so `('', 'banana')` and `('Coles', 'banana')` are distinct rows. Suggestions/UI render `brand === ''` as just the bare product name.
- Synthetic `id` is the FK target. The natural identity is still `(brand, product_name)` via `UNIQUE`, which keeps the catalog free of accidental near-duplicates while leaving renames as a one-row `UPDATE` rather than a JSON-blob sweep.
- One table, not two — the `products / product_nutrition` split would only buy a 1:1 join. Nullable macros already model "named but not yet measured."

### Updated table: `purchase_history`

Free-text `brand` and `product_name` columns are removed; `product_id` FK takes their place. `item_name` stays as a free-text label for impromptu / unfiled purchases (where you don't know or didn't capture the brand).

```sql
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

CREATE INDEX IF NOT EXISTS idx_purchase_history_item_name ON purchase_history(item_name);
CREATE INDEX IF NOT EXISTS idx_purchase_history_barcode ON purchase_history(barcode);
```

`product_id` is nullable so an impromptu purchase with only a free-text `item_name` can still be recorded — the user (or a future "tag this purchase" UI) can attach a product later.

### Dropped table: `ingredient_nutrition_link`

Removed entirely. Position-based ingredient-to-nutrition links are replaced by a per-ingredient `product_id` field inside `recipes.ingredients_json` (see next section).

### Updated type: `Ingredient`

`meal_plan.types.ts`:

```ts
export interface Ingredient {
  item: string;
  amount: Amount;
  product_id?: string;
}
```

When `product_id` is set and resolves to a `products` row, the ingredient contributes to macro rollups. When absent (or pointing at a deleted row), the ingredient is silently skipped from the rollup and the rollup is marked `isPartial`. Recipe ingredient JSON shrinks (a single string id) and survives product renames automatically.

### Updated type: `ProductRow` (was `FoodNutritionRow`)

`types/db.ts`:

```ts
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

`PurchaseHistoryRow` drops `brand` and `product_name`; gains `product_id: string | null`.

## Migration strategy

There is **no in-app SQL migration**. The user's deployment constraint is fresh installs only — the upgrade path is "export from old app, install new app, restore." The two pieces of work happen in [hooks/useBackup.ts](hooks/useBackup.ts), not [lib/db/migrations.ts](lib/db/migrations.ts):

1. `SCHEMA_SQL` in [lib/db/schema.ts](lib/db/schema.ts) describes the new shape directly. Fresh installs land on the new schema with no migration step.
2. The restore code in `useBackup.ts` is taught to read both the new (`'2.0'`) and the legacy (`'1.0'`) backup formats.

For hygiene, [lib/db/migrations.ts](lib/db/migrations.ts) gains:

```ts
if (version < 6) {
  await db.execAsync('PRAGMA user_version = 6');
}
```

— purely a version marker. No data changes, no `ALTER TABLE`s.

### Why no in-app migration

Live data on the old install is reachable only via the current `useBackup.ts` export, which today does **not** include `food_nutrition`, `ingredient_nutrition_link`, or `purchase_history` at all ([useBackup.ts:21-46](hooks/useBackup.ts#L21-L46)). Whatever nutrition associations and purchase history exist on the device are already not preserved across reinstalls — Piece A's restore won't make that worse, and from this release on the export will be complete (see "Backup" below).

The lost data is acknowledged: the user will rebuild nutrition tags and purchase history on the new install. This matches the audit/cleanup intent of Piece B anyway — starting clean and tagging products as the catalog gets used.

## Backup

[hooks/useBackup.ts](hooks/useBackup.ts) is brought current. Three problems get fixed at once:

1. `food_nutrition` (now `products`) is missing from export/restore — added.
2. `purchase_history` is missing from export/restore — added.
3. The DELETE list and the `insertRows` list both reference `price_history`, a table dropped in [migrations.ts:31](lib/db/migrations.ts#L31). Today's restore silently fails on a non-existent table and surfaces as "backup may be corrupt." Removed.

### Export

`exportBackup` adds two more `db.getAllAsync` calls and two more keys in the JSON:

```ts
const [recipes, plans, items, purchases, products, barcodeNutrition, barcodeStores,
       stores, aisles, aisleMap] = await Promise.all([
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

`price_history` and any other reference to it removed.

### Restore — both versions

The pre-restore `DELETE FROM` list updates to include `products` and `purchase_history` and drops `price_history`. The order respects FK references (store / product targets get deleted last, repopulated first):

```ts
// DELETE in reverse-FK order
const deleteOrder = [
  'item_aisle_map', 'store_aisles', 'shopping_items', 'purchase_history',
  'barcode_nutrition', 'barcode_stores', 'weekly_plans', 'recipes',
  'products', 'stores',
];
```

`insertRows` calls in dependency-safe order — `stores` and `products` first, then everything that references them:

```ts
const inserts: Array<[string, any[]]> = [
  ...insertRows('stores', backup.stores ?? [],
    ['id','chain','branch','created_at']),
  ...insertRows('products', backup.products ?? [],
    ['id','brand','product_name','item_name','basis',
     'cal_per_basis','protein_per_basis','carbs_per_basis','fat_per_basis','updated_at']),
  ...insertRows('weekly_plans', backup.weekly_plans ?? [], [...]),
  ...insertRows('recipes', backup.recipes ?? [], [...]),
  ...insertRows('shopping_items', backup.shopping_items ?? [], [...]),
  ...insertRows('purchase_history', backup.purchase_history ?? [],
    ['id','plan_id','item_name','store_id','product_id',
     'qty_amount','qty_unit','price','is_sale','barcode','purchased_at','status']),
  ...insertRows('barcode_nutrition', backup.barcode_nutrition ?? [], [...]),
  ...insertRows('barcode_stores', backup.barcode_stores ?? [], [...]),
  ...insertRows('store_aisles', backup.store_aisles ?? [], [...]),
  ...insertRows('item_aisle_map', backup.item_aisle_map ?? [], [...]),
];
```

(Existing column lists for unchanged tables stay as they are.)

### `'1.0'` (legacy) backups — handled by absence

- `backup.products` is `undefined` → `insertRows('products', [], [...])` becomes an empty array. No-op.
- `backup.purchase_history` is `undefined` → same. No-op.
- `backup.recipes[*].ingredients_json` contains pre-`product_id` ingredients (`{ item, amount }`) → restored verbatim; ingredients are simply untagged. Ready to receive `product_id` once the user re-tags them.

No `backup_version` branch is needed in the restore code — the new restore is the union, gracefully handling the absent keys. The `backup_version: '2.0'` bump exists purely to mark forward exports for future debugging.

### Acknowledged data loss

Legacy `purchase_history` and `food_nutrition` rows that exist on the source install but were never in `useBackup.ts`'s export are lost on the transition. This is a one-time event tied to the fresh-install upgrade and is consistent with the user's stated stance ("we should bring the export totally up to date" — going forward, both tables are preserved).

## Hook surface

### `hooks/useProducts.ts` (renamed from `useFoodNutrition.ts`)

```ts
export interface ProductInput {
  brand: string;             // '' allowed
  product_name: string;      // non-empty
  item_name: string;
  basis: 'per_100g' | 'per_100mL' | 'per_unit';
  cal_per_basis: number | null;
  protein_per_basis: number | null;
  carbs_per_basis: number | null;
  fat_per_basis: number | null;
}

export function useProducts() {
  const db = useDb();

  /** Resolve-or-create by (brand, product_name); returns the row's id. Idempotent. */
  const upsert = useCallback(async (input: ProductInput): Promise<string> => { … }, [db]);

  const getById = useCallback(async (id: string): Promise<ProductRow | null> => { … }, [db]);

  const getByKey = useCallback(
    async (brand: string, product_name: string): Promise<ProductRow | null> => { … },
    [db],
  );

  /** Resolve nutrition per ingredient index, keyed off ingredient.product_id. */
  const getNutritionForIngredients = useCallback(
    async (ingredients: Ingredient[]): Promise<Record<number, ProductRow>> => { … },
    [db],
  );

  return { upsert, getById, getByKey, getNutritionForIngredients };
}
```

`upsert` follows the existing `resolveOrCreateStore` pattern in [usePurchaseHistory.ts:22-38](hooks/usePurchaseHistory.ts#L22-L38) — SELECT by natural key, then UPDATE or INSERT:

```ts
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
```

Idempotency holds: same `(brand, product_name)` always returns the same id, even when called concurrently in the same JS tick (sole-user, single-threaded — no real race). The SQLite `UNIQUE(brand, product_name)` constraint is the backstop if an INSERT ever races a SELECT.

`getNutritionForIngredients` — one query, ordered to preserve index mapping:

```ts
const idsByIndex = ingredients
  .map((ing, i) => [i, ing.product_id] as const)
  .filter((pair): pair is [number, string] => typeof pair[1] === 'string');
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
```

Dropped from the old surface: `linkIngredient` (link table gone) and `getLinksForRecipe` (positional indexing gone — `getNutritionForIngredients` replaces it but takes the ingredient list directly).

### `hooks/usePurchaseHistory.ts`

`AddPurchaseData` shape:

```ts
export interface AddPurchaseData {
  plan_id: string | null;
  item_name: string;
  store: string;
  branch?: string;
  product_id: string | null;       // was: brand, product_name
  qty_amount: number | null;
  qty_unit: QtyUnit | null;
  price: number | null;
  is_sale: 0 | 1;
  barcode: string | null;
  purchased_at: string;
}
```

INSERT and UPDATE statements update accordingly (the column lists swap `brand, product_name` for `product_id`).

`getLatestForItem` / `getLatestForBarcode` join `products` and return an enriched row:

```ts
export type PurchaseHistoryRowWithProduct =
  PurchaseHistoryRow & { brand: string | null; product_name: string | null };
```

```sql
SELECT ph.*, p.brand AS brand, p.product_name AS product_name
FROM purchase_history ph
LEFT JOIN products p ON p.id = ph.product_id
WHERE LOWER(ph.item_name) = LOWER(?) AND ph.is_sale = 0 AND ph.status = 'confirmed'
ORDER BY ph.purchased_at DESC LIMIT 1
```

`brand` / `product_name` are `null` when `product_id` is `null` (impromptu purchase).

### `hooks/usePriceHistory.ts`

Signature changes from `(brand, productName)` to `(productId)`:

```ts
export function usePriceHistory(
  productId: string | null,
): { points: PricePoint[]; reload: () => void } { … }
```

Internal SQL:

```sql
SELECT ph.*, s.chain
FROM purchase_history ph
JOIN stores s ON ph.store_id = s.id
WHERE ph.product_id = ?
  AND ph.price IS NOT NULL
  AND ph.qty_amount IS NOT NULL
  AND ph.qty_unit IS NOT NULL
  AND ph.status = 'confirmed'
ORDER BY ph.purchased_at ASC
```

Survives product renames; consistent identity across the join.

### `hooks/useIngredientSuggestions.ts`

UNION collapses to a single `LEFT JOIN`:

```sql
SELECT p.id AS product_id, p.brand, p.product_name, p.item_name,
       CASE WHEN p.cal_per_basis IS NOT NULL OR p.protein_per_basis IS NOT NULL
              OR p.carbs_per_basis IS NOT NULL OR p.fat_per_basis IS NOT NULL
            THEN 1 ELSE 0 END AS has_nutrition,
       COALESCE(MAX(ph.purchased_at), p.updated_at) AS last_used_at
FROM products p
LEFT JOIN purchase_history ph ON ph.product_id = p.id
WHERE p.brand <> ''
GROUP BY p.id
```

`Candidate` and `Suggestion` types (lib/suggestions/types.ts) change:

- `foodNutritionId: string | null` → `productId: string`
- New: `hasNutrition: boolean`

The ranking layer is unaffected — it operates on the `brand` / `product_name` / `item_name` fields, which are unchanged in shape.

### `hooks/useRecipeIngredients.ts`

`deleteIngredient` simplifies — no link table to keep in sync:

```ts
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
```

Exported helper `reindexLinksOnDelete` is deleted along with its unit tests.

### `lib/rollupMacros.ts`

Signature is nominally renamed (`FoodNutritionRow` → `ProductRow`). The function body is unchanged — it still walks ingredients and consults a `Record<number, ProductRow>` map produced by the caller.

## Consumers — file-by-file

### [app/recipe/[id].tsx](app/recipe/[id].tsx)

- Replace `useFoodNutrition` import with `useProducts`.
- The destructure changes:

  ```ts
  const { upsert, getNutritionForIngredients } = useProducts();
  ```

  `linkIngredient` and `getLinksForRecipe` disappear.

- The links-loading effect ([recipe/[id].tsx:44-47](app/recipe/[id].tsx#L44-L47)) re-keys to react to ingredient changes:

  ```ts
  useEffect(() => {
    if (!recipe) { setLinks({}); return; }
    getNutritionForIngredients(recipe.ingredients).then(setLinks);
  }, [recipe?.id, recipe?.ingredients, getNutritionForIngredients]);
  ```

  `linksKey` ref bookkeeping can be removed — `recipe.ingredients` changes naturally on `bumpPlanVersion`.

- `handleSheetSave` ([recipe/[id].tsx:66-93](app/recipe/[id].tsx#L66-L93)) becomes:

  ```ts
  async function handleSheetSave({
    ingredient, nutrition,
  }: { ingredient: Ingredient; nutrition: ProductInput | null }) {
    if (!sheet) return;
    let nextIngredient = ingredient;

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

  The link is now intrinsic to the ingredient row, not a separate write.

### [components/IngredientSheet.tsx](components/IngredientSheet.tsx)

- Replace `getById` from `useFoodNutrition` with `getById` from `useProducts` (same name; the type returned is `ProductRow | null`).
- `autofilledFoodNutritionId` ref ([IngredientSheet.tsx:83](components/IngredientSheet.tsx#L83)) renames to `autofilledProductId`. Semantics unchanged — the captured id is `existingEntry?.id`, where `existingEntry` is the `ProductRow` for the ingredient being edited.
- When the user picks a has-nutrition suggestion (carrying `productId`), the sheet calls `getById(productId)` to prefill macros.
- Outgoing payload to `handleSheetSave` carries `{ ingredient, nutrition }` — the recipe screen handles `upsert` and stamps `product_id` onto the ingredient (single source of truth for the resolve-or-create step).

### [components/ReviewItemSheet.tsx](components/ReviewItemSheet.tsx)

- Local `brand` / `productName` form state stays — that's the user-facing input.
- On save, before constructing `AddPurchaseData`, the sheet calls `useProducts.upsert({ brand, product_name: productName, item_name, basis, … })` to resolve-or-create a product, and stamps the resulting id onto the purchase row.
- The outgoing `AddPurchaseData` carries `product_id` (the id from upsert, or `null` when both brand and product fields are empty).
- The `brand: brand.trim() || null` / `product_name: productName.trim() || null` lines ([ReviewItemSheet.tsx:182-183](components/ReviewItemSheet.tsx#L182-L183)) collapse to the upsert+id flow.

### [components/AddPriceSheet.tsx](components/AddPriceSheet.tsx)

- Same pattern. The sheet's props can keep `brand` / `productName` strings (the parent passes them), but internally `handleSave` calls `useProducts.upsert(…)` first and uses the returned id when inserting the purchase row.

### [components/PriceHistoryChart.tsx](components/PriceHistoryChart.tsx)

- The component's props change: instead of `brand` + `productName`, it accepts `productId: string | null` and passes it through to `usePriceHistory(productId)`.
- Callers (currently `ReviewItemSheet` based on the brand/product strings) pass the resolved `product_id` after upsert — or resolve via `useProducts.getByKey(brand, productName)` for read-only flows that haven't gone through upsert.

### [components/SuggestionDropdown.tsx](components/SuggestionDropdown.tsx)

- Reads `Suggestion.foodNutritionId` today (for the has-nutrition badge). Switch to `Suggestion.hasNutrition` (boolean) and use `Suggestion.productId` when emitting the pick event.

## Tests

### `useProducts`

- `upsert` first call: inserts, returns a fresh id.
- `upsert` second call with the same `(brand, product_name)`: returns the same id; updates macros/item_name/basis/updated_at.
- `upsert` with `brand: ''`: row is created with empty-string brand; subsequent same-key upsert returns same id (verifies SQLite `UNIQUE` treats `''` as a value, not as `NULL`).
- `getById` returns the row by synthetic id; `null` when missing.
- `getByKey` returns the row by `(brand, product_name)`; `null` when missing.
- `getNutritionForIngredients`:
  - empty ingredient list → `{}`.
  - mix of tagged and untagged ingredients → result contains only the indices that resolve.
  - tagged ingredient pointing at a non-existent id → that index is omitted (no crash).
  - preserves the original ingredient indices in the returned record.

### `usePurchaseHistory`

- `addRecord` with `product_id: 'p1'` inserts cleanly; `getLatestForItem` joins and returns `brand` / `product_name` from the products row.
- `addRecord` with `product_id: null` (impromptu purchase) inserts; the joined `brand`/`product_name` come back `null`.
- `getLatestForBarcode` joins and returns enriched fields.

### `usePriceHistory`

- Returns price points filtered by `productId`.
- `null` `productId` → empty array.
- Rows with `price IS NULL` excluded as before.

### `useIngredientSuggestions`

- Product with no purchases → `last_used_at = products.updated_at`.
- Product with purchases → `last_used_at = MAX(purchased_at)`.
- Product with all-null macros → `has_nutrition: false`.
- Product with any non-null macro → `has_nutrition: true`.
- Products with `brand = ''` are excluded (matches the existing brand-required filter intent).

### `useRecipeIngredients`

- `deleteIngredient(recipeId, 1)` on a recipe with three ingredients: ingredients[1] is removed; the remaining two retain their `product_id` values intact.
- The pure helper `reindexLinksOnDelete` and its test file are deleted.

### `useBackup` round-trip

- Export from a populated DB → restore into a fresh DB. Verify `products`, `purchase_history`, and `recipes` (with `product_id` inside ingredient JSON) match row-for-row.
- `backup_version: '2.0'` is written and read.

### `useBackup` legacy restore

- A backup file with `backup_version: '1.0'`, no `products` field, no `purchase_history` field, no `price_history` field, restores without throwing. Post-restore: `products` empty, `purchase_history` empty, `recipes` populated with ingredients lacking `product_id`.
- A legacy backup that *would* have invoked `DELETE FROM price_history` no longer does so (the table reference is gone).

### Recipe screen integration

- Recipe with all ingredients having `product_id` that resolves → rollup shows complete macros, no `~`.
- Recipe with mixed-tagged ingredients → rollup shows `~`-prefixed macros (partial).
- Recipe with no tagged ingredients → no rollup, legacy `cal | P` strip.
- Saving an ingredient from `IngredientSheet` with nutrition data writes a new `products` row, stamps `product_id` on the ingredient, and the rollup updates on next render.
- Deleting an ingredient with `product_id` doesn't affect other ingredients' `product_id` values.

## Edge cases

- **Brand empty-string and `UNIQUE`** — SQLite treats `''` as an ordinary value in unique constraints; `('', 'banana')` and `('Coles', 'banana')` are distinct rows as intended. Confirmed by the upsert test above.
- **Orphan `product_id`** — an ingredient or purchase row referring to a product that has been deleted shows up as un-resolvable. The rollup degrades to partial; the review UI shows the impromptu-purchase state. No FK cascade is enforced (existing schema uses `REFERENCES` documentary-style, no `PRAGMA foreign_keys = ON`).
- **Concurrent upsert** — moot. Sole user, single-threaded JS, and `INSERT … ON CONFLICT … DO UPDATE` is atomic in SQLite.
- **`item_name` divergence between a product and a recipe's `ingredient.item`** — allowed. The recipe's `item` is what the recipe wants to be called; the product's `item_name` is the catalog's label. They can drift, and Piece B's catalog tab can present "the recipe calls this 'chicken'; you classify the product as 'chicken breast'" if useful.
- **Legacy `'1.0'` restore with non-empty `purchase_history` in some hypothetical future backup format** — moot. The current legacy export doesn't include the table at all. No need for `backup_version` branching in restore.

## Forward compatibility (Piece B and beyond)

The shape established here unlocks two follow-ups:

1. **Catalog tab (Piece B).** Each row in the catalog is a `products` row; joins to `purchase_history` give last-purchased / latest-price / store breakdown; a reverse-lookup query across `recipes.ingredients_json` (a single `LIKE '%"product_id":"…"%'` over the JSON blob, or an SQLite `json_each` walk) gives recipes-where-used. Audit affordances ("missing nutrition", "missing brand", "duplicates", "no purchases") are simple `WHERE` clauses on `products`.
2. **Shared product-detail component.** A single React component takes a `productId` and renders the product's identity + macros + purchases + recipes-where-used. The Shop's review flow, the Recipe's ingredient sheet, and the Catalog tab all consume it with field-level filtering (Shop shows purchases beyond the basics; Ingredient shows macros beyond the basics; Catalog shows everything). This component is *not* built in Piece A.

## Out of scope

- The Catalog tab itself (Piece B — separate spec to be written against the post-refactor model).
- A "merge two products" UI. The data model supports it as a one-statement `UPDATE … SET product_id = ? WHERE product_id = ?` across ingredients and purchase_history, plus a `DELETE` on the absorbed row — but the UI lives in Piece B.
- A "rename a product" UI. Single-row `UPDATE products` is the operation; UI follows.
- Enabling `PRAGMA foreign_keys = ON` and decisions about `ON DELETE` cascades. The existing schema uses `REFERENCES` documentary-style across the board; this refactor matches that convention.
- `useCategoryOrder` AsyncStorage persistence — not in the SQLite backup today, still not in the backup after this refactor. Worth its own tiny spec later.
- `barcode_nutrition` table — separate from `products`. The barcode-scan flow caches what a barcode reports; whether it should auto-flow into `products` is a separate ergonomic improvement, not a data-model concern.
- Per-store product variants (e.g. "Coles Chicken Breast Fillets" vs "Woolworths Chicken Breast Fillets" as the same generic) — they remain distinct `products` rows. Grouping them visually is a catalog-tab UI concern.
