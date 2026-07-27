---
id: vet-self-built-plans-2026-07-27
target: docs/superpowers/specs/2026-07-27-self-built-plans-design.md
verb: vet
lens: strategic · vet · workshop
date: 2026-07-27
---

# Vet — self-built plans

Pre-build gate on the self-built plans spec. DDD soundness only: boundaries,
language, and *Refactor before you add*. Decomposition, testability and sequencing
are out of scope — upstream skills own those.

Signals from `reference/signals/E-design-stage.md` (§E).

**Summary.** The spec is coherent and unusually well-evidenced, and it already
handles the trap the council would otherwise have raised first — the two opposite
meanings of "serves". Six findings, two of them high. F1 and F2 are concrete
defects rather than stylistic concerns. F3 is the structural fix that makes F1
tractable rather than a list of call sites to remember.

---

### F1 [high] cross-boundary-dependency — Catalog mutations invalidate the projection but aren't trigger sites

**What.** The merge key is `'product:<id>'` when an ingredient is tagged. Catalog
owns product identity and mutates it freely, but the spec's trigger list names only
Planning and Recipes.

**Cited.** Spec § *Derivation pipeline → Trigger sites* (four sites listed) and
§ *Merge key*. Code: `hooks/useProducts.ts:133` `mergeProduct` rewrites
`product_id` inside `recipes.ingredients_json` and deletes the source product;
`hooks/useProducts.ts:107` `deleteProduct` strips `product_id` from ingredients;
`app/catalog/[id].tsx:83` exposes rename, which changes `products.item_name` — the
spec's display name for product-keyed buckets.

**Why it matters.** Three distinct failures:

- **Duplicate lines.** Merge A→B while a line keyed `product:A` is *checked*. The
  diff keeps checked rows absent from the projection ("it was bought"), and the
  next derivation emits `product:B`. Two lines for one item, permanently.
- **Silent staleness.** For an unchecked line, no derivation runs at all until an
  unrelated trigger fires, so the list quietly disagrees with the recipes.
- **Stale display names.** A Catalog rename leaves the old name on the line.

Merging duplicate products is the Catalog tab's core purpose, so this is a normal
path, not an edge case.

**Suggested amendment.** Adopt F3 first, then make Catalog responsible for
announcing key changes, rather than adding three more call sites to a list Planning
has to maintain. If F3 is declined, add `mergeProduct`, `deleteProduct` and rename
to the trigger list explicitly, and add the merge-a-checked-line case to the diff
test matrix.

**Status:** resolved — amended in the spec

---

### F2 [high] contradicts-domain — category learning fires on imported plans, poisoning the fixed vocabulary

**What.** The learning seam is `useShoppingItems.updateItem`, which is
plan-agnostic. Correcting a category on an *imported* plan writes Claude's
week-suffixed name into `item_category_map`, which a later self-built plan then
applies.

**Cited.** Spec § *Category assignment* ("when `updateItem` changes a row's
category, write `item_category_map`. No new UI.") against § *Categories are learned,
from a fixed vocabulary*. Code: `hooks/useShoppingItems.ts:107` — `updateItem` has
no notion of plan source.

**Why it matters.** It defeats the section directly above it. The fixed vocabulary
exists because Claude emits `Pantry (this week)` and `One-offs (check pantry first)`,
and `app/(tabs)/shop.tsx:90` matches category names as exact strings. Learning from
imported plans reintroduces exactly those names into self-built plans — the drift
the vocabulary was chosen to prevent, arriving through the feature meant to fix it.

**Suggested amendment.** Either (a) only learn when the row's plan is
`self_built`, or (b) map the assigned name onto the fixed vocabulary before storing,
discarding unmappable names. (b) is strictly better if the out-of-scope
"normalise imported plans" follow-up is ever taken, since it builds the mapping
this spec already needs.

**Status:** resolved — amended in the spec

---

### F3 [medium] unowned-shared-type — the merge-key format spans three contexts with no owner

**What.** `'product:<id>' | 'name:<normalised>'` is an ad-hoc string encoding
depended on by Planning (`derive.ts`), Shopping (`shopping_items.derived_key`,
`item_category_map.item_key`) and Catalog (which defines half of it). No module owns
the format.

**Cited.** Spec § *Merge key*, § *Data model* (`derived_key`,
`item_category_map.item_key`), § *Modules* (`lib/plan/normalise.ts` — Planning owns
the normaliser).

**Why it matters.** An accidental shared kernel, designed in. Planning owns a string
format that Shopping persists and Catalog can invalidate — which is precisely why F1
is invisible in the spec as written. Nothing in the design has standing to say
"this key just changed".

**Suggested amendment.** Promote it to a named value object, `ItemKey`, **owned by
Catalog**. The concept is "a thing you might buy" — Catalog's product identity,
degraded to a normalised name when untagged. Surface: `ItemKey.fromIngredient()`,
`ItemKey.fromName()`, `parse`/`toString`. Dependency direction stays clean: Catalog
upstream, Planning and Shopping downstream. This is a refactor of a concept the spec
already has, not new surface area.

**Status:** resolved — amended in the spec

---

### F4 [medium] adds-where-refactor-fits — a third writer into `shopping_items`

**What.** `applyDerivation.ts` becomes the third module inserting into
`shopping_items`, each with its own column list and `category_order` rule.

**Cited.** Spec § *Modules* (`lib/plan/applyDerivation.ts`). Code:
`hooks/useImport.ts:98` (inline INSERT) and `hooks/useShoppingItems.ts:65`
(`addItem` INSERT) — already duplicated before this spec adds a third.

**Why it matters.** *Refactor before you add.* Shopping's ordering rules —
`category_order`, `item_order` — must agree across all three or the list sorts
inconsistently depending on how a row arrived. Three copies is three chances to
diverge.

**Suggested amendment.** Extract Shopping's write surface first (one module owning
`shopping_items` inserts and the ordering rules), then route Import, Derivation and
manual add through it. This is existing-code cleanup that must land *before* the
feature — the operator should run `remediate` separately; `vet` does not feed it.

**Status:** resolved — amended in the spec

---

### F5 [low] off-language-naming — `derived_key` / `derived_qty` are mechanism names, and one value has two names

**What.** No domain expert says "derived". The shopper's distinction is *from the
plan* versus *added by hand* — provenance. And `derived_qty` specifically means
"what the plan currently calls for".

**Cited.** Spec § *Migration v7*. Note also the internal inconsistency: the same
value is `shopping_items.derived_key` in one table and `item_category_map.item_key`
in another.

**Why it matters.** *The language lives in the code.* These names are permanent, and
one concept under two names is how a ubiquitous language starts to rot.

**Suggested amendment.** `derived_qty` → `planned_qty` (Planning's answer, which is
what it is). `derived_key` → `item_key`, matching `item_category_map` and the F3
value object. The staleness test reads better too:
`item_key IS NOT NULL AND qty IS NOT planned_qty`.

**Status:** resolved — amended in the spec

---

### F6 [low] off-language-naming — `source` values diverge between two columns of the same name

**What.** `weekly_plans.source` is `'imported' | 'self_built'`; `recipes.source` is
`'imported' | 'user'`.

**Cited.** Spec § *Migration v7*, which documents the divergence deliberately.

**Why it matters.** Different bounded contexts may legitimately use a term
differently, and the spec says so — this is within the law. The residual risk is
narrow: `'imported'` means the same in both while the second value differs, so a
wrong literal type-checks fine as a bare string.

**Suggested amendment.** Accept as documented, but give each a named union type
(`PlanSource`, `RecipeSource`) so the compiler catches a crossed literal. No schema
change.

**Status:** resolved — amended in the spec

---

## Not findings

Recorded so they aren't re-litigated:

- **The two meanings of "serves"** — the spec names the collision explicitly, keeps
  the components separate, and verifies the interaction (re-dividing a recipe
  correctly reduces what a plan buys). This is the spec's strongest section.
- **`derive.ts` pure / `applyDerivation.ts` impure** — these co-change, but it is a
  deliberate purity seam for testability, not a split of cohesive work.
- **Eager over lazy sync** — a tradeoff the operator settled with reasons recorded.
  Not a boundary concern.
