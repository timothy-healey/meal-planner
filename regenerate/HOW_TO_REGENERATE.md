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

Before you build:
1. Search the web for current Woolworths and Coles weekly specials so prices are realistic.
2. Vary the meals from last week — different cuisines, different proteins,
   different vegetables. Keep the cooking style (crockpot Sunday) the same.
3. Ask: "Should I use the same shopping list category order as last week, or would you
   like to change it?" Wait for a response before generating the JSON. The category
   names must stay exactly the same week-to-week if the order is unchanged — the app
   uses exact name matching to preserve Tim's reorder preferences. If a new category
   is needed (e.g. "Supplements"), ask where in the walking order it should appear.
4. Output ONE file: meal_plan.json, conforming to the attached schema.
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

## When to bump the schema version

Stay on schema_version "1.0" until you add real new features to the app
(meal swaps, adherence tracking, freezer state, etc.). When you do:
1. Update `meal_plan.schema.json` to v1.1
2. Update `meal_plan.types.ts` to match
3. Old weeks at v1.0 will still validate against v1.0 — keep both schemas
   if you want to load historical data
