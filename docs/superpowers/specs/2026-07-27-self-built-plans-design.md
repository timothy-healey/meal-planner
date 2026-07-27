# Self-built plans

**Date:** 2026-07-27
**Status:** Spec
**Roadmap:** ⭐ item 1 — "Build a plan in-app from recipes I've already cooked"

## Problem

Every plan is authored by Claude. `transformPlan` reads `plan.shopping_list.categories`
straight out of the imported JSON — names, quantities, categories and prices all
arrive pre-built. There is no way to say "cook these two recipes I already have,
this many serves, give me the shopping list."

## Goal

Pick recipes from the library, set how many serves to produce of each, and get a
shopping list derived from `recipes.ingredients_json`. No day assignment, no
snacks, no per-day structure.

The derived list stays a true projection of the recipes: changing target serves
or editing a recipe's ingredients updates it.

## Decisions

Settled during brainstorming, with the reasoning that produced them.

### Serves means "total serves to produce"

`scale factor = target_serves / recipe.servings`.

This collides with a word already in the UI. The two meanings are opposite and
must not share a component or a label:

| | Where | Ingredients | Per-serve macros |
| --- | --- | --- | --- |
| **Re-divide** | Recipe detail (shipped, `9feb061`) | **static** | change |
| **Scale** | Plan builder (this spec) | **scale** ×`target/servings` | static |

Same pot cut into more portions, versus cooking a bigger pot. The recipe stepper
says *Serves*; the planner says *Make N serves*.

These interact correctly, which is a useful check on the model: re-dividing a
recipe from 4 serves to 6 leaves its ingredients alone but shrinks what a "serve"
means, so a plan wanting 6 serves now needs ×1 rather than ×1.5 — and buys less.
That is right, and it means `updateServings` must trigger re-derivation.

### The list is a live projection

Both target-serves changes and recipe ingredient edits re-derive the affected
lines. Conflict rule: **overwrite unchecked, protect checked.** A line you have
checked off in the aisle is settled and is never rewritten.

### Categories are learned, from a fixed vocabulary

Measured against the sample plan, name-based category inference from history hits
**21 of 45** ingredients (47%) after normalisation — up from 10/45 raw, but still
only half. So the app learns: every category you assign or correct is recorded,
and the hit rate climbs toward 100% over a few plans.

The vocabulary is **owned by the app and fixed**, not read from history. Claude's
category names carry week-specific suffixes (`Pantry (this week)`,
`One-offs (check pantry first)`), and `shop.tsx:90` calls
`applySavedOrder(uncheckedCatNames)`, which matches on exact strings — so the
saved walking order is *already* being lost between imported weeks. A fixed
vocabulary makes it persist for self-built plans.

```
Meat & Poultry · Fresh Produce · Pantry · Dairy & Fridge
Frozen · Drinks · Household · Unsorted
```

`Unsorted` is the catch-all for anything unmatched.

### Sync is eager, at mutation sites

One `derivePlanList(db, planId)`, called from the four places that can invalidate
the projection. Rejected alternatives:

- **Lazy on read** — cannot miss a trigger, but reverts hand edits on every
  navigation and writes to the DB on each screen load. "Overwrite unchecked"
  means *when propagating a change*, not continuously.
- **Never materialise** — theoretically cleanest, but `shopping_items` rows are
  read by the Shop screen, review sheet, receipt flow, purchase history and
  backup, and the review flow writes against shopping-item ids. A virtual-row
  layer through the whole shopping flow is too much for a feature meant to sit
  alongside the existing one.

The stated risk of eager sync is a missed call site. Mitigated by a test per site.

## Data model

### Migration v7

Schema is at v6. Forward-only, keyed on `PRAGMA user_version`.

```sql
ALTER TABLE weekly_plans   ADD COLUMN source      TEXT NOT NULL DEFAULT 'imported';
ALTER TABLE shopping_items ADD COLUMN derived_key TEXT;
ALTER TABLE shopping_items ADD COLUMN derived_qty TEXT;

CREATE TABLE IF NOT EXISTS plan_recipes (
  id            TEXT PRIMARY KEY,
  plan_id       TEXT NOT NULL REFERENCES weekly_plans(id),
  recipe_id     TEXT NOT NULL REFERENCES recipes(id),
  target_serves INTEGER NOT NULL,
  sort_order    INTEGER NOT NULL,
  UNIQUE (plan_id, recipe_id)
);

CREATE TABLE IF NOT EXISTS item_category_map (
  item_key   TEXT PRIMARY KEY,
  category   TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shopping_derived
  ON shopping_items(plan_id, derived_key) WHERE derived_key IS NOT NULL;
```

`weekly_plans.source` is `'imported' | 'self_built'`. Note `recipes.source`
already exists with a *different* vocabulary, `'imported' | 'user'`. The two are
deliberately different and must not be confused.

`derived_key` is the load-bearing addition: it separates rows the projection owns
from rows you added by hand (`NULL`). `is_oneoff` cannot serve this purpose — it
is a category-level flag from Claude's JSON (`cat.is_oneoff`) meaning "check the
pantry first".

`derived_qty` always holds the projection's current answer; `qty` only receives it
when the row is unchecked. So staleness is:

```sql
derived_key IS NOT NULL AND qty IS NOT derived_qty
```

The `derived_key IS NOT NULL` guard is required, not decorative: manual rows have
`derived_qty = NULL` and a non-null `qty`, so testing `qty !== derived_qty` alone
would flag every hand-added item as stale.

`item_category_map.item_key` uses the same key format as the merge key below. For
a **manual** row, which has no `derived_key`, the learned key is
`'name:<normalised(name)>'` — so a category you set on a hand-added item still
applies when a recipe later produces the same item.

### Backup compatibility

`useBackup` hardcodes a column list per table, so all of the following are
required, and each is a silent data-loss bug if missed:

- `plan_recipes` and `item_category_map` added to `exportBackup`'s `Promise.all`
  and payload.
- Both added to `executeRestore`'s `insertRows` calls, in FK order (after
  `weekly_plans` and `recipes`).
- Both added to `executeRestore`'s **`tables` delete list**. This one is the real
  trap: without it, restoring an old backup deletes and replaces every
  `weekly_plans` row while leaving current `plan_recipes` rows untouched —
  dangling references, and FKs are off so nothing catches it.
- `source` appended to the `weekly_plans` column list; `derived_key` and
  `derived_qty` to `shopping_items`.
- `backup_version` bumped to `2.1`. Files at `2.0` must still restore.

**Rule: every new NOT NULL column must carry a DEFAULT.** Old backups have no key
for it, so `insertRows` passes explicit `NULL`. `INSERT OR REPLACE` substitutes
the column default when a NOT NULL column receives NULL — but a NOT NULL column
*without* a default aborts the whole restore transaction. Verified:

```
OR REPLACE, NOT NULL withdef  -> OK, stored 'imported'
OR REPLACE, NOT NULL nodef    -> ABORTS: NOT NULL constraint failed
```

**Harden `insertRows`** so this stops being accidental: omit columns absent from
the source row entirely, letting the schema DEFAULT apply directly rather than
relying on `OR REPLACE`'s NULL substitution. This makes every future column
addition backwards-compatible by construction.

```ts
function insertRows(table: string, rows: any[], cols: string[]) {
  return rows.map((row) => {
    const present = cols.filter((c) => row[c] !== undefined);
    const sql = `INSERT OR REPLACE INTO ${table} (${present.join(',')}) ` +
                `VALUES (${present.map(() => '?').join(',')})`;
    return [sql, present.map((c) => row[c] ?? null)] as [string, any[]];
  });
}
```

A 2.1 backup restored by an older build silently drops the new tables. Acceptable
for a solo app; not guarded.

## Derivation pipeline

```
derivePlanList(db, planId)
  load plan_recipes → recipes
  per recipe:  factor = target_serves / recipe.servings
  per ingredient:
      key    = product_id ? 'product:<id>' : 'name:<normalised(item)>'
      scaled = amount × factor
      → bucket[key]
  per bucket → one line: name, qty, category, note
  diff against stored rows, apply
```

### Merge key

`product_id` is the real merge key. Name-based merging is close to useless here:
recipe ingredient names carry prep instructions and recipe-specific asides
(`Beef chuck or gravy beef, cubed`, `Broccoli (for roast veg)`,
`Boneless skinless chicken thigh fillets (reserve ~400g for wraps)`). Measured on
the sample plan, normalisation collapsed **45 distinct names into 45 groups** —
zero additional merging. It is retained only because it doubles the *category*
lookup hit rate.

**Normalisation:** lowercase → drop parentheticals → take text before the first
comma → strip punctuation → collapse whitespace.

### Scaling

`measured` and `custom` values multiply by the factor. `note` amounts cannot
scale and pass through unchanged.

Guards: `recipe.servings <= 0` forces factor 1 (divide-by-zero);
`target_serves` clamps to ≥ 1.

### Aggregation within a bucket

Group by compatible unit family:

- `g`/`kg` → sum in grams, render as kg at ≥ 1000
- `mL`/`L` → sum in mL, render as L at ≥ 1000
- `unit` → sum
- `custom` → sum **only** on an exact unit-string match (trimmed, lowercased)
- `note` → never sums

Incompatible families within one bucket join with ` + `: `150 g + 2` for "150g
onion" plus "2 onions". Wrong-looking beats wrong.

Note-amounts attach to the line's `note` field rather than spawning duplicate
lines — `Olive oil · 30 mL` with note *to drizzle*. A bucket containing only
notes uses the note text as its `qty`.

### Display name

Product-keyed buckets use `products.item_name` — you curated it. Name-keyed
buckets use the **shortest** raw name in the bucket, since shortest is reliably
the least recipe-specific: `Beef mince` over `Beef mince (lean, for ragu)`.

Ties break on the owning recipe's `sort_order`, then the ingredient's index within
that recipe, so the chosen name is deterministic and does not shuffle between
re-derivations.

### Category assignment

In order: `item_category_map[key]` → historical `shopping_items.category` whose
normalised name matches → `Unsorted`.

`category_order` is the index in the fixed vocabulary; `applySavedOrder` re-sorts
by the user's walking order on top.

**Learning:** `AddItemSheet` already has a category picker and `useShoppingItems.updateItem`
already writes `category`. That is the seam — when `updateItem` changes a row's
category, write `item_category_map`. No new UI.

### The diff

| Stored row | In new projection | Action |
| --- | --- | --- |
| derived, unchecked | yes | UPDATE name / qty / derived_qty / category |
| derived, checked | yes | update `derived_qty` only; leave `qty` (stale if they differ) |
| derived, unchecked | no | DELETE |
| derived, checked | no | keep — it was bought |
| manual (`derived_key IS NULL`) | — | never touched |

### Trigger sites

1. `usePlanRecipes` — add / remove / setServes
2. `useRecipeIngredients` — addIngredient / updateIngredient / deleteIngredient
3. `useRecipes.updateServings` — changes the scale factor's denominator
4. Plan creation

## Modules

The hard logic stays pure and DB-free. `derive.ts` takes data, not a database, so
all the aggregation nastiness is testable without a mock.

| Module | Purity | Responsibility |
| --- | --- | --- |
| `lib/plan/normalise.ts` | pure | name → merge key |
| `lib/plan/aggregate.ts` | pure | scale + sum amounts → `{qty, note}` |
| `lib/plan/categories.ts` | pure | the fixed vocabulary and its order |
| `lib/plan/derive.ts` | pure | `(recipes, planRecipes, categoryLookup) → DerivedLine[]` |
| `lib/plan/applyDerivation.ts` | DB | diff `DerivedLine[]` against stored rows |
| `hooks/usePlanRecipes.ts` | DB | add / remove / setServes, then trigger |

## Surfaces

**Plan tab** branches on `plan.row.source`. Self-built renders the recipe set with
`Make N serves` steppers, `+ Add a recipe`, and a footer summary (total serves,
line count). Imported keeps today's day grid untouched.

**Plan tab, no active plan** — the existing empty state gains **Build a plan**
beside Import.

**Recipe picker** — a modal over the library grouped by meal type; target serves
defaults to `recipe.servings`. `fuse.js` is already a dependency if search is
wanted later.

**Shop tab** — unchanged, except:

- `ShoppingItem.tsx:46` renders `formatPrice(item.estimated_price)`
  unconditionally, so every derived line would read `$0.00`. Guard it to hide at
  zero. This improves imported plans too.
- A staleness marker where `qty !== derived_qty`.

**Prices.** Derived rows get `estimated_price = 0`; Review mode captures real
prices in-store as it already does. There is no budget pill to worry about —
`meta.weekly_budget` is unused in the UI, and the Shop header totals *captured*
prices from `pendingRecords`, not estimates.

### Creating a plan writes valid JSON

`usePlan` runs `JSON.parse` on all four JSON columns unconditionally and they are
`NOT NULL`. A self-built plan must write **valid JSON, not empty strings**:
`days_json: '[]'`, `batch_plan_json: '[]'`, and real default objects for
`meta_json` and `strategy_json`. An empty string throws on load.

`batch_plan_json` stays `[]` — `BatchPlanBanner` already hides conditionally.

Activating a self-built plan sets `is_active = 0` on the previous plan, orphaning
its shopping list. **Confirm first when the outgoing plan has checked items.**

## Edge cases

- `recipe.servings = 0` → factor 1.
- `target_serves` clamps to ≥ 1.
- FKs are not enforced, so deleting a recipe leaves a dangling `plan_recipes` row.
  Derivation skips missing recipes; the Plan tab offers to clear them.
- Removing every recipe deletes unchecked derived rows and keeps checked ones.
- A recipe with no ingredients contributes no lines.
- A bucket whose amounts are all notes uses the note text as `qty`.

## Testing

- **Pure unit tests** carry the bulk: `normalise`, `scaleAmount`, `aggregate`,
  `buildLines`. No DB.
- **One hook test per row of the diff table.**
- **One test per trigger site** — a missed trigger is this approach's stated risk.
- **Migration test** — v6 → v7, existing rows get `source = 'imported'`.
- **Backup round-trip** — restore a `2.0` fixture, assert `source = 'imported'`
  and that no stale `plan_recipes` rows survive the delete list.

## Out of scope

- Prices and budget for self-built plans.
- **Normalising imported plans onto the fixed vocabulary.** This would fix the
  walking-order bug for imported plans too, and is the natural follow-up — but it
  widens the blast radius to the import path.
- Roadmap item 2 (highlighting in-plan recipes). This spec unblocks it by making
  `plan_recipes` the explicit relation it needs; it does not implement it.
- Batch-plan generation for self-built plans.
- GC of orphaned pending purchase rows.
- Per-day meal assignment.
