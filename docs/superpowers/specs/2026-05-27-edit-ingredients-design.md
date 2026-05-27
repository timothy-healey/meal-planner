# Edit Ingredients

**Date:** 2026-05-27

## Overview

Recipes today are read-only. After cooking, the actual ingredients used can drift from the plan — different brand, different unit, extra clove of garlic, no cumin. The user wants to update each recipe so its final state reflects what was actually used, which also fixes a hidden macro-rollup bug: when the ingredient's amount unit doesn't match the linked nutrition's `basis` (e.g. honey listed as `50 mL` but the label is `per_100g`), the rollup silently zeros for that ingredient.

This spec covers three things, bundled because the storage shape, the in-app edit UI, and the plan-generation schema are facets of the same change:

1. A structured `Amount` shape replacing the freeform `amount: string` on every ingredient.
2. An "edit ingredient" experience built on top of the existing `FoodNutritionSheet` (renamed), plus add and delete affordances on the recipe screen.
3. A bump of `meal_plan.schema.json` to v1.2 and a matching update to the regenerate prompt so new plans output the structured shape directly.

## Data model

`Ingredient.amount` becomes a tagged union of three kinds:

```ts
type Unit = 'g' | 'kg' | 'mL' | 'L' | 'unit';

type Amount =
  | { kind: 'measured'; value: number; unit: Unit }      // standard, plan-canonical
  | { kind: 'custom';   value: number; unit: string }    // value + freeform unit ("cloves", "slices")
  | { kind: 'note';     text: string };                  // unmeasured: "to taste", "a pinch"

interface Ingredient {
  item: string;
  amount: Amount;
}
```

Rationale:

- `measured` is the 95% case and maps cleanly to the nutrition basis (`per_100g` / `per_100mL` / `per_unit`).
- `custom` preserves cooking-speak (`3 cloves garlic`) without lying about the unit. For rollup purposes it behaves like `per_unit`.
- `note` keeps unmeasured items (`"salt to taste"`) representable without forcing a fake number.

Storage stays as a JSON blob in `recipes.ingredients_json` — no SQL migration. Only the inner JSON shape changes.

## Macro rollup behaviour

`rollupMacros` is updated to dispatch on `Amount.kind` instead of calling `parseAmount` on a string. The match rules:

| Amount | Compatible basis | Multiplier |
|---|---|---|
| `measured` `g` / `kg` | `per_100g` | `(value as grams) / 100` |
| `measured` `mL` / `L` | `per_100mL` | `(value as mL) / 100` |
| `measured` `unit` | `per_unit` | `value` |
| `custom { value, unit }` | `per_unit` | `value` (the unit string is display-only) |
| `note` | — | not rolled up (contribution skipped; `isPartial: true`) |

Behaviour for basis-mismatch (e.g. `measured.g` with `per_100mL` nutrition) is unchanged from today — the ingredient contributes zero and `isPartial` flips true, producing the `~` prefix on the per-serve totals. No silent-zero fix is needed once the user edits the amount to the matching unit; that is precisely the workflow this spec enables.

## Sheet redesign — `IngredientSheet`

`FoodNutritionSheet` is renamed `IngredientSheet` and gains an "Ingredient" section above the existing nutrition fields. Same component handles three modes:

| Mode | Triggered by |
|---|---|
| Edit existing | Tap an ingredient row on the recipe screen |
| Add new | Tap the "+ Add ingredient" row at the bottom of the ingredients card |
| Delete | Trash icon in the sheet header → confirm dialog → close + remove |

### New props

```ts
interface Props {
  visible: boolean;
  mode: 'add' | 'edit';
  initialIngredient: Ingredient | null;          // null in add mode
  existingNutrition: FoodNutritionRow | null;    // null when no nutrition linked yet
  onSave: (data: { ingredient: Ingredient; nutrition: FoodNutritionData | null }) => void;
  onDelete?: () => void;                          // edit mode only
  onClose: () => void;
}
```

The existing nutrition save callback collapses into the unified `onSave` — the recipe screen now owns ingredient state and applies both changes atomically (updates `recipes.ingredients_json` and the food_nutrition link table in one transaction).

### Layout (top → bottom)

All tokens from `constants/tokens.ts`. Cream/parchment/divider hex callouts below are for reference; never inline them.

1. **Handle** — unchanged (`36×4`, `radius.full`, `colors.divider`, centered, `marginBottom: spacing[3]`).
2. **Name + trash row** (`flexDirection: row`, `gap: spacing[2]`, `marginBottom: spacing[3]`)
   - **Name input** — flex 1, height 38dp to match the trash square.
     - Background `colors.cream`, border `1.5px colors.divider`, `radius.md` (10px).
     - Padding `10px` vertical / `spacing[3]+2` (14px) horizontal.
     - Type: `font.family.extrabold`, `font.size.xl` (17dp), `colors.textPrimary`.
   - **Trash button** — only rendered in edit mode.
     - `38×38`, `radius.md`, background `colors.cream`, border `1.5px colors.divider`.
     - Ionicons `trash-outline` at 20dp in `colors.terracotta`.
     - On press → `Alert` confirm "Remove {item}?" → `onDelete()`.
3. **Amount + unit row** (`flexDirection: row`, `gap: spacing[2]`, `marginBottom: spacing[3]`).
   - Hidden when the amount is `kind: 'note'` (see "Note rows" below).
   - **Amount input** — fixed width 110dp, `textAlign: right`, `keyboardType: decimal-pad`.
     - Background `colors.cream`, border `1.5px colors.divider`, `radius.md`, padding `10/14`.
     - Type: `font.family.semibold`, `font.size.lg` (15dp), `colors.textPrimary`.
   - **Unit control** — flex 1.
     - Same chrome as the amount input.
     - Displays the current unit label (`grams (g)`, `millilitres (mL)`, …, `Custom…`) and a `chevron-down` Ionicon (11dp, `colors.textTertiary`).
     - On press → opens a small action sheet (RN `ActionSheetIOS`-style modal on Android, native on iOS) with the standard units + `Custom…` at the bottom.
     - Picking a standard unit converts the current numeric value if it makes sense (g↔kg, mL↔L), or leaves it unchanged across category boundaries.
     - Picking `Custom…` swaps the unit display for a small inline text input with placeholder "cloves" and an "× standard" Ionicon button to back out.
4. **Note row** (only when `amount.kind === 'note'`)
   - A single full-width text input (same chrome) prefilled with `amount.text`.
   - A small button row underneath: "Add measurement" — converts the note to a `measured` amount (default `0 g`) so the user can structure it.
5. **Brand** — `FieldLabel` "BRAND" + standard input. (Existing.)
6. **Product name** — `FieldLabel` "PRODUCT NAME" + standard input. (Existing.)
7. **Nutrition basis row** (`flexDirection: row`, `justifyContent: space-between`, `alignItems: center`, `marginTop: spacing[3]`, `marginBottom: spacing[2]`)
   - Left: `AppText weight=bold size=xs color=textTertiary` "NUTRITION PER" with `letterSpacing: font.tracking.caps`.
   - Right: existing basis toggle (`100g / 100mL / unit`), unchanged.
   - The toggle defaults to a basis that matches the current amount unit (`measured g/kg → per_100g`, `measured mL/L → per_100mL`, `measured unit / custom → per_unit`) when the sheet opens in add mode, mirroring today's behaviour.
8. **Calories / Protein / Carbs / Fat** — unchanged from today.
9. **Done button** — unchanged orange CTA (`colors.orange`, `radius.full`, `paddingVertical: spacing[3] + 2`, ExtraBold cream label).

### Standard input chrome (for inputs after the header row)

Match the existing inputs: `colors.cream` background, `1.5px colors.divider` border, `radius.md`, padding `spacing[3]` vertical / `spacing[4]` horizontal, `font.family.semibold` at `font.size.lg` in `colors.textPrimary`.

### Header label

Sheet uses no large title text. The name field IS the title. Mode (add vs edit) is communicated by the field starting empty or pre-filled, and by the trash button being absent in add mode.

## Recipe screen entry points

### Tap to edit

`IngredientRow` already calls `onPress`. Today that opens the nutrition sheet; now it opens `IngredientSheet` in edit mode pre-populated with the ingredient + any linked nutrition. No change to the row itself.

### "+ Add ingredient" row

A new row appended to the ingredients card, below the last `IngredientRow`. Styling:

- Padding `spacing[3] + 2` vertical / `spacing[4]` horizontal.
- Top separator: `1px dashed colors.checkboxBorder` (`#ced0c1`).
- Background: a soft eucalyptus tint — `colors.chipSurface` at 35% opacity, i.e. `rgba(232, 240, 238, 0.35)`. This is a one-off; do not promote to a token.
- Layout: `flexDirection: row`, `alignItems: center`, `gap: spacing[2]`.
- "+" badge: 18×18, `radius.full`, `colors.orange` background, `colors.cream` "+" centered, `font.family.extrabold` at 14dp.
- Label: `AppText weight=bold size=md color=green` "Add ingredient" with `letterSpacing: font.tracking.label`.
- TouchableOpacity with light haptic on press → opens `IngredientSheet` in add mode with empty fields.

### No swipe-to-delete

Deletion lives exclusively inside the sheet. This keeps a single "edit this row" surface and avoids the swipe gesture competing with vertical scrolling on long ingredient lists.

## Persistence

Each ingredient mutation goes through a new `useRecipeIngredients` hook (or an extension to `useRecipes`) that:

1. Reads the current `ingredients_json` for the recipe.
2. Applies the mutation (replace at index, append, splice out).
3. Writes back as a transaction: `UPDATE recipes SET ingredients_json = ? WHERE id = ?` plus, where relevant, the linked-nutrition row update via the existing `useFoodNutrition.upsert + linkIngredient` pair.
4. Bumps `planVersion` so `useRecipes` re-fetches.

Indices in the food-nutrition link table (`food_nutrition_links.ingredient_index`) shift when an ingredient is deleted or inserted mid-list. The mutation hook is responsible for re-indexing links accordingly: deleting index `i` shifts every link with `ingredient_index > i` down by one; inserting at the end is free.

## Plan schema (v1.2)

`meal_plan.schema.json` bumps from v1.1 to v1.2. The only change is the shape of `Ingredient.amount`:

```jsonc
"amount": {
  "oneOf": [
    {
      "type": "object",
      "required": ["kind", "value", "unit"],
      "properties": {
        "kind":  { "const": "measured" },
        "value": { "type": "number", "exclusiveMinimum": 0 },
        "unit":  { "enum": ["g", "kg", "mL", "L", "unit"] }
      },
      "additionalProperties": false
    },
    {
      "type": "object",
      "required": ["kind", "value", "unit"],
      "properties": {
        "kind":  { "const": "custom" },
        "value": { "type": "number", "exclusiveMinimum": 0 },
        "unit":  { "type": "string", "minLength": 1 }
      },
      "additionalProperties": false
    },
    {
      "type": "object",
      "required": ["kind", "text"],
      "properties": {
        "kind": { "const": "note" },
        "text": { "type": "string", "minLength": 1 }
      },
      "additionalProperties": false
    }
  ]
}
```

`meal_plan.types.ts` is updated to mirror this. The app's import path accepts both v1.1 (string `amount`) and v1.2 (object `amount`) by branching on the version field at parse time.

### Regenerate prompt

`regenerate/HOW_TO_REGENERATE.md` is updated so the units paragraph becomes:

> **Units:** every `ingredients[*].amount` is an object. Prefer `{ kind: "measured", value, unit }` with `unit` in `["g","kg","mL","L","unit"]`. Use `{ kind: "custom", value, unit }` for cooking-speak quantities like `cloves`, `slices`, `cans`. Use `{ kind: "note", text }` for unmeasured items like "to taste" or "a pinch". Never use `cup`, `tbsp`, `tsp`, `oz`, `lb` — convert to metric before emitting.

A short examples block is added underneath showing one of each kind.

## Backward compatibility

- Import accepts v1.1 plans (string `amount`) by running each through `parseAmountString` → `Amount` at the import boundary.
- `parseAmountString` extends today's `parseAmount`: numeric parsing identical, then:
  - Recognized metric weight units (`g`, `kg`, `oz`, `lb`/`lbs`) → `measured { unit: 'g' }` after conversion to grams (`oz` × 28.35, `lb` × 453.6).
  - Recognized metric volume units (`mL`, `L`, `cup`, `tbsp`, `tsp`) → `measured { unit: 'mL' }` after conversion (`cup` × 240, `tbsp` × 15, `tsp` × 5).
  - No unit, numeric-only → `measured { unit: 'unit' }`.
  - Number + unknown word(s) → `custom { value, unit: <unknown words joined> }` (e.g. `"3 cloves garlic"` → `custom { value: 3, unit: 'cloves garlic' }`).
  - Anything else (no leading number) → `note { text: <original> }`.
- After import, all in-app reads receive structured data. A defensive check in the read path coerces a leaked string `amount` through `parseAmountString` lazily, then writes back the structured shape on the next save.

## Testing

- `parseAmountString` unit tests: grams, kg, mL, L, oz/lb (legacy import only), fractions, mixed numbers, count-only, unknown unit → custom, unparseable → note.
- `rollupMacros` tests against each `Amount.kind` × each `basis`, including mismatch (zero contribution) and `custom = per_unit` (multiplier = value).
- `IngredientSheet` component tests: add mode (empty), edit mode pre-populated, unit picker (standard → custom → back to standard), delete confirm path, save coalesces ingredient + nutrition.
- Import integration test: feed a v1.1 string-form plan and a v1.2 object-form plan; assert both produce identical structured ingredients after import.
- Recipe-screen test: tap an ingredient → sheet opens with the right values; tap "+ Add ingredient" → sheet opens empty; save → ingredient appears in the list; delete → ingredient disappears and any linked nutrition row's index is consistent.

## Out of scope

- Reordering ingredients (no drag handle).
- Editing other recipe fields (title, servings, prep/cook minutes, method steps).
- Per-user / per-cook ingredient overrides — edits mutate the recipe canonically. The "as cooked" history can be a follow-up if it becomes valuable.
- A migration script that batch-rewrites `recipes.ingredients_json` for already-imported plans. The lazy migration on read + write-back on next save is sufficient for a single-user app.
