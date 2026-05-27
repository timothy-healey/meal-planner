# Recipe notes & richer copy-recipe output

**Date:** 2026-05-27

## Overview

Two related additions to the recipe screen:

1. **Notes** — a single free-text notes field per recipe. Captured in the database, edited via a header-launched sheet, displayed as a card below Method when present. There's no live Claude integration; the user pastes the recipe's copy-output (now including the notes) into Claude themselves when they want an adjustment.
2. **Copy-recipe enhancement** — the existing "Copy recipe" button ([app/recipe/[id].tsx:100-114](app/recipe/[id].tsx#L100-L114)) is extended to include the per-serve carbs and fat (when nutrition is on file) and the recipe's notes block (when present).

Both share the recipe screen and the `useRecipes` hook, so they ship together.

## Data layer

### Schema

Add a nullable `notes` column to the `recipes` table.

In [lib/db/schema.ts](lib/db/schema.ts), the `CREATE TABLE IF NOT EXISTS recipes (…)` definition gains:

```sql
notes TEXT
```

placed after `source` and before `created_at` for readability.

### Migration

Add a `version < 5` block to [lib/db/migrations.ts](lib/db/migrations.ts), following the established pattern (try/catch around `ALTER TABLE` so fresh installs — which already received the column via `SCHEMA_SQL` — are no-ops):

```ts
if (version < 5) {
  try {
    await db.execAsync('ALTER TABLE recipes ADD COLUMN notes TEXT');
  } catch {}
  await db.execAsync('PRAGMA user_version = 5');
}
```

Existing recipes end up with `notes = NULL`. No data transformation needed.

### Types

In [types/db.ts](types/db.ts), `RecipeRow` gains:

```ts
notes: string | null;
```

In [hooks/useRecipes.ts](hooks/useRecipes.ts):

- `Recipe` interface gains `notes: string | null`.
- `parseRecipe` propagates the column unchanged (`...row` already covers it, but assert it explicitly so the type narrows cleanly).

### Hook surface

`useRecipes` gains a single new method:

```ts
async function updateNotes(recipeId: string, notes: string | null): Promise<void> {
  await db.runAsync(
    'UPDATE recipes SET notes = ? WHERE id = ?',
    [notes, recipeId],
  );
  bumpPlanVersion();  // triggers the existing `planVersion` refetch in the useEffect
}
```

Returned alongside `recipes`, `loading`, `getById`. The hook currently destructures only `planVersion` from `usePlanVersion()` ([useRecipes.ts:43](hooks/useRecipes.ts#L43)) — change it to `const { planVersion, bumpPlanVersion } = usePlanVersion();` so the new method can invalidate the cache. `bumpPlanVersion` is the existing setter exposed by `DatabaseProvider` ([providers/DatabaseProvider.tsx:18](providers/DatabaseProvider.tsx#L18)) and used elsewhere for the same pattern.

### Backup compatibility

[hooks/useBackup.ts](hooks/useBackup.ts) round-trips `recipes` via `SELECT *` and column-listed `INSERT`. The INSERT column list for `recipes` must add `'notes'`. Old backups (no `notes` field) restore with `notes` defaulted to `null` — verify the insertion path tolerates undefined / nullish values in the JSON.

## UI: notes on the recipe screen

### Header pill ("+ Note" / "✎ Note")

A new tappable pill in the green header, positioned top-right at the same vertical band as the existing back button ([app/recipe/[id].tsx:120-127](app/recipe/[id].tsx#L120-L127)). Replaces no existing element — sits alongside the back button on the right.

State-aware label:
- `recipe.notes == null || recipe.notes.trim() === ''` → `+ Note`
- otherwise → `✎ Note`

Both shapes use a single tappable pill; only the label and icon glyph change. No size change between states.

Styling (tokens from `constants/tokens.ts`):
- `backgroundColor: colors.headerPill` — same token used by the existing macro pills in this screen ([recipe/[id].tsx:243-247](app/recipe/[id].tsx#L243-L247)), so the new pill matches the existing on-green surface treatment.
- `paddingHorizontal: spacing[3]`, `paddingVertical: spacing[2]`, `borderRadius: radius.full`, `minHeight: 44`.
- Text: `font.family.bold`, `font.size.xs`, `colors.onGreen`. Icon (`+` or pencil) sized `font.size.sm`, same color, with `gap: spacing[1]` to the label.
- Tap target meets the 44dp minimum required by the DESIGN.md principle 5.

Tapping opens `RecipeNotesSheet` (below).

### Notes card below Method

Rendered as a third section beneath Method ([app/recipe/[id].tsx:179-218](app/recipe/[id].tsx#L179-L218)), using the same `<View style={styles.section}>` + `CategoryHeader` + `<View style={styles.card}>` pattern that Ingredients and Method use.

Conditional: shown **only when** `recipe.notes != null && recipe.notes.trim() !== ''`. When empty, the section is omitted entirely — the header pill is the sole entry point in that state.

Card body:
- `padding: spacing[4]` (matches `stepListWrapper`).
- `<AppText weight="regular" color="textPrimary" size="md">{recipe.notes}</AppText>`.
- `numberOfLines` unset — notes wrap freely; no truncation.
- The whole card is a `TouchableOpacity` that opens `RecipeNotesSheet`. `activeOpacity: 0.7`. This is a secondary entry point alongside the header pill; both routes hit the same sheet.

Category header label: `Notes` — same casing as `Ingredients` / `Method` (the `CategoryHeader` component already uppercases via its style).

### `RecipeNotesSheet` component

New file [components/RecipeNotesSheet.tsx](components/RecipeNotesSheet.tsx). Modeled on the existing `AddItemSheet` pattern — bottom-anchored modal, `KeyboardAvoidingView` + `KeyboardAwareScrollView` from `react-native-keyboard-controller`, slide-up animation via reanimated, scrim with opacity fade.

```ts
interface Props {
  visible: boolean;
  recipeTitle: string;
  initialNotes: string | null;
  onSave: (notes: string | null) => void;   // null when text is empty/whitespace-only
  onClose: () => void;                       // dismiss without save
}
```

Internal state:

```ts
const [text, setText] = useState(initialNotes ?? '');
```

Reset on `visible` transition open (mirrors `AddItemSheet`'s `useEffect`).

Layout:

- **Header row:** title `Notes — {recipeTitle}` (extrabold, `font.size.xl`, `textPrimary`) on the left; close button on the right rendering `<Ionicons name="close" size={22} color={colors.textSecondary} />` inside a 44×44 `TouchableOpacity` (matches `AddItemSheet`'s close button). Closing here = dismiss without save; identical to scrim tap.
- **Body:** a single `TextInput`, `multiline`, `textAlignVertical: 'top'`, `minHeight: 200`, `placeholder: 'What worked, what to change next time…'`, `placeholderTextColor: colors.textTertiary`. Borders + padding match existing inputs (`colors.card` bg, `colors.divider` border, `radius.sm`, `padding: spacing[3]`).
- **Footer:** a single full-width Save button styled like `AddItemSheet`'s footer button (`colors.green` bg, `colors.onGreen` text, `paddingVertical: spacing[4]`, `radius.xl`).

Save semantics:

```ts
function handleSave() {
  const trimmed = text.trim();
  onSave(trimmed.length === 0 ? null : trimmed);
  handleClose();
}
```

There is **no Cancel button** — close `X` and scrim tap discard pending edits. This matches the existing patterns and avoids triple-button clutter.

### Wiring in `RecipeDetailScreen`

In [app/recipe/[id].tsx](app/recipe/[id].tsx):

```ts
const [notesSheetVisible, setNotesSheetVisible] = useState(false);
const { updateNotes } = useRecipes();

async function handleNotesSave(notes: string | null) {
  if (!recipe) return;
  await updateNotes(recipe.id, notes);
}
```

Header pill press: `setNotesSheetVisible(true)` + light haptic (matching the existing copy button: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`).

Sheet:

```tsx
<RecipeNotesSheet
  visible={notesSheetVisible}
  recipeTitle={recipe.title}
  initialNotes={recipe.notes}
  onSave={handleNotesSave}
  onClose={() => setNotesSheetVisible(false)}
/>
```

Notes card press: same — `setNotesSheetVisible(true)`.

`recipe.notes` is read fresh from the `recipes` array on each render (it's already keyed off `planVersion`, so an `updateNotes` call updates the displayed value naturally without local state).

## UI: copy-recipe enhancement

Single-file change in `handleCopy` ([app/recipe/[id].tsx:100-114](app/recipe/[id].tsx#L100-L114)).

### Macros header line

Current (note `~` is absent today, prices are integers from `recipe.calories_per_serve`):

```
Serves 3 | 480 cal | 38g protein | stir-fry | 25m
```

New (using `rollup` when present, falling back when absent — matching the same fallback the green-header pills already use at [recipe/[id].tsx:131-168](app/recipe/[id].tsx#L131-L168)):

```ts
const macroStr = rollup
  ? `Serves ${recipe.servings} | ${prefix}${Math.round(rollup.perServe.cal)} kcal | P ${prefix}${Math.round(rollup.perServe.protein_g)}g | C ${prefix}${Math.round(rollup.perServe.carbs_g)}g | F ${prefix}${Math.round(rollup.perServe.fat_g)}g | ${recipe.cook_method} | ${timeLabel}`
  : `Serves ${recipe.servings} | ${recipe.calories_per_serve} kcal | P ${recipe.protein_per_serve_g}g | ${recipe.cook_method} | ${timeLabel}`;
```

Where `prefix = rollup?.isPartial ? '~' : ''` (already computed at [recipe/[id].tsx:57](app/recipe/[id].tsx#L57)).

Mirror choices:

- Use `kcal` (not `cal`) to match the on-screen pills.
- Use the abbreviated `P`/`C`/`F` prefixes — same convention as the macro pills.
- The `~` prefix appears on every macro number when `rollup.isPartial`, matching how the green-header pills present partial data; this prevents Claude from treating an approximation as a measured value.

### Notes section

Append at the end, only when notes exist:

```ts
const notes = recipe.notes?.trim();
const notesBlock = notes ? `\n\nNotes:\n${notes}` : '';

const text = [
  recipe.title,
  macroStr,
  '',
  'Ingredients:',
  ...recipe.ingredients.map((i) => `- ${formatAmount(i.amount)} ${i.item}`),
  '',
  'Method:',
  ...recipe.method_steps.map((s, idx) => `${idx + 1}. ${s}`),
].join('\n') + notesBlock;
```

No blank trailing line after Method when notes are absent (the `notesBlock` is empty); the `\n\n` join before `Notes:` provides the separation when present.

### Affordance behaviour

The Copy button itself (`styles.copyBtn`) and the post-copy "Copied!" toast remain unchanged.

## Edge cases

- **Notes set to whitespace-only.** Treated as null on save (the `.trim().length === 0 ? null : trimmed` guard). No edge state where a non-null whitespace string is persisted.
- **Notes section visibility races a save.** Because `updateNotes` writes the DB then bumps `planVersion`, the parent's `useRecipes` refetch is awaited transitively. The notes card / header pill flip together on the same render.
- **Saving notes on a recipe that no longer exists.** `updateNotes` runs the `UPDATE` which is a no-op for a deleted id — no error, no row change. The screen would have already kicked the user back via the "Recipe not found" branch ([recipe/[id].tsx:47-53](app/recipe/[id].tsx#L47-L53)).
- **Copy-recipe on a recipe with notes that contain `\n\n`.** Preserved verbatim. We don't strip blank lines from user-authored notes.
- **Old backups without `notes` field.** The insert path in `useBackup.ts` should pass `null` for missing fields — confirm this in the implementation step; if it errors instead, default to null explicitly.
- **Method's "Copy recipe" button is in the Method section header.** Unchanged — only the produced clipboard text changes.

## Testing

### Migration

- Fresh install: `recipes` table has `notes` column; `PRAGMA user_version` is 5.
- Existing install at `version = 4`: post-migration, `notes` column exists, all rows have `notes IS NULL`, `PRAGMA user_version` is 5.
- Backup/restore round-trip: recipes with notes survive; recipes from a legacy backup (no `notes` field in JSON) restore with `notes = null`.

### `useRecipes.updateNotes`

- Write non-empty string → row reflects it on next read.
- Write `null` → row's notes becomes `null`.
- Bumps `planVersion`, triggering the load effect.

### `RecipeNotesSheet` (component test)

- Opens with `initialNotes` populated in the `TextInput`.
- Typing then tapping Save calls `onSave` with trimmed text.
- Typing whitespace-only then tapping Save calls `onSave(null)`.
- Tapping the close X calls `onClose` and does **not** call `onSave`.
- Tapping the scrim calls `onClose` (mirrors `AddItemSheet`).

### Recipe screen (integration)

- Recipe with `notes = null` → header pill reads `+ Note`; notes card not rendered.
- Recipe with `notes = "..."` → header pill reads `✎ Note`; notes card rendered with the text; tapping the card opens the sheet pre-filled.
- Save in sheet writes the column, header pill toggles to `✎ Note`, notes card appears.
- Save empty in sheet (clearing existing notes) → header pill flips back to `+ Note`, notes card disappears.

### `handleCopy`

- Recipe with `rollup` present (nutrition on file) → clipboard contains all 4 macros (`kcal | P | C | F`) without `~` when `isPartial === false`.
- Recipe with `rollup.isPartial === true` → all 4 macros prefixed `~`.
- Recipe with no `rollup` (no nutrition links) → falls back to the legacy 2-macro form (`kcal | P`), no `~`.
- Recipe with non-empty `notes` → trailing `Notes:` block appended; line count matches `.split('\n')` exactly.
- Recipe with `notes = null` → no `Notes:` block; output ends with the last method step (no trailing blank line).
- Recipe with `notes` containing newlines → newlines preserved.

## Out of scope

- Per-step or per-ingredient comments (a single field per recipe is sufficient for the Claude-adjustment use case).
- A timestamped log of notes (a single editable field overwrites; the iteration is in the user's head and in Claude's responses).
- In-app Claude API integration. The user pastes the copy-output into a Claude conversation themselves; the app's job is to produce good clipboard text.
- Bundling notes from all recipes into the meal-plan-regeneration prompt — the existing `regenerate/HOW_TO_REGENERATE.md` flow already accepts attached recipe JSON; future work could add a "include notes" toggle to the export. Not in this spec.
- Rich text, markdown rendering, attachments. Plain text only.
- An undo affordance for note saves. The sheet's Save is the commit point; if the user wants to revert, they re-edit. No history retained.
