# Recipe notes & richer copy-recipe output — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single per-recipe `notes` field (DB column + UI for editing) and extend the existing "Copy recipe" clipboard output to include all four per-serve macros plus the notes block — making the copy-output a Claude-ready prompt for recipe adjustments.

**Architecture:** Single nullable TEXT column on the existing `recipes` table reached through a `v5` schema migration. New `updateNotes(id, notes)` method on `useRecipes` invalidates the cache via the existing `bumpPlanVersion` provider hook. New presentational `RecipeNotesSheet` component modelled on the existing `AddItemSheet`. Recipe-screen header grows a `+ Note` / `✎ Note` pill on the right (mirroring the back button on the left), and the existing Method+Ingredients sections gain a sibling Notes section that renders only when notes exist. `handleCopy` is rewritten to emit `rollup`-driven macros and append a `Notes:` block.

**Tech Stack:** Expo SDK 56, expo-sqlite, React Native, `react-native-keyboard-controller`, `react-native-reanimated`, `expo-haptics`, `expo-clipboard`, Jest + `@testing-library/react-native`.

**Spec:** [docs/superpowers/specs/2026-05-27-recipe-notes-design.md](docs/superpowers/specs/2026-05-27-recipe-notes-design.md)

---

## File map

- **Modify:**
  - `lib/db/schema.ts` — add `notes TEXT` column to the recipes table.
  - `lib/db/migrations.ts` — add `version < 5` block.
  - `types/db.ts` — `RecipeRow` gains `notes: string | null`.
  - `hooks/useRecipes.ts` — `Recipe` interface gains `notes`; pull `bumpPlanVersion`; add `updateNotes` method.
  - `hooks/useBackup.ts` — add `'notes'` to the recipes INSERT column list.
  - `app/recipe/[id].tsx` — header pill, notes card, sheet wiring, copy-recipe rewrite.
  - `__tests__/lib/db/migrations.test.ts` — assertions for the v5 migration.
- **Create:**
  - `components/RecipeNotesSheet.tsx` — the editor sheet.
  - `__tests__/hooks/useRecipes.test.ts` — covers `updateNotes` (the file does not yet exist).
  - `__tests__/components/RecipeNotesSheet.test.tsx` — sheet component tests.
  - `__tests__/screens/recipe-detail.test.tsx` — recipe screen integration (header pill, notes card, copy-clipboard output).

No types removed. No tables renamed. No legacy code paths touched except adding a column to one INSERT statement.

---

## Task 1: Schema column + v5 migration + RecipeRow type

Lay down the data layer foundation first so every later task has a working column to read.

**Files:**
- Modify: `lib/db/schema.ts`
- Modify: `lib/db/migrations.ts`
- Modify: `types/db.ts`
- Modify: `__tests__/lib/db/migrations.test.ts`

- [ ] **Step 1: Write the failing migration test**

Append to `__tests__/lib/db/migrations.test.ts`, inside the existing `describe('runMigrations', () => { ... })` block:

```ts
it('runs version-5 migration on a v4 database (adds notes column to recipes)', async () => {
  mockDb.getAllAsync.mockResolvedValue([{ user_version: 4 }]);
  await runMigrations(mockDb as any);
  const allSql = mockDb.execAsync.mock.calls.map((c: any[]) => c[0]).join('\n');
  expect(allSql).toContain('ALTER TABLE recipes ADD COLUMN notes TEXT');
  expect(allSql).toContain('user_version = 5');
});

it('skips version-5 migration when already at version 5', async () => {
  mockDb.getAllAsync.mockResolvedValue([{ user_version: 5 }]);
  await runMigrations(mockDb as any);
  const allSql = mockDb.execAsync.mock.calls.map((c: any[]) => c[0]).join('\n');
  expect(allSql).not.toContain('ADD COLUMN notes');
});

it('includes notes column in the recipes CREATE TABLE statement', async () => {
  await runMigrations(mockDb as any);
  const sql: string = mockDb.execAsync.mock.calls[0][0];
  // The CREATE TABLE block for recipes should mention `notes TEXT`.
  const recipesBlock = sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS recipes'));
  const afterCreate = recipesBlock.slice(0, recipesBlock.indexOf(');') + 2);
  expect(afterCreate).toContain('notes');
  expect(afterCreate).toContain('TEXT');
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `npm test -- __tests__/lib/db/migrations.test.ts`

Expected: the three new tests FAIL (the v5 block doesn't exist; the CREATE TABLE doesn't mention `notes`). The existing v1–v4 tests still pass.

- [ ] **Step 3: Add the `notes` column to the schema**

In `lib/db/schema.ts`, locate the `recipes` table block (currently lines 2-17):

```ts
CREATE TABLE IF NOT EXISTS recipes (
  id                  TEXT PRIMARY KEY,
  title               TEXT NOT NULL,
  meal_type           TEXT NOT NULL,
  servings            INTEGER NOT NULL,
  calories_per_serve  INTEGER NOT NULL,
  protein_per_serve_g INTEGER NOT NULL,
  cook_method         TEXT NOT NULL,
  prep_minutes        INTEGER NOT NULL,
  cook_minutes        INTEGER NOT NULL,
  ingredients_json    TEXT NOT NULL,
  method_steps_json   TEXT NOT NULL,
  is_favourite        INTEGER DEFAULT 0,
  source              TEXT DEFAULT 'imported',
  created_at          TEXT NOT NULL
);
```

Replace with (only the new line is added):

```ts
CREATE TABLE IF NOT EXISTS recipes (
  id                  TEXT PRIMARY KEY,
  title               TEXT NOT NULL,
  meal_type           TEXT NOT NULL,
  servings            INTEGER NOT NULL,
  calories_per_serve  INTEGER NOT NULL,
  protein_per_serve_g INTEGER NOT NULL,
  cook_method         TEXT NOT NULL,
  prep_minutes        INTEGER NOT NULL,
  cook_minutes        INTEGER NOT NULL,
  ingredients_json    TEXT NOT NULL,
  method_steps_json   TEXT NOT NULL,
  is_favourite        INTEGER DEFAULT 0,
  source              TEXT DEFAULT 'imported',
  notes               TEXT,
  created_at          TEXT NOT NULL
);
```

- [ ] **Step 4: Add the v5 migration block**

In `lib/db/migrations.ts`, append after the existing `if (version < 4)` block (after line 128):

```ts
  if (version < 5) {
    // Fresh installs already get the column via SCHEMA_SQL — the ALTER is wrapped
    // in try/catch so re-running on a fresh DB is a no-op.
    try {
      await db.execAsync('ALTER TABLE recipes ADD COLUMN notes TEXT');
    } catch {}
    await db.execAsync('PRAGMA user_version = 5');
  }
```

- [ ] **Step 5: Add `notes` to `RecipeRow`**

In `types/db.ts`, find the `RecipeRow` interface (lines 1-16) and add `notes: string | null` after the `source` field:

```ts
export interface RecipeRow {
  id: string;
  title: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  servings: number;
  calories_per_serve: number;
  protein_per_serve_g: number;
  cook_method: string;
  prep_minutes: number;
  cook_minutes: number;
  ingredients_json: string;
  method_steps_json: string;
  is_favourite: 0 | 1;
  source: 'imported' | 'user';
  notes: string | null;
  created_at: string;
}
```

- [ ] **Step 6: Run the migration tests, confirm they pass**

Run: `npm test -- __tests__/lib/db/migrations.test.ts`

Expected: all tests PASS, including the three new v5 cases.

- [ ] **Step 7: Commit**

```bash
git add lib/db/schema.ts lib/db/migrations.ts types/db.ts __tests__/lib/db/migrations.test.ts
git commit -m "$(cat <<'EOF'
feat(db): add notes column to recipes (schema v5)

Nullable TEXT column on the recipes table for free-text per-recipe
notes. Migration follows the established try/catch ALTER pattern so
fresh installs (which already received the column via SCHEMA_SQL) are
a no-op. RecipeRow gains notes: string | null.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `useRecipes.updateNotes` hook surface

**Files:**
- Modify: `hooks/useRecipes.ts`
- Create: `__tests__/hooks/useRecipes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/hooks/useRecipes.test.ts`:

```ts
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useRecipes } from '../../hooks/useRecipes';

const mockRecipeRow = {
  id: 'r1',
  title: 'Chicken Stir-fry',
  meal_type: 'dinner',
  servings: 3,
  calories_per_serve: 480,
  protein_per_serve_g: 38,
  cook_method: 'stir-fry',
  prep_minutes: 10,
  cook_minutes: 15,
  ingredients_json: JSON.stringify([{ item: 'Chicken', amount: { kind: 'measured', value: 500, unit: 'g' } }]),
  method_steps_json: JSON.stringify(['Brown the chicken.']),
  is_favourite: 0,
  source: 'imported',
  notes: null,
  created_at: '2026-05-24',
};

const mockBumpPlanVersion = jest.fn();
const mockDb = {
  getAllAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  runAsync: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../providers/DatabaseProvider', () => ({
  useDb: () => mockDb,
  usePlanVersion: () => ({ planVersion: 0, bumpPlanVersion: mockBumpPlanVersion }),
}));

describe('useRecipes', () => {
  beforeEach(() => {
    mockDb.getAllAsync.mockReset().mockResolvedValue([mockRecipeRow]);
    mockDb.runAsync.mockReset().mockResolvedValue(undefined);
    mockBumpPlanVersion.mockReset();
  });

  it('exposes parsed recipes including the notes field', async () => {
    const { result } = renderHook(() => useRecipes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.recipes[0].notes).toBeNull();
  });

  it('updateNotes issues UPDATE with the provided id and value', async () => {
    const { result } = renderHook(() => useRecipes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.updateNotes('r1', 'sauce too thin'); });

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'UPDATE recipes SET notes = ? WHERE id = ?',
      ['sauce too thin', 'r1'],
    );
  });

  it('updateNotes accepts null to clear the field', async () => {
    const { result } = renderHook(() => useRecipes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.updateNotes('r1', null); });

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'UPDATE recipes SET notes = ? WHERE id = ?',
      [null, 'r1'],
    );
  });

  it('updateNotes calls bumpPlanVersion after the write to invalidate the cache', async () => {
    const { result } = renderHook(() => useRecipes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.updateNotes('r1', 'note'); });

    expect(mockBumpPlanVersion).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- __tests__/hooks/useRecipes.test.ts`

Expected: all four tests FAIL — `result.current.updateNotes` is undefined; the `Recipe.notes` field is missing from the parsed type so the first assertion may pass or fail depending on whether TypeScript squeaks through at runtime. The point is the new methods don't exist.

- [ ] **Step 3: Update `useRecipes` to expose `notes` and `updateNotes`**

In `hooks/useRecipes.ts`, replace the file contents with:

```ts
import { useEffect, useState } from 'react';
import { useDb, usePlanVersion } from '../providers/DatabaseProvider';
import type { RecipeRow } from '../types/db';
import type { Ingredient } from '../meal_plan.types';
import { parseAmountString } from '../lib/amount';

export interface Recipe {
  id: string;
  title: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  servings: number;
  calories_per_serve: number;
  protein_per_serve_g: number;
  cook_method: string;
  prep_minutes: number;
  cook_minutes: number;
  ingredients: Ingredient[];
  method_steps: string[];
  is_favourite: boolean;
  notes: string | null;
}

function coerceIngredient(raw: { item: string; amount: unknown }): Ingredient {
  if (typeof raw.amount === 'string') {
    return { item: raw.item, amount: parseAmountString(raw.amount) };
  }
  return raw as Ingredient;
}

function parseRecipe(row: RecipeRow): Recipe {
  const rawIngredients = JSON.parse(row.ingredients_json);
  return {
    ...row,
    ingredients: rawIngredients.map(coerceIngredient),
    method_steps: JSON.parse(row.method_steps_json),
    is_favourite: row.is_favourite === 1,
    notes: row.notes ?? null,
  };
}

export function useRecipes() {
  const db = useDb();
  const { planVersion, bumpPlanVersion } = usePlanVersion();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.getAllAsync<RecipeRow>('SELECT * FROM recipes ORDER BY meal_type, title')
      .then((rows) => { setRecipes(rows.map(parseRecipe)); setLoading(false); });
  }, [planVersion]);

  async function getById(id: string): Promise<Recipe | null> {
    const row = await db.getFirstAsync<RecipeRow>('SELECT * FROM recipes WHERE id = ?', [id]);
    return row ? parseRecipe(row) : null;
  }

  async function updateNotes(recipeId: string, notes: string | null): Promise<void> {
    await db.runAsync(
      'UPDATE recipes SET notes = ? WHERE id = ?',
      [notes, recipeId],
    );
    bumpPlanVersion();
  }

  return { recipes, loading, getById, updateNotes };
}
```

- [ ] **Step 4: Run the tests, confirm they pass**

Run: `npm test -- __tests__/hooks/useRecipes.test.ts`

Expected: all four tests PASS.

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `npm test`

Expected: all previously-green tests stay green. The new `useRecipes` test passes. Other code that imports `Recipe` continues to compile (the `notes` field is additive; nothing reads it yet).

- [ ] **Step 6: Commit**

```bash
git add hooks/useRecipes.ts __tests__/hooks/useRecipes.test.ts
git commit -m "$(cat <<'EOF'
feat(useRecipes): expose notes and add updateNotes

parseRecipe now surfaces the new notes column. updateNotes(id, notes)
writes the column and bumps planVersion to invalidate the in-memory
recipes cache. null clears the field. Sets the data layer up for the
recipe-screen notes UI.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Backup compatibility

The `useBackup` helper round-trips `recipes` with an explicit column list — without updating it, notes would silently drop on export/restore.

**Files:**
- Modify: `hooks/useBackup.ts`

- [ ] **Step 1: Add `'notes'` to the recipes INSERT column list**

In `hooks/useBackup.ts:96-98`, find:

```ts
...insertRows('recipes', backup.recipes ?? [], ['id','title','meal_type','servings',
  'calories_per_serve','protein_per_serve_g','cook_method','prep_minutes','cook_minutes',
  'ingredients_json','method_steps_json','is_favourite','source','created_at']),
```

Replace with (the new `'notes'` slot before `'created_at'` mirrors the schema order):

```ts
...insertRows('recipes', backup.recipes ?? [], ['id','title','meal_type','servings',
  'calories_per_serve','protein_per_serve_g','cook_method','prep_minutes','cook_minutes',
  'ingredients_json','method_steps_json','is_favourite','source','notes','created_at']),
```

The helper at [useBackup.ts:128-132](hooks/useBackup.ts#L128-L132) reads each column via `row[c] ?? null` — so legacy backups (no `notes` field) restore with `notes = null` automatically.

- [ ] **Step 2: Smoke-check by running the full suite**

Run: `npm test`

Expected: all tests pass. The `useBackup` flow has no unit tests in the repo today, so coverage is unchanged; the change is mechanical and protected by the schema-test work in Task 1.

- [ ] **Step 3: Commit**

```bash
git add hooks/useBackup.ts
git commit -m "$(cat <<'EOF'
chore(backup): include recipes.notes in export/restore column list

Without this, notes silently round-trip to null on backup restore.
Legacy backups (no notes field) continue to restore correctly because
insertRows defaults missing columns to null via row[c] ?? null.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `RecipeNotesSheet` component

**Files:**
- Create: `components/RecipeNotesSheet.tsx`
- Create: `__tests__/components/RecipeNotesSheet.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `__tests__/components/RecipeNotesSheet.test.tsx`:

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RecipeNotesSheet } from '../../components/RecipeNotesSheet';

describe('RecipeNotesSheet', () => {
  const baseProps = {
    visible: true,
    recipeTitle: 'Chicken Stir-fry',
    initialNotes: null as string | null,
    onSave: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    baseProps.onSave = jest.fn();
    baseProps.onClose = jest.fn();
  });

  it('returns null when not visible', () => {
    const { toJSON } = render(<RecipeNotesSheet {...baseProps} visible={false} />);
    expect(toJSON()).toBeNull();
  });

  it('renders the title using the provided recipe name', () => {
    const { getByText } = render(<RecipeNotesSheet {...baseProps} />);
    expect(getByText('Notes — Chicken Stir-fry')).toBeTruthy();
  });

  it('pre-fills the input with initialNotes when present', () => {
    const { getByDisplayValue } = render(
      <RecipeNotesSheet {...baseProps} initialNotes="sauce too thin" />,
    );
    expect(getByDisplayValue('sauce too thin')).toBeTruthy();
  });

  it('calls onSave with the trimmed text on Save', () => {
    const onSave = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <RecipeNotesSheet {...baseProps} onSave={onSave} />,
    );
    fireEvent.changeText(getByPlaceholderText(/What worked/i), '  doubled the broccoli  ');
    fireEvent.press(getByText('Save notes'));
    expect(onSave).toHaveBeenCalledWith('doubled the broccoli');
  });

  it('calls onSave(null) when text is empty or whitespace-only', () => {
    const onSave = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <RecipeNotesSheet {...baseProps} initialNotes="prev" onSave={onSave} />,
    );
    fireEvent.changeText(getByPlaceholderText(/What worked/i), '   ');
    fireEvent.press(getByText('Save notes'));
    expect(onSave).toHaveBeenCalledWith(null);
  });

  it('calls onClose but not onSave when the close button is tapped', () => {
    const onSave = jest.fn();
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <RecipeNotesSheet {...baseProps} initialNotes="prev" onSave={onSave} onClose={onClose} />,
    );
    fireEvent.press(getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- __tests__/components/RecipeNotesSheet.test.tsx`

Expected: tests FAIL — `RecipeNotesSheet` does not yet exist. Jest reports `Cannot find module '../../components/RecipeNotesSheet'`.

- [ ] **Step 3: Implement the component**

Create `components/RecipeNotesSheet.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import { KeyboardAvoidingView, KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './ui/AppText';
import { colors, spacing, radius, shadow, font } from '../constants/tokens';

const SHEET_HEIGHT = Dimensions.get('window').height * 0.6;

interface Props {
  visible: boolean;
  recipeTitle: string;
  initialNotes: string | null;
  onSave: (notes: string | null) => void;
  onClose: () => void;
}

export function RecipeNotesSheet({ visible, recipeTitle, initialNotes, onSave, onClose }: Props) {
  const translateY = useSharedValue(SHEET_HEIGHT);
  const scrimOpacity = useSharedValue(0);
  const [text, setText] = useState(initialNotes ?? '');

  useEffect(() => {
    if (visible) {
      setText(initialNotes ?? '');
      scrimOpacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.exp) });
      translateY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.exp) });
    }
  }, [visible, initialNotes]);

  const handleClose = () => {
    scrimOpacity.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.exp) });
    translateY.value = withTiming(SHEET_HEIGHT, { duration: 220, easing: Easing.out(Easing.exp) }, () => {
      runOnJS(onClose)();
    });
  };

  const handleSave = () => {
    const trimmed = text.trim();
    onSave(trimmed.length === 0 ? null : trimmed);
    handleClose();
  };

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOpacity.value }));

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <Animated.View style={[styles.sheet, sheetStyle]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <AppText weight="extrabold" color="textPrimary" size="xl" style={styles.title} numberOfLines={1}>
              {`Notes — ${recipeTitle}`}
            </AppText>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeBtn}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <KeyboardAwareScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TextInput
              style={styles.input}
              placeholder="What worked, what to change next time…"
              placeholderTextColor={colors.textTertiary}
              value={text}
              onChangeText={setText}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Recipe notes"
            />
          </KeyboardAwareScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Save notes"
            >
              <AppText weight="extrabold" color="onGreen" size="md">
                Save notes
              </AppText>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  scrim: { backgroundColor: colors.scrim },
  sheet: {
    height: SHEET_HEIGHT,
    backgroundColor: colors.cream,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    ...shadow.sheet,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.divider,
    alignSelf: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[1],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
  },
  title: { flex: 1, paddingRight: spacing[3] },
  closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: spacing[5], paddingBottom: spacing[4] },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontFamily: font.family.regular,
    fontSize: font.size.md,
    color: colors.textPrimary,
    minHeight: 200,
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  saveBtn: {
    backgroundColor: colors.green,
    paddingVertical: spacing[4],
    borderRadius: radius.xl,
    alignItems: 'center',
  },
});
```

- [ ] **Step 4: Run the tests, confirm they pass**

Run: `npm test -- __tests__/components/RecipeNotesSheet.test.tsx`

Expected: all six tests PASS. If `getByPlaceholderText(/What worked/i)` doesn't match, the placeholder copy in the implementation is wrong — fix the placeholder, not the test.

- [ ] **Step 5: Commit**

```bash
git add components/RecipeNotesSheet.tsx __tests__/components/RecipeNotesSheet.test.tsx
git commit -m "$(cat <<'EOF'
feat(RecipeNotesSheet): add bottom-sheet editor for per-recipe notes

Modelled on AddItemSheet's animation + layout patterns. Single
multiline TextInput, Save trims and emits null on empty, close X
discards without save. Sheet height is 60% of window — comfortable
room for a paragraph without dwarfing context.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Recipe screen — header pill + notes card + sheet wiring

Wire the new sheet into the recipe screen with the header `+ Note` / `✎ Note` pill and the conditional Notes section.

**Files:**
- Modify: `app/recipe/[id].tsx`
- Create: `__tests__/screens/recipe-detail.test.tsx`

- [ ] **Step 1: Write the failing integration tests**

Create `__tests__/screens/recipe-detail.test.tsx`:

```tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockUpdateNotes = jest.fn().mockResolvedValue(undefined);
const mockGetLinksForRecipe = jest.fn().mockResolvedValue({});

const mockRecipeBase = {
  id: 'r1',
  title: 'Chicken Stir-fry',
  meal_type: 'dinner',
  servings: 3,
  calories_per_serve: 480,
  protein_per_serve_g: 38,
  cook_method: 'stir-fry',
  prep_minutes: 10,
  cook_minutes: 15,
  ingredients: [
    { item: 'Chicken breast', amount: { kind: 'measured', value: 600, unit: 'g' } },
  ],
  method_steps: ['Brown the chicken.', 'Add broccoli.'],
  is_favourite: false,
  notes: null as string | null,
};

const mockRecipesState = { current: [{ ...mockRecipeBase }] };

jest.mock('../../hooks/useRecipes', () => ({
  useRecipes: () => ({
    recipes: mockRecipesState.current,
    loading: false,
    getById: jest.fn(),
    updateNotes: mockUpdateNotes,
  }),
}));

jest.mock('../../hooks/useFoodNutrition', () => ({
  useFoodNutrition: () => ({
    upsert: jest.fn(),
    linkIngredient: jest.fn(),
    getLinksForRecipe: mockGetLinksForRecipe,
  }),
}));

jest.mock('../../hooks/useRecipeIngredients', () => ({
  useRecipeIngredients: () => ({
    updateIngredient: jest.fn(),
    addIngredient: jest.fn(),
    deleteIngredient: jest.fn(),
  }),
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ id: 'r1' }),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

import RecipeDetailScreen from '../../app/recipe/[id]';

function setNotes(notes: string | null) {
  mockRecipesState.current = [{ ...mockRecipeBase, notes }];
}

describe('RecipeDetailScreen — notes', () => {
  beforeEach(() => {
    mockUpdateNotes.mockClear();
    setNotes(null);
  });

  it('renders the header pill with "+ Note" copy when no notes are set', () => {
    const { getByText } = render(<RecipeDetailScreen />);
    expect(getByText(/^\+\s*Note$/)).toBeTruthy();
  });

  it('renders the header pill with "Note" + pencil affordance when notes exist', () => {
    setNotes('sauce too thin');
    const { getByLabelText } = render(<RecipeDetailScreen />);
    expect(getByLabelText('Edit notes')).toBeTruthy();
  });

  it('does not render a Notes section when notes are null', () => {
    const { queryByText } = render(<RecipeDetailScreen />);
    expect(queryByText('Notes')).toBeNull();
  });

  it('renders the Notes section + body text when notes exist', () => {
    setNotes('sauce too thin, try thighs next time');
    const { getByText } = render(<RecipeDetailScreen />);
    expect(getByText('Notes')).toBeTruthy();
    expect(getByText('sauce too thin, try thighs next time')).toBeTruthy();
  });

  it('opens the notes sheet when the header pill is tapped', () => {
    const { getByLabelText, getByPlaceholderText } = render(<RecipeDetailScreen />);
    fireEvent.press(getByLabelText('Add notes'));
    expect(getByPlaceholderText(/What worked/i)).toBeTruthy();
  });

  it('opens the notes sheet when the Notes card is tapped', () => {
    setNotes('sauce too thin');
    const { getByText, getByPlaceholderText } = render(<RecipeDetailScreen />);
    fireEvent.press(getByText('sauce too thin'));
    expect(getByPlaceholderText(/What worked/i)).toBeTruthy();
  });

  it('calls updateNotes with the saved value when the sheet saves', async () => {
    const { getByLabelText, getByPlaceholderText, getByText } = render(<RecipeDetailScreen />);
    fireEvent.press(getByLabelText('Add notes'));
    fireEvent.changeText(getByPlaceholderText(/What worked/i), 'doubled the broccoli');
    fireEvent.press(getByText('Save notes'));
    await waitFor(() => expect(mockUpdateNotes).toHaveBeenCalledWith('r1', 'doubled the broccoli'));
  });

  it('calls updateNotes(r1, null) when the sheet saves whitespace', async () => {
    setNotes('previous notes');
    const { getByText: gbt, getByPlaceholderText, getByLabelText } = render(<RecipeDetailScreen />);
    fireEvent.press(getByLabelText('Edit notes'));
    fireEvent.changeText(getByPlaceholderText(/What worked/i), '   ');
    fireEvent.press(gbt('Save notes'));
    await waitFor(() => expect(mockUpdateNotes).toHaveBeenCalledWith('r1', null));
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- __tests__/screens/recipe-detail.test.tsx`

Expected: most tests FAIL because the pill, section, and accessibility labels don't yet exist in `RecipeDetailScreen`.

- [ ] **Step 3: Add notes state and the sheet import**

In `app/recipe/[id].tsx`:

Add `RecipeNotesSheet` to imports — find the existing component imports near the top and add:

```tsx
import { RecipeNotesSheet } from '../../components/RecipeNotesSheet';
```

In the component body, find the `const [copied, setCopied] = useState(false);` line (around line 37) and add:

```tsx
const [notesSheetVisible, setNotesSheetVisible] = useState(false);
```

Find the `useRecipes` destructure (around line 27):

```tsx
const { recipes } = useRecipes();
```

Replace with:

```tsx
const { recipes, updateNotes } = useRecipes();
```

Add the save handler before `handleCopy` (around line 100):

```tsx
async function handleNotesSave(nextNotes: string | null) {
  if (!recipe) return;
  await updateNotes(recipe.id, nextNotes);
}

function openNotesSheet() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  setNotesSheetVisible(true);
}
```

- [ ] **Step 4: Add the header pill**

In the `GreenHeader` block (around lines 118-131), the structure is:

```tsx
<GreenHeader>
  <View style={styles.headerContent}>
    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} ...>
      <AppText ...>‹ Recipes</AppText>
    </TouchableOpacity>
    <AppText weight="extrabold" ...>{recipe.title}</AppText>
    <View style={styles.pillRow}>
      ...
    </View>
  </View>
</GreenHeader>
```

Wrap the back-button row in a new flex row that also contains the notes pill. Replace the back button + title area with:

```tsx
<View style={styles.topRow}>
  <TouchableOpacity
    onPress={() => router.back()}
    style={styles.backBtn}
    accessibilityRole="button"
    accessibilityLabel="Back to Recipes"
  >
    <AppText weight="bold" color="onGreenSubtle" size="sm">‹ Recipes</AppText>
  </TouchableOpacity>
  <TouchableOpacity
    onPress={openNotesSheet}
    style={styles.notesPill}
    activeOpacity={0.85}
    accessibilityRole="button"
    accessibilityLabel={recipe.notes && recipe.notes.trim() ? 'Edit notes' : 'Add notes'}
  >
    <AppText weight="bold" color="onGreen" size="xs">
      {recipe.notes && recipe.notes.trim() ? '✎ Note' : '+ Note'}
    </AppText>
  </TouchableOpacity>
</View>
<AppText weight="extrabold" color="onGreen" size="2xl" numberOfLines={2}>
  {recipe.title}
</AppText>
```

Add to the `styles` object at the bottom of the file:

```ts
topRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
notesPill: {
  backgroundColor: colors.headerPill,
  paddingHorizontal: spacing[3],
  paddingVertical: spacing[2],
  borderRadius: radius.full,
  minHeight: 44,
  justifyContent: 'center',
  alignItems: 'center',
},
```

- [ ] **Step 5: Add the Notes section below Method**

Just before the closing `</ScrollView>` (around line 218), insert a new `<View style={styles.section}>` block:

```tsx
{recipe.notes && recipe.notes.trim() && (
  <View style={styles.section}>
    <CategoryHeader label="Notes" isOneoff={false} />
    <TouchableOpacity
      style={styles.card}
      onPress={openNotesSheet}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Edit notes"
    >
      <View style={styles.notesBody}>
        <AppText weight="regular" color="textPrimary" size="md">
          {recipe.notes}
        </AppText>
      </View>
    </TouchableOpacity>
  </View>
)}
```

Add to the `styles` object:

```ts
notesBody: {
  padding: spacing[4],
},
```

- [ ] **Step 6: Mount the sheet at the bottom**

Just before the `</View>` that closes `styles.container` (right after the existing `IngredientSheet`), add:

```tsx
<RecipeNotesSheet
  visible={notesSheetVisible}
  recipeTitle={recipe.title}
  initialNotes={recipe.notes}
  onSave={handleNotesSave}
  onClose={() => setNotesSheetVisible(false)}
/>
```

- [ ] **Step 7: Run the failing tests, confirm they pass**

Run: `npm test -- __tests__/screens/recipe-detail.test.tsx`

Expected: all eight tests PASS. If any fail:
- The accessibilityLabel toggling must use `recipe.notes && recipe.notes.trim()` consistently (the test alternates between `Add notes` and `Edit notes`).
- If `getByText('Notes')` fails when notes are set, the `CategoryHeader` may be wrapping/uppercasing the label — query by the actual rendered text (probably `NOTES`). Adjust the test to match the visible casing if that's the case.

- [ ] **Step 8: Run the full suite**

Run: `npm test`

Expected: all tests pass. The pill change in the recipe header shouldn't break any other test, but the recipe-screen module is now consumed by a new test file, so any unrelated regressions surface here first.

- [ ] **Step 9: Commit**

```bash
git add app/recipe/[id].tsx __tests__/screens/recipe-detail.test.tsx
git commit -m "$(cat <<'EOF'
feat(recipe-screen): add header "+ Note" pill and Notes section

Header pill on the right of the back-button row toggles between
"+ Note" (no notes) and "✎ Note" (notes exist) and opens
RecipeNotesSheet. A new Notes section renders below Method when
notes exist; the card itself is also tappable as a secondary entry
point into the sheet. Save writes via useRecipes.updateNotes; the
planVersion bump re-renders the screen with the new value.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Copy-recipe enhancement (macros + notes)

Single-function rewrite in `handleCopy`. Tests verify the produced clipboard string for the four shapes (rollup present, rollup partial, no rollup, notes present/absent).

**Files:**
- Modify: `app/recipe/[id].tsx`
- Modify: `__tests__/screens/recipe-detail.test.tsx` (append clipboard tests)

- [ ] **Step 1: Append failing clipboard tests**

In `__tests__/screens/recipe-detail.test.tsx`, append a new `describe` block at the bottom of the file. The recipe screen fetches nutrition links via an async `useEffect`, so the rollup state isn't ready on the first render — the test helper `flushLinks` waits for the effect's `.then` to resolve before pressing the copy button.

```tsx
import * as Clipboard from 'expo-clipboard';
import { act } from '@testing-library/react-native';

// Wait for: (a) the effect has fired, (b) the .then microtask has resolved,
// (c) the second render has flushed. After this, rollup reflects the configured
// links and handleCopy will read the post-link state.
async function flushLinks() {
  await waitFor(() => expect(mockGetLinksForRecipe).toHaveBeenCalled());
  await act(async () => { await Promise.resolve(); });
}

describe('RecipeDetailScreen — copy recipe', () => {
  beforeEach(() => {
    (Clipboard.setStringAsync as jest.Mock).mockClear();
    mockGetLinksForRecipe.mockReset().mockResolvedValue({});
  });

  it('produces the legacy 2-macro line when no nutrition links exist', async () => {
    setNotes(null);
    mockGetLinksForRecipe.mockResolvedValue({});
    const { getByLabelText } = render(<RecipeDetailScreen />);
    await flushLinks();
    fireEvent.press(getByLabelText('Copy recipe to clipboard'));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalled());
    const text: string = (Clipboard.setStringAsync as jest.Mock).mock.calls[0][0];
    expect(text).toMatch(/Serves 3 \| 480 kcal \| P 38g \| stir-fry/);
    expect(text).not.toContain('Notes:');
  });

  it('produces all four macros when rollup is available', async () => {
    setNotes(null);
    mockGetLinksForRecipe.mockResolvedValue({
      0: {
        id: 'fn1', item_name: 'Chicken', brand: null, product_name: null,
        basis: 'per_100g',
        cal_per_basis: 165, protein_per_basis: 31, carbs_per_basis: 0, fat_per_basis: 3.6,
        updated_at: '2026-05-24',
      },
    });
    const { getByLabelText } = render(<RecipeDetailScreen />);
    await flushLinks();
    fireEvent.press(getByLabelText('Copy recipe to clipboard'));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalled());
    const text: string = (Clipboard.setStringAsync as jest.Mock).mock.calls[0][0];
    // 600g chicken @ 165cal/100g across 3 servings = 330cal/serve.
    // Only one ingredient, fully linked → isPartial = false (no `~`).
    expect(text).toMatch(/\| 330 kcal \| P 62g \| C 0g \| F 7g \|/);
    expect(text).not.toContain('~');
  });

  it('marks every macro with ~ when rollup is partial', async () => {
    setNotes(null);
    mockRecipesState.current = [{
      ...mockRecipeBase,
      ingredients: [
        { item: 'Chicken', amount: { kind: 'measured', value: 600, unit: 'g' } },
        { item: 'Broccoli', amount: { kind: 'measured', value: 300, unit: 'g' } },
      ],
    }];
    mockGetLinksForRecipe.mockResolvedValue({
      0: {
        id: 'fn1', item_name: 'Chicken', brand: null, product_name: null,
        basis: 'per_100g',
        cal_per_basis: 165, protein_per_basis: 31, carbs_per_basis: 0, fat_per_basis: 3.6,
        updated_at: '2026-05-24',
      },
      // broccoli intentionally unlinked → isPartial = true
    });
    const { getByLabelText } = render(<RecipeDetailScreen />);
    await flushLinks();
    fireEvent.press(getByLabelText('Copy recipe to clipboard'));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalled());
    const text: string = (Clipboard.setStringAsync as jest.Mock).mock.calls[0][0];
    expect(text).toMatch(/\| ~330 kcal \| P ~62g \| C ~0g \| F ~7g \|/);
  });

  it('appends a Notes: block when notes are present', async () => {
    setNotes('sauce too thin — try cornstarch slurry');
    const { getByLabelText } = render(<RecipeDetailScreen />);
    await flushLinks();
    fireEvent.press(getByLabelText('Copy recipe to clipboard'));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalled());
    const text: string = (Clipboard.setStringAsync as jest.Mock).mock.calls[0][0];
    expect(text).toContain('\n\nNotes:\nsauce too thin — try cornstarch slurry');
    expect(text.endsWith('sauce too thin — try cornstarch slurry')).toBe(true);
  });

  it('omits Notes: when notes is whitespace-only', async () => {
    setNotes('   ');
    const { getByLabelText } = render(<RecipeDetailScreen />);
    await flushLinks();
    fireEvent.press(getByLabelText('Copy recipe to clipboard'));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalled());
    const text: string = (Clipboard.setStringAsync as jest.Mock).mock.calls[0][0];
    expect(text).not.toContain('Notes:');
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- __tests__/screens/recipe-detail.test.tsx`

Expected: the five new tests FAIL — `handleCopy` still emits the legacy `2-macro | cal | protein` form, doesn't include `kcal`/`P/C/F`, and doesn't append `Notes:`.

- [ ] **Step 3: Rewrite `handleCopy`**

In `app/recipe/[id].tsx`, find the existing `handleCopy` function (lines 100-114):

```tsx
const handleCopy = async () => {
  const text = [
    recipe.title,
    `Serves ${recipe.servings} | ${recipe.calories_per_serve} cal | ${recipe.protein_per_serve_g}g protein | ${recipe.cook_method} | ${timeLabel}`,
    '',
    'Ingredients:',
    ...recipe.ingredients.map((i) => `- ${formatAmount(i.amount)} ${i.item}`),
    '',
    'Method:',
    ...recipe.method_steps.map((s, idx) => `${idx + 1}. ${s}`),
  ].join('\n');
  await Clipboard.setStringAsync(text);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};
```

Replace with:

```tsx
const handleCopy = async () => {
  const macroStr = rollup
    ? `Serves ${recipe.servings} | ${prefix}${Math.round(rollup.perServe.cal)} kcal | P ${prefix}${Math.round(rollup.perServe.protein_g)}g | C ${prefix}${Math.round(rollup.perServe.carbs_g)}g | F ${prefix}${Math.round(rollup.perServe.fat_g)}g | ${recipe.cook_method} | ${timeLabel}`
    : `Serves ${recipe.servings} | ${recipe.calories_per_serve} kcal | P ${recipe.protein_per_serve_g}g | ${recipe.cook_method} | ${timeLabel}`;

  const trimmedNotes = recipe.notes?.trim();
  const notesBlock = trimmedNotes ? `\n\nNotes:\n${trimmedNotes}` : '';

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

  await Clipboard.setStringAsync(text);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};
```

`rollup` and `prefix` are already in scope at this point ([recipe/[id].tsx:56-57](app/recipe/[id].tsx#L56-L57)). No new imports needed.

- [ ] **Step 4: Run the tests, confirm they pass**

Run: `npm test -- __tests__/screens/recipe-detail.test.tsx`

Expected: all tests in both `describe` blocks PASS. If a clipboard test fails on the exact macro arithmetic, double-check the rounding behaviour — `Math.round` rounds to the nearest integer; 3.6 × 6 / 3 = 7.2 → 7, so `F 7g` is correct. The C/F values for chicken-only are intentional and verifiable by hand.

- [ ] **Step 5: Run the full suite**

Run: `npm test`

Expected: full green. Old recipe-screen tests (none today) and adjacent code paths (`rollupMacros`, `formatAmount`) remain untouched and still pass.

- [ ] **Step 6: Commit**

```bash
git add app/recipe/[id].tsx __tests__/screens/recipe-detail.test.tsx
git commit -m "$(cat <<'EOF'
feat(recipe-screen): include all four macros and notes in Copy recipe

handleCopy now reuses the rollup-driven per-serve macros (with ~
prefix when partial) and falls back to the legacy cal+protein shape
when no nutrition links exist. Recipe notes are appended as a
trailing 'Notes:' block when present. Output is now Claude-ready for
recipe-adjustment prompts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Manual smoke check on device

Automated tests cover migration, hook, sheet, screen wiring, and clipboard text. The remaining checks need eyes-on for visual placement, keyboard behaviour, and the actual clipboard contents.

- [ ] **Step 1: Boot the app**

Run: `npx expo start`

Open on iOS or Android simulator. Navigate to the Recipes tab and tap any recipe.

- [ ] **Step 2: Verify the header pill in both states**

- The pill appears at the top-right of the green header, balancing the `‹ Recipes` back button on the left.
- Recipe without notes: pill reads `+ Note`.
- Tap pill → bottom sheet slides up with the title `Notes — {recipe title}`, an empty multiline TextInput with placeholder `What worked, what to change next time…`, and a green `Save notes` button.
- Type a multi-line note. Tap `Save notes`. Sheet dismisses; pill flips to `✎ Note`; a `Notes` section appears below `Method` showing the saved text.
- Tap the Notes card. Same sheet opens, pre-filled. Edit the text. Save. The card updates.
- Tap pill again, clear the text fully, tap Save. Pill flips back to `+ Note`. Notes section disappears.

- [ ] **Step 3: Verify keyboard behaviour**

Tap pill on a small-screen device (or scale iOS simulator down). Keyboard opens. The TextInput stays above the keyboard. The Save button remains reachable; scrolling within the body works.

- [ ] **Step 4: Verify Copy recipe output**

Set notes to `"Sauce too thin — try cornstarch.\nDoubled the broccoli."`. Tap `Copy recipe` in the Method section header. Paste into a plain-text editor (Notes app, Messages, etc.). The output should look like:

```
{recipe title}
Serves N | XXX kcal | P NNg | C NNg | F NNg | {method} | {time}    (or ~ prefixed if partial)

Ingredients:
- ...

Method:
1. ...
2. ...

Notes:
Sauce too thin — try cornstarch.
Doubled the broccoli.
```

When notes are empty, the output should end with the last numbered method step (no trailing `Notes:`).

- [ ] **Step 5: Verify migration on an existing install (if applicable)**

If you have an existing development device or simulator with prior plan data:

- Confirm the app starts without crashing after the schema bump.
- Pull up any existing recipe — pill reads `+ Note`, notes section absent (existing recipes have `notes = NULL` from the migration).
- Use `expo-sqlite` debug to confirm `PRAGMA user_version` returns `5`.

- [ ] **Step 6: Commit any follow-up fixes**

If smoke-testing surfaces visual or behavioural issues (pill alignment, sheet padding, copy formatting), fix them and commit as follow-up. Otherwise, the work is complete.

---

## Notes for the executing engineer

- The recipe screen integration tests in Tasks 5–6 share a `mockRecipesState.current` object that gets mutated via `setNotes()` and direct ingredient/link overrides. Tests run sequentially in the same `describe`; if you add new tests, reset state in `beforeEach` to avoid leaking between cases.
- `CategoryHeader` may uppercase the visible text. The test asserts `getByText('Notes')` — if the component renders `NOTES`, the test still matches because react-native-testing-library's text matcher works against the raw `Text` children, not the styled output. If a test fails on case sensitivity, switch to `getByText(/Notes/i)`.
- The `recipe.notes` getter on the recipe object is `string | null`. Always `?.trim()` before length-checking — bare `recipe.notes?.length` would be true for whitespace-only strings.
- The sheet's `60% of window height` (vs `AddItemSheet`'s 72%) is chosen so the keyboard has more room. Tweak if it feels wrong on smaller devices.
