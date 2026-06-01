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
I want to plan next week's meals. Attached:
- meal_plan.schema.json (the structure your final output MUST follow EXACTLY)
- meal_plan.json from last week (for reference — don't repeat the same meals)
- claude_context.json (optional) — a dump of last week's confirmed purchases
  from my app, with `product_id` for items tagged in my catalog

Before generating anything, interview me. Ask ONE question at a time and wait for
my answer. Start with these, in order:

1. Calorie target — total per day, or a per-day breakdown if it should vary
   (e.g. higher on weekends).
2. Protein target — grams per day.
3. Cooking style — batch cooking on Sunday? How many dinners to batch? How
   many nights eating out or leftover-flex?
4. Weekly grocery budget in AUD (including any household items for the week).
5. Anything to vary or repeat from last week — cuisines, proteins, swaps,
   meals to keep.
6. Any new dislikes, allergies, or cravings this week.
7. Shopping list category order — same as last week, or change anything?
   The app uses exact category-name matching to remember reorder preferences,
   so names must stay identical week-to-week unless I explicitly rename one.
   If you need a brand-new category (e.g. "Supplements"), ask where in the
   walking order it should appear.

Stable preferences (assume these unless I say otherwise during the interview):
- Breakfast: overnight oats Mon-Fri, optional Protein Up&Go alongside
- Lunches: burritos / wraps / similar — no rice-heavy or bread-heavy meals
- Carbs: mostly veg + potato
- Fruit: kiwi and berries preferred
- Drinks: include Pepsi Max or Coke No Sugar in the shop
- Store: Woolworths preferred; compare with Coles and only switch if a
  half-price special meaningfully changes the math on a high-cost item
- Region: Adelaide, South Australia
- Units: every `ingredients[*].amount` is an object, one of three kinds:
  - `{ "kind": "measured", "value": number, "unit": "g" | "kg" | "mL" | "L" | "unit" }` for canonical metric or count amounts
  - `{ "kind": "custom", "value": number, "unit": string }` for cooking-speak units like "cloves", "slices", "cans"
  - `{ "kind": "note", "text": string }` for unmeasured items like "to taste" or "a pinch"
  Never use cups, tbsp, tsp, oz, or lb — convert to metric (g or mL) before emitting.

Once the interview is done:
1. Search the web for current Woolworths and Coles weekly specials so prices are realistic.
2. Output ONE file: meal_plan.json, conforming to the attached schema.
   Each recipe must have `method_steps: string[]` — an ordered list of concise
   step strings, not a single prose blob. The old `method` string field is gone.
3. Validate per-day calorie sums match daily_targets (±50 cal tolerance).
4. Set meta.week_starting to the Sunday of the upcoming week.
5. Set shopping_list.priced_at to today's date.
6. Only set `product_id` on an ingredient if you are reusing an exact id from
   one of the attached files (typically `claude_context.json`, matched on
   brand + product name). Never invent, guess, or generate product ids.
   When in doubt, omit the field.

Do not add fields not in the schema. Do not skip required fields.
```

---

## Files to attach each time

1. **`meal_plan.schema.json`** — REQUIRED. Forces structure.
2. **`meal_plan.json`** from the previous week — optional but recommended.
   Lets Claude vary the meals instead of accidentally repeating them.
3. **`claude_context.json`** — optional. In the app, go to Settings → "Copy
   Claude Context" and paste the result as a file/attachment in the chat.
   It lists last week's confirmed purchases with `product_id` for items
   tagged in your catalog, so Claude can reuse those ids on matching
   ingredients in the new plan.

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

The current schema is **v1.3**. Key changes from v1.2:
- `ingredients[*]` may now carry an optional `product_id: string`. When set, it
  links the ingredient to a row in the app's `products` catalog and the macro
  rollup uses that product's nutrition. Omit when unknown — the app skips it.

Key changes from v1.1:
- `ingredients[*].amount: string` → replaced by a tagged union object (`measured` | `custom` | `note`).
  See the Units bullet above for the three valid shapes and examples below.
- v1.1 string amounts are still accepted by the app's import path for backward compatibility — they are
  parsed into the new structure on import. New plans must emit the structured shape.

Examples:
- `{ "item": "Beef chuck, cubed", "amount": { "kind": "measured", "value": 900, "unit": "g" } }`
- `{ "item": "Olive oil",         "amount": { "kind": "measured", "value": 60, "unit": "mL" } }`
- `{ "item": "Garlic",            "amount": { "kind": "custom", "value": 3, "unit": "cloves" } }`
- `{ "item": "Salt",              "amount": { "kind": "note", "text": "to taste" } }`
- `{ "item": "Chicken breast",    "amount": { "kind": "measured", "value": 500, "unit": "g" }, "product_id": "prod_abc123" }`

Key changes from v1.0:
- `method: string` → `method_steps: string[]`. The app renders a numbered list. Always use `method_steps`.
- `method` is still accepted for legacy v1.0 imports.

When adding future features (meal swaps, adherence tracking, freezer state, etc.):
1. Update `meal_plan.schema.json` and bump the version string
2. Update `meal_plan.types.ts` to match
3. Old plans remain importable via the app's backward-compat fallbacks
