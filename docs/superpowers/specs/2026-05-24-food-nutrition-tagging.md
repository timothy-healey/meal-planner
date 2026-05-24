# Food Nutrition Tagging & Claude Context Export

## Goal

Allow users to tag nutrition data (cal, protein, carbs, fat) to individual recipe ingredients per brand/product, roll up to recipe-level macro totals, and export purchase history with nutrition as JSON context for Claude meal plan generation.

## Architecture

Two new SQLite tables and a migration. One new hook. Two new components. Updates to `IngredientRow`, `app/recipe/[id].tsx`, and `app/settings.tsx`. A new pure utility for the export.

**Tech stack:** expo-sqlite, React Native, TypeScript, `expo-clipboard` (already installed at ~56.0.3).

---

## Data Model

### `food_nutrition` table

One row per product. Shared across all recipes and plans — survives re-imports.

```sql
CREATE TABLE IF NOT EXISTS food_nutrition (
  id TEXT PRIMARY KEY,
  item_name TEXT NOT NULL,        -- normalised: lowercase trim of ingredient name
  brand TEXT,                     -- null for fresh produce
  product_name TEXT,              -- null for fresh produce
  basis TEXT NOT NULL DEFAULT 'per_100g'
    CHECK (basis IN ('per_100g', 'per_100mL', 'per_unit')),
  cal_per_basis REAL,
  protein_per_basis REAL,
  carbs_per_basis REAL,
  fat_per_basis REAL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_food_nutrition_item_name ON food_nutrition(item_name);
```

### `ingredient_nutrition_link` table

Maps a specific recipe ingredient (by position in its ingredients array) to a `food_nutrition` entry. Stored separately from recipe JSON so it survives recipe re-imports.

```sql
CREATE TABLE IF NOT EXISTS ingredient_nutrition_link (
  recipe_id TEXT NOT NULL,
  ingredient_index INTEGER NOT NULL,
  food_nutrition_id TEXT NOT NULL REFERENCES food_nutrition(id),
  PRIMARY KEY (recipe_id, ingredient_index)
);
```

### Migration

`PRAGMA user_version` incremented to 2. New tables created via `CREATE TABLE IF NOT EXISTS` — safe on fresh install and upgrade.

### Recipe `ingredients_json` — unchanged

The `Ingredient` type (`{ item: string, amount: string }`) is not modified. The import pipeline is unaffected.

---

## Rollup Logic

Ingredient amount strings are parsed to extract a numeric quantity for each basis type:

| Basis | Parses | Example | Multiplier |
|-------|--------|---------|-----------|
| `per_100g` | grams | "200g" → 200, "1kg" → 1000 | `grams / 100` |
| `per_100mL` | millilitres | "250mL" → 250, "1L" → 1000 | `mL / 100` |
| `per_unit` | count | "2 eggs" → 2, "3" → 3 | `count` |

Unparseable amounts return `null` — that ingredient contributes 0 to the total.

**Per-serve calculation:**
```
total_cal = Σ (parsed_qty × cal_per_basis / basis_divisor) for linked ingredients
per_serve_cal = total_cal / recipe.servings
```

**Partial coverage:** if fewer than all ingredients have links, values are prefixed with `~` in the UI to indicate an estimate.

**Fallback:** if no ingredients have links, the recipe header displays stored `calories_per_serve` / `protein_per_serve_g` as before (carbs + fat show nothing).

---

## `useFoodNutrition` Hook

Global — no plan_id dependency.

```typescript
interface FoodNutritionRow {
  id: string;
  item_name: string;
  brand: string | null;
  product_name: string | null;
  basis: 'per_100g' | 'per_100mL' | 'per_unit';
  cal_per_basis: number | null;
  protein_per_basis: number | null;
  carbs_per_basis: number | null;
  fat_per_basis: number | null;
  updated_at: string;
}

interface FoodNutritionData {
  item_name: string;
  brand: string | null;
  product_name: string | null;
  basis: 'per_100g' | 'per_100mL' | 'per_unit';
  cal_per_basis: number | null;
  protein_per_basis: number | null;
  carbs_per_basis: number | null;
  fat_per_basis: number | null;
}

// Returns existing row by id, or null
getById(id: string): Promise<FoodNutritionRow | null>

// Returns first match by normalised item_name (most recently updated), or null
getByName(name: string): Promise<FoodNutritionRow | null>

// Insert (with generateId()) or update (by id). Returns the id.
upsert(data: FoodNutritionData & { id?: string }): Promise<string>

// Write or replace ingredient_nutrition_link row
linkIngredient(recipeId: string, ingredientIndex: number, foodNutritionId: string): Promise<void>

// Return all links for a recipe, keyed by ingredient_index
getLinksForRecipe(recipeId: string): Promise<Record<number, FoodNutritionRow>>
```

---

## Components

### `FoodNutritionSheet`

Bottom sheet, matching existing sheet style (`ReviewItemSheet` as reference).

**Props:**
```typescript
interface Props {
  visible: boolean;
  ingredientName: string;       // display only, not editable
  existingEntry: FoodNutritionRow | null;  // pre-fill if already linked
  onSave: (data: FoodNutritionData) => void;
  onClose: () => void;
}
```

**Layout (from mockup — Option B: compact toggle inline next to name):**

```
┌─ heading row ──────────────────────────────────────────────────────┐
│  Ingredient name  (extrabold, 2xl)    [100g | 100mL | unit]        │
└────────────────────────────────────────────────────────────────────┘
  BRAND input (full width)
  PRODUCT NAME input (full width)
  CALORIES input (full width)
  ┌─ PROTEIN ──┐  ┌─ CARBS ─────┐  ┌─ FAT ───────┐
  └────────────┘  └─────────────┘  └─────────────┘
  [          Done           ]
```

Unit toggle exact style (from mockup — inline, right of name):
```javascript
// heading row
nameRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: spacing[2],
},

// toggle track
unitToggle: {
  flexDirection: 'row',
  backgroundColor: colors.divider,   // #e9eadc — light gray track
  borderRadius: radius.full,
  padding: 2,
  gap: 2,
  flexShrink: 0,
},

// active option
unitOptActive: {
  backgroundColor: colors.card,     // white pill
  borderRadius: radius.full,
  paddingHorizontal: spacing[2] + 1, // ~9px
  paddingVertical: 5,
  // shadow: elevation 1 on Android, shadowOpacity 0.12 iOS
},

// inactive option
unitOpt: {
  borderRadius: radius.full,
  paddingHorizontal: spacing[2] + 1,
  paddingVertical: 5,
},
// active text: weight="bold", size="2xs", color="green"
// inactive text: weight="semibold", size="2xs", color="textTertiary"
// labels: "100g", "100mL", "unit"
```

Pre-fills all fields from `existingEntry` when provided. Unit toggle defaults to `per_100g`.

### `IngredientRow` (updated)

Existing: displays `item` and `amount`, non-tappable.

Updated:
- Becomes a `TouchableOpacity` when `onPress` is provided
- When `nutrition` prop is provided: renders a P / C / F mini-strip beneath the name (three small green-tinted chips showing the **calculated** contribution in grams for this ingredient's amount, not the per-100g values)
- When `onPress` is provided but no `nutrition`: renders a faint "tap to add nutrition" hint beneath the name

**New props:**
```typescript
nutrition?: { protein_g: number; carbs_g: number; fat_g: number } | null;
onPress?: () => void;
```

**Exact layout (from mockup):**

```
┌─ TouchableOpacity (row) paddingVertical: spacing[3], paddingHorizontal: spacing[4] ─┐
│  ┌─ flex:1, gap: spacing[1] ──────────────────────────┐  ┌─ amount ─┐             │
│  │  name  (semibold, md, textPrimary)                  │  │ orange   │             │
│  │  [P 42g] [C 0g] [F 5g]   ← chips, marginTop:4      │  │  bold,md │             │
│  └────────────────────────────────────────────────────┘  └──────────┘             │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

Chip style (`StyleSheet`):
```javascript
macroChip: {
  backgroundColor: '#e8f0ee',   // light green tint — not in tokens, use literal
  borderRadius: 4,
  paddingHorizontal: 6,
  paddingVertical: 1,
},
// text inside chip: size="2xs", weight="semibold", color="textSecondary"
// chip text format: "P 42g", "C 0g", "F 5g"

chipRow: {
  flexDirection: 'row',
  gap: spacing[2],
  marginTop: spacing[1],
},

hintText: {
  // "tap to add nutrition" — size="2xs", color="textTertiary"
  marginTop: spacing[1],
},
```

---

## Screen: `app/recipe/[id].tsx`

**On mount:**
1. Load recipe via `getById`
2. Call `getLinksForRecipe(recipe.id)` → `links: Record<number, FoodNutritionRow>`
3. Parse each ingredient's amount + apply rollup → compute `calculatedMacros` (or null if no links)

**Recipe stats move from body to GreenHeader** (from mockup — Option A: all pills in one row on green background). The existing `inlineStats` row in the body is removed.

GreenHeader gains a pill row below the title, using the same style as `shop.tsx` (`colors.headerPill`, `radius.full`, `spacing[3]`/`spacing[1]` padding):

```javascript
// in headerContent, below the title:
<View style={styles.pillRow}>
  <View style={styles.pill}>
    <AppText weight="bold" size="2xs" color="onGreen">
      {isPartial ? '~' : ''}{Math.round(macros.cal)} kcal
    </AppText>
  </View>
  <View style={styles.pill}>
    <AppText weight="bold" size="2xs" color="onGreen">P {Math.round(macros.protein_g)}g</AppText>
  </View>
  <View style={styles.pill}>
    <AppText weight="bold" size="2xs" color="onGreen">C {Math.round(macros.carbs_g)}g</AppText>
  </View>
  <View style={styles.pill}>
    <AppText weight="bold" size="2xs" color="onGreen">F {Math.round(macros.fat_g)}g</AppText>
  </View>
  <View style={styles.pill}>
    <AppText weight="bold" size="2xs" color="onGreen">Serves {recipe.servings}</AppText>
  </View>
  <View style={styles.pill}>
    <AppText weight="bold" size="2xs" color="onGreen">{timeLabel}</AppText>
  </View>
</View>

// styles:
pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
pill: {
  backgroundColor: colors.headerPill,
  paddingHorizontal: spacing[3],
  paddingVertical: spacing[1],
  borderRadius: radius.full,
},
```

- When `calculatedMacros` is null (no ingredient links): show only the stored `calories_per_serve` + `protein_per_serve_g` + serves + time pills (no C/F pills — same as today but in pill style)
- When partial coverage: prefix cal/protein/carbs/fat values with `~`
- When full coverage: no prefix

**Ingredient list:**
- Each `IngredientRow` receives `onPress={() => openSheet(index)}` and `nutrition` from the rollup map (or null)

**Sheet state:**
```typescript
const [sheetIngredient, setSheetIngredient] = useState<{ index: number; name: string } | null>(null);
```

**On sheet save:**
1. Call `upsert(data)` → get `foodNutritionId`
2. Call `linkIngredient(recipe.id, sheetIngredient.index, foodNutritionId)`
3. Reload links + recalculate macros
4. Close sheet

---

## Export: `lib/exportContext.ts`

Pure function — no hook, no state.

```typescript
export async function buildClaudeContext(db: SQLiteDatabase, planId: string): Promise<string>
```

Steps:
1. Query all `purchase_history` rows for `planId`, plus the plan's `week_starting`
2. For each purchase, resolve nutrition:
   - If `barcode` is non-null: look up `barcode_nutrition` by barcode
   - Else: exact match on `food_nutrition` where `LOWER(TRIM(item_name))` = normalised purchase item_name AND `COALESCE(brand,'')` = `COALESCE(purchase.brand,'')` AND `COALESCE(product_name,'')` = `COALESCE(purchase.product_name,'')` — returns first row if multiple (order by `updated_at DESC`)
3. Assemble and return `JSON.stringify(payload, null, 2)`

Output shape:
```json
{
  "generated_at": "2026-05-24",
  "week_starting": "2026-05-18",
  "purchases": [
    {
      "item": "chicken breast",
      "brand": "Lilydale",
      "product": "RSPCA Chicken Breast",
      "store": "Coles",
      "qty": "600g",
      "price": 12.50,
      "is_sale": false,
      "barcode": "9310075034878",
      "nutrition_basis": "per_100g",
      "nutrition": {
        "calories": 165,
        "protein_g": 31,
        "carbs_g": 0,
        "fat_g": 3.6
      }
    }
  ]
}
```

Purchases with no nutrition match omit the `nutrition` key entirely.

---

## Screen: `app/settings.tsx` (updated)

Adds a **"Copy context for Claude"** button below the existing import button.

On press:
1. Call `buildClaudeContext(db, plan.row.id)` (only enabled when a plan is active)
2. Copy result to clipboard via `Clipboard.setStringAsync()` from `expo-clipboard`
3. Show a brief "Copied!" inline confirmation (replace button label for 2 seconds, then reset)

Button is disabled + visually dimmed when no active plan exists.

---

## Testing

**`lib/parseAmount.ts`** (extracted utility):
- "200g" → `{ grams: 200 }`
- "1.5kg" → `{ grams: 1500 }`
- "250mL" → `{ mL: 250 }`
- "1L" → `{ mL: 1000 }`
- "2 eggs" → `{ units: 2 }`
- "3" → `{ units: 3 }`
- "1 tbsp" → `null` (unparseable)

**Rollup calculation:**
- All ingredients linked → exact totals, no `~`
- Some linked, some not → totals with `~` prefix
- No links → returns null (fallback to stored values)

**`useFoodNutrition`:**
- `upsert` insert: new row created with generated id
- `upsert` update: existing row updated when id provided
- `getByName`: returns row when name matches, null when not found
- `linkIngredient`: inserts and replaces correctly

**`FoodNutritionSheet`:**
- Pre-fills all fields when `existingEntry` provided
- Empty form when `existingEntry` is null

**`lib/exportContext.ts`:**
- Purchase with barcode: resolves from `barcode_nutrition`
- Purchase without barcode: resolves from `food_nutrition` by name
- Purchase with no match: omits `nutrition` key
- Empty purchase history: returns valid JSON with empty `purchases` array
