# How to Regenerate Your Meal Plan

Each week, paste the prompt below into a fresh Claude conversation along with
`meal_plan.schema.json` and (optionally) the previous week's `meal_plan.json`.

The schema enforces structure. Claude will produce a JSON file that:
- Always has the same shape
- Validates against the schema
- Drops straight into your app with no code changes

---

## The Prompt (copy-paste this)

```
I need a new weekly meal plan. Attached:
- meal_plan.schema.json (the structure I need you to follow EXACTLY)
- meal_plan.json from last week (for reference — don't repeat the same meals)

Constraints:
- Protein target: 140g/day
- Calorie target: 2000 Sun-Thu, 2200 Fri-Sat
- Cooking style: crockpot batch on Sunday, 6 dinners per week (eating out 1-2x)
- Overnight oats Mon-Fri breakfast, optional Protein Up&Go alongside
- Lunches: burritos OR wraps OR similar (no rice or bread-heavy meals)
- Dislikes: rice-heavy meals, bread-heavy meals (burritos and wraps are fine)
- Carbs mostly from veg + potato
- Fruits: kiwi and berries preferred
- Drinks: include Pepsi Max or Coke No Sugar in the shop
- Store: Woolworths preferred (compare with Coles; only switch if a half-price
  special meaningfully changes the math on a high-cost item)
- Budget: ~$140 AUD/week for groceries including some household items
- Region: Adelaide, South Australia
- Units: every `ingredients[*].amount` is an object, one of three kinds:
  - `{ "kind": "measured", "value": number, "unit": "g" | "kg" | "mL" | "L" | "unit" }` for canonical metric or count amounts
  - `{ "kind": "custom", "value": number, "unit": string }` for cooking-speak units like "cloves", "slices", "cans"
  - `{ "kind": "note", "text": string }` for unmeasured items like "to taste" or "a pinch"
  Never use cups, tbsp, tsp, oz, or lb — convert to metric (g or mL) before emitting.

Before you build:
1. Search the web for current Woolworths and Coles weekly specials so prices are realistic.
2. Vary the meals from last week — different cuisines, different proteins,
   different vegetables. Keep the cooking style (crockpot Sunday) the same.
3. Ask: "Should I use the same shopping list category order as last week, or would you
   like to change it?" Wait for a response before generating the JSON. The category
   names must stay exactly the same week-to-week if the order is unchanged — the app
   uses exact name matching to preserve Tim's reorder preferences. If a new category
   is needed (e.g. "Supplements"), ask where in the walking order it should appear.
4. Output ONE file: meal_plan.json, conforming to the attached schema (v1.1).
   Each recipe must have `method_steps: string[]` — an ordered list of concise
   step strings, not a single prose blob. The old `method` string field is gone.
5. Validate per-day calorie sums match daily_targets (±50 cal tolerance).
6. Set meta.week_starting to the Sunday of the upcoming week.
7. Set shopping_list.priced_at to today's date.

Do not add fields not in the schema. Do not skip required fields.
```

---

## Files to attach each time

1. **`meal_plan.schema.json`** — REQUIRED. Forces structure.
2. **`meal_plan.json`** from the previous week — optional but recommended.
   Lets Claude vary the meals instead of accidentally repeating them.

---

## Validating the output

Before you import the new JSON into your app, run a quick check. Two easy options:

**Option A: ask Claude in the same session**
> "Validate the JSON you just produced against meal_plan.schema.json and show any errors."

**Option B: do it locally (one command)**
```bash
# Install once
npm i -g ajv-cli

# Validate
ajv validate -s meal_plan.schema.json -d meal_plan.json --spec=draft2020
```

If it validates, your app will work. If it doesn't, paste the errors back into
the same Claude session and ask for a fix.

---

## Category name stability

The app lets Tim reorder shopping categories to match his store's aisle layout. That preference is stored by **exact category name**. If a category name changes between weeks (e.g. "Meat & Poultry" → "Meat & Seafood"), the saved order for that category is silently lost and it reverts to import order.

**Rule:** keep category names identical week-to-week unless Tim explicitly asks to rename one. If a genuinely new category is added, ask Tim where it fits in his walking order before generating the JSON.

---

## Schema version

The current schema is **v1.2**. Key changes from v1.1:
- `ingredients[*].amount: string` → replaced by a tagged union object (`measured` | `custom` | `note`).
  See the Units bullet above for the three valid shapes and examples below.
- v1.1 string amounts are still accepted by the app's import path for backward compatibility — they are
  parsed into the new structure on import. New plans must emit the structured shape.

Examples:
- `{ "item": "Beef chuck, cubed", "amount": { "kind": "measured", "value": 900, "unit": "g" } }`
- `{ "item": "Olive oil",         "amount": { "kind": "measured", "value": 60, "unit": "mL" } }`
- `{ "item": "Garlic",            "amount": { "kind": "custom", "value": 3, "unit": "cloves" } }`
- `{ "item": "Salt",              "amount": { "kind": "note", "text": "to taste" } }`

Key changes from v1.0:
- `method: string` → `method_steps: string[]`. The app renders a numbered list. Always use `method_steps`.
- `method` is still accepted for legacy v1.0 imports.

When adding future features (meal swaps, adherence tracking, freezer state, etc.):
1. Update `meal_plan.schema.json` and bump the version string
2. Update `meal_plan.types.ts` to match
3. Old plans remain importable via the app's backward-compat fallbacks
