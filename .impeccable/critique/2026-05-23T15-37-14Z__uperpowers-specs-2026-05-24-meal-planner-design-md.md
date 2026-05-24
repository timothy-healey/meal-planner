---
target: docs/superpowers/specs/2026-05-24-meal-planner-design.md
total_score: 25
p0_count: 2
p1_count: 2
timestamp: 2026-05-23T15-37-14Z
slug: uperpowers-specs-2026-05-24-meal-planner-design-md
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Budget header + checkbox count are live. Import error messaging is underspecified ("inline error" — where, for how long?). |
| 2 | Match System / Real World | 3 | Natural grocery and cooking language throughout. Time display logic (≥60 min → "Nh") isn't obvious at first glance. |
| 3 | User Control and Freedom | 2 | No undo for accidental checkbox ticks. No bulk reset during a shop. No "preview what's being replaced" before restore. |
| 4 | Consistency and Standards | 3 | Token system is strong; patterns repeat cleanly. Minor: Settings accessed from Plan header only — inconsistent with how users expect settings to live. |
| 5 | Error Prevention | 2 | Restore backup warns inline but doesn't show what's being lost. Import only validates `schema_version` + required keys — no field-level validation. |
| 6 | Recognition Rather Than Recall | 3 | Visible categories, labeled tabs, batch plan banner. `(check pantry first)` note inline is good. Back link is too subtle for recognition. |
| 7 | Flexibility and Efficiency | 2 | No swipe-to-tick, no bulk actions, no search in recipe library, no quick-add for repeat pantry staples. |
| 8 | Aesthetic and Minimalist Design | 4 | Genuinely clean. Stripped headers on Recipes/Plan. Every element earns its place. Two-tone progress bar > percentages. |
| 9 | Error Recovery | 2 | "Copied!" flash is good. Import failure and clipboard permission errors have no recovery path specified. Checkbox has no undo. |
| 10 | Help and Documentation | 1 | Zero onboarding. No first-run guidance. No in-app help. First import failure leaves Tim stranded. |
| **Total** | | **25/40** | **Acceptable — significant improvements needed** |

---

## Anti-Patterns Verdict

**LLM assessment:** Not AI slop. The design is genuinely considered for Tim's specific context — grocery aisle, one-handed, offline-first. The colour system has semantic meaning (green = control, terracotta = categories/amounts, orange = money). The overspend state uses colour shift rather than a red alert, which is a real design decision. The iteration evidence (tags removed, headers stripped, overspend variant explored) shows the design evolved rather than being generated. No side-stripe cards, no gradient text, no hero-metric clichés in the final mockups.

**Deterministic scan:** 12 findings across the mockup HTML files.
- **5 × side-tab accent borders** — in `app-colours.html` (line 110, 123) and `app-structure.html` (lines 84, 99, 113, 128). All false positives: these are old early-exploration files, not the final design. The approved mockups (`layout-refresh.html`, `recipes-clean.html`, `recipes-plan-v2.html`) contain none.
- **6 × overused font (Plus Jakarta Sans / Fraunces)** — `fonts.html` lines 268–290. These were font *comparison* slides. The scan correctly identifies that Plus Jakarta Sans is heavily saturated in AI-generated UIs. Worth noting for a commercial product; lower risk for a personal app. Fraunces hits were option B (not chosen).

**Verdict on font flag:** Plus Jakarta Sans is genuinely common in the AI-UI wave. The detector is right that it lacks distinctiveness. For a personal app used by one person this is low stakes, but it's an honest call worth holding onto.

---

## Overall Impression

A focused, well-reasoned spec for a single-user tool. The happy path — open app, tick off groceries, reference a recipe — is clean and warm. The design falls short at friction points: what happens when the import fails, when Tim ticks the wrong item, when the budget is blown. The emotional design is strong on the peaks (ticking items, copying a recipe) and weak on the recoveries. The token architecture is excellent and will make implementation fast. The biggest single gap is that there's no onboarding at all — first launch is a blank Shop tab with an import button and no guidance.

---

## What's Working

1. **Colour semantics are genuinely meaningful.** Green = authority/checkmarks, terracotta = categories/quantities, orange = money. This isn't decoration — it mirrors how Tim processes a shopping list. The overspend state reuses the terracotta already associated with "amounts" rather than introducing alarming red.

2. **Restraint in chrome.** No headers on Recipes/Plan tabs. No 3-dot menus. No breadcrumbs. Bottom tabs carry all navigation. The app trusts Tim's mental model rather than adding scaffolding he doesn't need.

3. **Token system before a line of code is written.** `constants/tokens.ts` with `as const` exports gives every future component a single source of truth. The shadow uses `colors.green` as `shadowColor` — a warmer tint than pure black. This level of specificity pays dividends across the whole app.

---

## Priority Issues

**[P0] Onboarding and first-run flow are completely absent**
- **What:** First launch opens to an empty Shop tab with "[📂 Import meal plan]". No guidance on where the file comes from, what happens after import, or what to do if it fails. Settings (the only way to restore data) is hidden in the Plan tab header.
- **Why it matters:** Tim's entire data lifecycle — import, use, backup, restore — depends on flows that have zero guidance. One failed import on a Sunday morning, no help visible, means a frustrated start to the week.
- **Fix:** Add a 2-screen first-run modal: (1) "Import your weekly plan — a JSON file Claude generates each Sunday." + large Import button. (2) "Back up your data any time in ⚙ Settings → Export." Then persist a `has_onboarded` flag in AsyncStorage. Also: move Settings access to be visible from any tab, not just Plan header.
- **Suggested command:** `/impeccable onboard`

**[P0] Overspend state is a notification with no recovery path**
- **What:** When budget is breached the label changes and the bar turns terracotta. That's it. No indication of which item(s) pushed it over, no suggestion for what to remove, no undo for the last tick.
- **Why it matters:** Tim is in the grocery aisle. Anxiety spikes, app offers no agency. He either mentally audits his entire basket or just ignores the indicator — which defeats its purpose.
- **Fix:** Add an inline recovery strip below the progress bar when overspent: "Last item: {name} (+$X.XX) — [Untick]". This requires surfacing the last-ticked item in the UI state, which is trivial given checkbox state is already in AsyncStorage. Also specify a "Reset last tick" gesture (long-press on last item or a top-of-list undo button).
- **Suggested command:** `/impeccable shape` (new interaction pattern)

**[P1] No undo for checkbox ticks**
- **What:** Tapping a checkbox is instant and permanent (until plan reset). No swipe-to-undo, no long-press context menu, no "undo" toast.
- **Why it matters:** One-handed shopping means mis-ticks are common. The strikethrough + 40% opacity shows the item is checked but provides no path back.
- **Fix:** Android standard: show a brief "Undo" snackbar (2-3 seconds) after each tick. Tapping Undo restores the item. This is a well-known pattern that requires no UI chrome changes.
- **Suggested command:** `/impeccable harden`

**[P1] Batch plan time logic is unspecified**
- **What:** The batch plan shows timed steps (e.g., "8:00 am: prep veg"). The spec doesn't define whether this is a static reference schedule or a live tracker. If static: the header "starts HH:MM" implies a live timer that doesn't exist. If live: there's no start button, no elapsed-time logic, and no alert behavior specified.
- **Why it matters:** If Tim starts 15 minutes late, does the app recalculate? Does it alert him he's falling behind? Ambiguity here will produce an implementation that surprises Tim.
- **Fix:** Add one sentence to the spec: "The batch plan is a static reference — no live tracking in v1. The 'starts HH:MM' field is informational only." If live tracking is desired, spec it as a v2 feature with a [▶ Start] button and elapsed-time calculations.
- **Suggested command:** `/impeccable clarify`

**[P2] Back link is too small and low-contrast for in-context use**
- **What:** "← Recipes" on Recipe Detail is 11px Mulish 600 in `#c4d5d0` on a green header. The tappable area is effectively the text width — well under 44×44pt minimum touch target.
- **Why it matters:** Tim references recipes while cooking. If he's got floury hands or a distracted brain, he needs a reliable exit. The back link is easy to miss and hard to tap precisely.
- **Fix:** Increase touch target to 44×44pt using padding. Weight to 700. Consider a `‹` chevron icon alongside the text for faster recognition. Or add a pill background on hover/focus.
- **Suggested command:** `/impeccable audit`

---

## Persona Red Flags

**Casey (distracted mobile user, one-handed in a grocery aisle):**
- Checkbox is 20×20dp — reachable but not comfortable with one hand and a basket. Entire item row should be the tap target.
- No state preservation message after accidental app close mid-shop. Tim won't know if his ticks saved (they do — AsyncStorage is sync — but this isn't communicated anywhere).
- "Over by $X.XX" state appears with no agency. Casey doesn't know which item triggered it or how to recover.

**Jordan (confused first-timer opening the app for the first time):**
- Empty Shop tab with "[📂 Import meal plan]" tells Jordan nothing about what a "meal plan" is or where to find one.
- Settings is accessible only from the Plan tab header gear icon — Jordan may never discover backup/restore exists.
- Overspend indicator is a surprise — the budget isn't prominently framed before shopping begins.

**Tim in the grocery aisle (project-specific):**
- Sunday batch plan timing is ambiguous — does "starts 8:00 am" mean Tim should start at 8:00, or that the plan was generated assuming an 8:00 start?
- No smart defaults for repeat weekly staples (eggs, milk, bread). Tim is forced to re-tick the same items every week from scratch.
- The `(check pantry first)` note on `is_oneoff` categories is helpful but could be missed — it's beside the category label, not the item row.

---

## Minor Observations

1. **Spec font inconsistency (already resolved):** The spec previously said Jost + Mulish; `constants/tokens.ts` and the updated spec now say Plus Jakarta Sans. This is consistent — just flagging for awareness during implementation.

2. **Progress bar footer label during overspend:** When overspent, the spec says the right footer label becomes "$X.XX over" in terracotta. But the left label ("$XX.XX spent") doesn't change. Define whether "spent" means estimated total or actual total. This matters more once v2 price capture is live.

3. **Category order source of truth:** `category_order` is stored in `shopping_items` but the spec doesn't say whether it's preserved across re-imports of the same plan or recalculated each time. Clarify: order comes from the JSON array index on import and is immutable per plan.

4. **Emoji tab bar accessibility:** Tab icons are emoji (🛒 🍳 📅). These need `accessibilityLabel` props in Expo Router — emoji announce as "shopping cart emoji" to VoiceOver, not "Shop".

5. **Shadow token gap:** `shadow.pill` is defined but the import button (white pill) on the Plan screen is the only pill in v1. Consider whether `shadow.pill` is overkill for v1 or worth keeping for future buttons.

---

## Questions to Consider

1. **Does the primary use case get primary interaction design?** Shopping is rank 1, but the spec gives it the same UI treatment as Recipes and Plan. Should the shopping list have more specialized affordances — swipe to tick, voice input, aisle-optimised ordering — that signal this is the main event?

2. **Is the overspend nudge the right framing?** The spec says "a nudge, not an alarm." But a nudge without an action is just anxiety. What if the overspend indicator came with a suggested swap ("swap to home-brand milk: save $2.30")?

3. **What's the one-year version of this app?** The schema has barcode scanning, price history, and recipe search. Do those features change the IA enough that v1 navigation should anticipate them now, or is the three-tab structure extensible enough?
