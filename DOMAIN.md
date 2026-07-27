# DOMAIN.md

## Product
A personal meal-planning and grocery app for one. Plans are authored by Claude and
imported; the app runs the week from there — shop the list in-store, capture real
prices, cook, and tag nutrition against a growing product catalog.

## Stack
TypeScript · React Native 0.85 / Expo SDK 56 · expo-router · expo-sqlite (10 tables,
`PRAGMA user_version` 6, forward-only migrations) · AsyncStorage (aisle-walking order,
backup folder) · Jest + @testing-library/react-native.

## Bounded contexts
- **Planning** — what we're cooking, and where the plan came from. Owns `weekly_plans`
  and (proposed) `plan_recipes`. A single row is active at a time.
- **Recipes** — the cookbook. Owns `recipes`: ingredients, method steps, servings, notes.
- **Shopping** — the list and the trip through the aisles. Owns `shopping_items`, plus
  where you shop and the order you walk it: `stores`, `store_aisles`, `item_aisle_map`,
  `barcode_stores`, and the AsyncStorage category order.
- **Purchasing** — what was actually bought and for how much. Owns `purchase_history`.
- **Catalog** — product identity and nutrition facts. Owns `products`, `barcode_nutrition`.

## Domain experts
- **Home cook** — speaks for *Recipes, Planning* · the person batch-cooking on a Sunday
  - vocabulary & rules: serves, batch, prep/cook minutes, method steps. Ingredient names
    carry prep instructions — *cubed*, *shredded*, *reserve ~400g for wraps*. A recipe's
    ingredients are sized for its `servings`. **Re-dividing** a pot changes per-serve
    macros and leaves ingredients alone; **scaling** for a batch changes ingredients and
    leaves per-serve macros alone. Same word, opposite behaviour.
- **Grocery shopper** — speaks for *Shopping* · in the aisle, phone in one hand
  - vocabulary & rules: line, category, aisle order, checked, basket, one-off. Names are
    *buying units*, not recipe units — "Beef chuck/gravy beef (for stew)", not "Beef
    chuck or gravy beef, cubed". Category order follows the physical walk and is learned
    per store. A checked item is settled and should not be rewritten underneath you.
- **Nutrition tracker** — speaks for *Catalog, Purchasing* · tagging products, watching prices
  - vocabulary & rules: product = `brand` + `product_name`, unique on that pair;
    `item_name` is the loose link back to an ingredient. Nutrition is held *per basis*
    (`per_100g` / `per_100mL` / `per_unit`) and scaled by the amount used. Calories derive
    from macros via Atwater (4/4/9). A purchase records store, price, sale flag, barcode.

All three are hats worn by the same solo operator, who is canon on every domain question.

## Lens
default: strategic · critique · workshop

## Focus
Planning — the self-built plans spec
(`docs/superpowers/specs/2026-07-27-self-built-plans-design.md`).

## Ubiquitous language
Not yet written. Run `/ddd-council language <context>` to produce
`docs/ubiquitous-language.md`.

## Detector
No `ddd-council.json`. The `detect` engine supports Rust only; this is a TypeScript
repo, so the council reads the code directly rather than running the detector.
