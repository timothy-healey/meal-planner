---
target: docs/superpowers/specs/2026-05-24-meal-planner-design.md
total_score: 29
p0_count: 0
p1_count: 3
timestamp: 2026-05-23T15-55-42Z
slug: uperpowers-specs-2026-05-24-meal-planner-design-md
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Ticked count + progress bar are live. Import feedback is still "Plan loaded!" inline — no summary of what changed. |
| 2 | Match System / Real World | 3 | "In Basket" language is natural. Slide animation timing on tick (optimistic vs. post-write) is unspecified. |
| 3 | User Control and Freedom | 3.5 | Uncheck from In Basket is good. Category reorder has no undo. Restore backup has no preview. |
| 4 | Consistency and Standards | 3.5 | Tokens are centralised. In Basket header is visually identical to category headers — blurs the distinction. |
| 5 | Error Prevention | 2.5 | Import overwrites active plan with no confirmation. Reorder persists on accidental drag. Restore prompt shows no preview. |
| 6 | Recognition Rather Than Recall | 3 | Clear labels throughout. Long-press reorder and In Basket tap-to-restore have no visible affordance. |
| 7 | Flexibility and Efficiency | 3.5 | Category reorder is a strong power-user feature. No quick re-import, no search, no hide-if-always-stocked option. |
| 8 | Aesthetic and Minimalist Design | 3.5 | Genuinely clean. Inconsistency in header treatment across screens (full green / none / slim) is a minor disruption. |
| 9 | Error Recovery | 1 | Zero onboarding or contextual help. Long-press has no hint text. In Basket has no explanation on first use. |
| 10 | Accessibility | 2 | Tab bar `accessibilityLabel` now specified. Strikethrough-only checked state not announced by screen readers. Long-press has no accessible alternative. |
| **Total** | | **29/40** | **Good — solid foundation, targeted improvements needed** |

---

## Anti-Patterns Verdict

**LLM assessment:** Still no AI slop. The improvements are directionally right — "In Basket" is an earned metaphor (not a generic checkbox pattern), category reorder addresses a real grocery-aisle workflow need, and the budget simplification removes clutter without losing utility. The token-driven typography is disciplined. The design continues to feel considered.

**Deterministic scan:** 12 findings — identical to the previous run. All false positives:
- 5 × side-tab borders in `app-colours.html` and `app-structure.html` (early exploration files, not final design — confirmed clean in approved mockups)
- 6 × Plus Jakarta Sans / Fraunces flagged in `fonts.html` (font comparison slide only; PJS noted as heavily saturated in AI UIs — acknowledged, low stakes for a personal app)

No new anti-patterns introduced by the spec changes.

---

## Overall Impression

Score improved from 25 → 29. The core interactions are now genuinely good — slide-to-basket, row-level tap targets, and category reorder are all better than the average grocery app. What's still missing: the new interaction patterns (long-press, In Basket) are undiscoverable without affordances, and feedback on system actions (import, reorder, restore) is thin. The design is one focused pass away from being ready to build.

---

## What's Working

1. **"In Basket" is a better pattern than in-place strikethrough.** Items slide down rather than fade — the list shrinks as Tim shops. The original category is preserved for restore. This mirrors the physical act of putting something in a basket and being able to put it back on the shelf.

2. **Category reorder is a rare feature done right.** Persisting user preferences across plan imports (by category name) is thoughtful. The migration to v2 aisle tracking is clearly signposted. This alone makes the app more useful than a generic grocery list.

3. **Tokens-first architecture before a line of component code.** Every colour, weight, size, and shadow is named. This pays off in consistency and in future refactors. No screen spec has hardcoded values anymore.

---

## Priority Issues

**[P1] Long-press reorder affordance is invisible — replace with visible drag handles**
- **What:** Spec says "long-press a category header to enter reorder mode." There's no visual hint this is possible — no handle icon, no subtitle, no affordance. Users discover it by accident or never learn it exists.
- **Why it matters:** Tim needs category reorder to match his store's aisle layout. If he doesn't find it, he'll re-tick items out of order every week and find the app frustrating compared to a paper list.
- **Fix:** Add a `≡` drag handle icon on the right of every category header, always visible. Tapping the icon (not long-pressing the whole header) enters reorder mode. This is the standard Android pattern (e.g. settings app reorder, playlist reorder). Remove the long-press trigger — it's a hidden gesture that creates confusion.
- **→ `/impeccable shape`**

**[P1] In Basket section needs one visual distinction from category headers**
- **What:** The In Basket section header uses the same terracotta dot + all-caps label as category headers. A first-time user who taps an item and sees it "disappear" into a visually identical section below has no immediate read on what happened or that the row is tappable to undo.
- **Why it matters:** Mid-shop, Tim might think items are gone rather than ticked. The interaction is reversible but the affordance doesn't signal it.
- **Fix:** Two small changes: (1) use a `✓` icon before "IN BASKET" instead of the terracotta dot, using the `green` colour. (2) add a single line of `textNote`-sized text below the section header: "Tap any item to put it back." These two changes cost one line of spec and remove all confusion.
- **→ `/impeccable clarify`**

**[P1] Import action has no result summary — silent success is a confidence risk**
- **What:** After import, spec shows "Plan loaded!" inline. That's it. Tim doesn't know how many items were imported, whether any recipes were added, or whether the import partially failed.
- **Why it matters:** Tim imports every Sunday. Over weeks, he'll want to know if the new plan replaced the old shopping list correctly. A silent success is fine in v0 but fragile as a weekly ritual.
- **Fix:** Replace "Plan loaded!" with "Plan loaded — 24 items, 5 recipes" (counts from the import). If import fails, show the specific reason: "Missing `shopping_list` key" or "Unknown schema version." Add a "Try again" inline link on failure.
- **→ `/impeccable harden`**

**[P2] Reorder has no undo — accidental drag persists to AsyncStorage**
- **What:** Once a user drags a category to a new position and lifts their finger, the new order is written to AsyncStorage immediately. There's no undo gesture, no "Reset order" button, no discard.
- **Why it matters:** Fat-finger drag during a shop locks in the wrong order until Tim re-opens reorder mode and manually fixes it.
- **Fix:** In reorder mode, show two buttons at the bottom: "Done" (saves) and "Reset" (restores the last saved order or the import order). Don't write to AsyncStorage until "Done" is tapped. This is the same pattern as Android home screen widget rearrangement.
- **→ `/impeccable harden`**

**[P3] Backup restore shows no preview**
- **What:** "This will replace all your data. Continue?" gives no indication of what the backup contains or when it was made.
- **Why it matters:** Infrequent, but if Tim picks the wrong backup file by accident, he loses recent data with no recourse.
- **Fix:** Parse the backup JSON on pick and show: "Backup from 14 May · 47 recipes · 3 plans. Replace current data?" Then offer Cancel and Restore. Costs one extra parse step; eliminates regret scenarios.
- **→ `/impeccable harden`**

---

## Persona Red Flags

**Casey (distracted mobile, one-handed in the aisle):**
- Long-press reorder will never be found. Default category order needs to be excellent out of the box — ideally sorted by common store walk order (produce → dairy → meat → frozen → bakery) as the import default, not alphabetical.
- In a crowded shop, scrolling to In Basket to uncheck a mis-ticked item is a minor pain. A persistent "Undo last tick" button in the header (visible for 5 seconds after each tick, then fades) would be better than requiring a scroll.
- The "Ticked N / T" count is useful but small. A tab bar badge showing remaining items ("12" in a green pill on the Shop tab) would let Casey check progress without opening the screen.

**Tim in the aisle (project-specific):**
- Category reorder prefs survive plan re-imports only when category names match exactly. If Claude generates a plan this week with "Meat & Poultry" and next week with "Meat & Seafood", the preference is silently lost. Tim needs to know this — either in-app ("1 category preference couldn't be matched") or in the HOW_TO_REGENERATE.md for Claude prompts ("keep category names stable across weeks").
- Batch Plan is static reference. The banner says "starts 8:00 am" but Tim is cooking at 9:00 am. There's no "I'm starting now — shift all times" option. Fine for v1, but Tim will need this by week 3. Flag it in the spec as a known gap.

---

## Minor Observations

1. **Progress bar semantics have changed.** Previously it tracked estimated spend. Now it tracks items ticked (N of T). The footer label "N items left" is cleaner — but the two-tone bar (green + orange fill) was designed for a financial metaphor. A single green fill growing left-to-right is simpler for a completion metaphor. Update the mockup if the progress bar style is kept.

2. **Category name stability is a cross-concern.** The spec notes that `category_order_prefs` is applied when names match. This assumption should be documented in `regenerate/HOW_TO_REGENERATE.md` — Claude should be instructed to keep category names consistent week-to-week to preserve Tim's reorder preferences.

3. **Strikethrough accessibility.** In the In Basket section, strikethrough text is announced as plain text by screen readers — the "crossed out" state isn't semantically exposed. React Native's `Text` component doesn't have a built-in `checked` role. Use `accessibilityState={{ checked: true }}` on the row and `accessibilityHint="Double-tap to uncheck"`.

4. **`is_checked` moved to SQLite.** Previous spec stored checkbox state in AsyncStorage. Updated spec stores it in `shopping_items.is_checked`. This is the right call — but the `useShoppingState.ts` hook mentioned in the file structure still implies AsyncStorage. That hook's name and responsibility should be updated.

5. **"Ticked N / T" vs "N / T items".** The word "Ticked" adds 5 characters to a pill that's already sharing space with "Budget $XX.XX". Consider shortening to "✓ N / T" with the checkmark icon. Saves horizontal space, same meaning.

---

## Questions to Consider

1. **Does "In Basket" need to be scrollable?** If Tim has 30 items and ticks 25 of them, the In Basket section is longer than the remaining items list. Should In Basket be collapsible (tap the header to expand/collapse)? Or is a long In Basket section fine — Tim scrolls past it anyway?

2. **What's the right default category order?** The spec uses the JSON array order from the import. But Claude generates that order. Should the HOW_TO_REGENERATE prompt instruct Claude to always generate categories in a standard Woolworths walk-order (produce → dairy → meat → deli → frozen → bakery → pantry → household)? This would make the reorder feature optional rather than essential.

3. **Is the long-press affordance worth keeping at all?** Given that drag handles (≡) are the standard pattern, is there any reason to keep the long-press as a secondary trigger? If removed, the interaction is simpler and more discoverable — but loses the "feels like a power-user trick" quality Tim might enjoy.
