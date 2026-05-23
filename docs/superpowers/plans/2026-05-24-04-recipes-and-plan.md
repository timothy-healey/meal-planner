# Recipes & Plan Screens — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recipes list, Recipe Detail (with copy-to-clipboard), Sunday Batch Plan detail, and the Plan tab — all consuming real data from Plan 2's hooks.

**Architecture:** Three screens share purpose-built components: `RecipeCard`, `BatchPlanBanner`, `IngredientRow`, `TodayCard`, `DayCard`. `usePlan` returns an `ActivePlan` with pre-parsed fields (`days: DayPlan[]`, `batchSteps: BatchStep[]`, `meta: Meta`) — never re-parse JSON that the hook already parses. `useRecipes` returns a `Recipe` type with `ingredients: Ingredient[]` and `method_steps: string[]` already parsed. Recipe Detail reads from the pre-loaded `recipes` array (`.find()`) rather than calling the async `getById`.

**Tech Stack:** React Native, `expo-clipboard`, `expo-router`, hooks from Plan 2 (`usePlan`, `useRecipes`), UI primitives from Plan 1

**Prerequisite:** Plans 1, 2, and 3 complete.

**Hook contracts (from Plan 2 — read before writing any screen):**

```typescript
// usePlan() returns:
interface ActivePlan {
  row: WeeklyPlanRow;         // raw DB row (week_starting, etc.)
  meta: Meta;                  // parsed meta JSON
  strategy: Strategy;          // parsed strategy JSON
  days: DayPlan[];             // parsed meal_plan JSON — use plan.days, not JSON.parse
  batchSteps: BatchStep[];     // parsed sunday_batch_plan JSON — use plan.batchSteps
}

// useRecipes() returns:
interface Recipe {
  id: string; title: string; meal_type: ...; servings: number;
  calories_per_serve: number; protein_per_serve_g: number;
  cook_method: string; prep_minutes: number; cook_minutes: number;
  ingredients: Ingredient[];   // already parsed — NOT ingredients_json
  method_steps: string[];      // already parsed — NOT method_steps_json
  is_favourite: boolean;       // boolean, NOT 0|1
}
```

---

## File Map

| File | Responsibility |
|---|---|
| `components/RecipeCard.tsx` | White recipe card: name, cal · protein · time stats |
| `components/BatchPlanBanner.tsx` | Green banner: batch plan title, step count + start time |
| `components/IngredientRow.tsx` | Ingredient name (left) + amount (right, orange) |
| `components/TodayCard.tsx` | Green today card: day name, TODAY badge, B/L/D rows, footer |
| `components/DayCard.tsx` | White other-day card: day name, cal + protein, B/L/D inline, optional tap |
| `app/(tabs)/recipes.tsx` | Recipes list: BatchPlanBanner + meal_type groups |
| `app/recipe/[id].tsx` | Recipe detail: stat strip, ingredients, method, copy button |
| `app/batch-plan.tsx` | Batch plan detail: timed steps list |
| `app/(tabs)/plan.tsx` | Plan tab: Today card + other day cards + import button |
| `__tests__/components/RecipeCard.test.tsx` | Render + tap |
| `__tests__/components/TodayCard.test.tsx` | Render + TODAY badge |
| `__tests__/components/DayCard.test.tsx` | Render, B/L/D display, optional tap |

---

### Task 1: RecipeCard component

**Files:**
- Create: `components/RecipeCard.tsx`
- Create: `__tests__/components/RecipeCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

RecipeCard takes the `Recipe` type from `hooks/useRecipes` (pre-parsed ingredients/method_steps, `is_favourite` is boolean). Do NOT use `RecipeRow` from `types/db`.

```typescript
// __tests__/components/RecipeCard.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RecipeCard } from '../../components/RecipeCard';
import type { Recipe } from '../../hooks/useRecipes';

const RECIPE: Recipe = {
  id: 'beef_stew',
  title: 'Slow Cooker Beef Stew',
  meal_type: 'dinner',
  servings: 4,
  calories_per_serve: 480,
  protein_per_serve_g: 38,
  cook_method: 'crockpot',
  prep_minutes: 20,
  cook_minutes: 480,
  ingredients: [],
  method_steps: [],
  is_favourite: false,
};

describe('RecipeCard', () => {
  it('renders recipe title', () => {
    const { getByText } = render(<RecipeCard recipe={RECIPE} onPress={jest.fn()} />);
    expect(getByText('Slow Cooker Beef Stew')).toBeTruthy();
  });

  it('renders calorie value', () => {
    const { getByText } = render(<RecipeCard recipe={RECIPE} onPress={jest.fn()} />);
    expect(getByText('480 cal')).toBeTruthy();
  });

  it('renders protein value', () => {
    const { getByText } = render(<RecipeCard recipe={RECIPE} onPress={jest.fn()} />);
    expect(getByText('38g protein')).toBeTruthy();
  });

  it('renders time as Nh when cook_minutes >= 60', () => {
    const { getByText } = render(<RecipeCard recipe={RECIPE} onPress={jest.fn()} />);
    expect(getByText('8h')).toBeTruthy();
  });

  it('renders time as N min when cook_minutes < 60', () => {
    const quickRecipe: Recipe = { ...RECIPE, prep_minutes: 10, cook_minutes: 20 };
    const { getByText } = render(<RecipeCard recipe={quickRecipe} onPress={jest.fn()} />);
    expect(getByText('30 min')).toBeTruthy();
  });

  it('calls onPress when card is tapped', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<RecipeCard recipe={RECIPE} onPress={onPress} />);
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/components/RecipeCard.test.tsx
```

Expected: FAIL — `Cannot find module '../../components/RecipeCard'`

- [ ] **Step 3: Implement RecipeCard**

```typescript
// components/RecipeCard.tsx
import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { AppText } from './ui/AppText';
import { colors, spacing, radius, shadow } from '../constants/tokens';
import { formatCookTime } from '../lib/format';
import type { Recipe } from '../hooks/useRecipes';

interface Props {
  recipe: Recipe;
  onPress: () => void;
}

export function RecipeCard({ recipe, onPress }: Props) {
  const timeLabel = formatCookTime(recipe.prep_minutes, recipe.cook_minutes);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={recipe.title}
    >
      <AppText weight="bold" color="textPrimary" size="md">{recipe.title}</AppText>
      <View style={styles.stats}>
        <AppText weight="semibold" color="orange" size="sm">
          {recipe.calories_per_serve} cal
        </AppText>
        <AppText weight="regular" color="textTertiary" size="sm"> · </AppText>
        <AppText weight="semibold" color="textSecondary" size="sm">
          {recipe.protein_per_serve_g}g protein
        </AppText>
        <AppText weight="regular" color="textTertiary" size="sm"> · </AppText>
        <AppText weight="regular" color="textTertiary" size="sm">{timeLabel}</AppText>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing[4],
    gap: spacing[2],
    ...shadow.card,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/components/RecipeCard.test.tsx
```

Expected: PASS — 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add components/RecipeCard.tsx __tests__/components/RecipeCard.test.tsx
git commit -m "feat: add RecipeCard component"
```

---

### Task 2: BatchPlanBanner and IngredientRow components

**Files:**
- Create: `components/BatchPlanBanner.tsx`
- Create: `components/IngredientRow.tsx`

- [ ] **Step 1: Implement BatchPlanBanner**

`BatchStep` from `meal_plan.types` has `{ time: string; task: string }`. The banner receives the pre-parsed `batchSteps` from `usePlan().plan.batchSteps`.

```typescript
// components/BatchPlanBanner.tsx
import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { AppText } from './ui/AppText';
import { colors, spacing, radius } from '../constants/tokens';
import type { BatchStep } from '../meal_plan.types';

interface Props {
  steps: BatchStep[];
  onPress: () => void;
}

export function BatchPlanBanner({ steps, onPress }: Props) {
  const startTime = steps[0]?.time;
  const subLabel = startTime
    ? `${steps.length} steps · starts ${startTime}`
    : `${steps.length} steps`;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={styles.banner}
      accessibilityRole="button"
      accessibilityLabel="Sunday Batch Plan"
    >
      <View style={styles.textCol}>
        <AppText weight="extrabold" color="onGreen" size="lg">Sunday Batch Plan</AppText>
        <AppText weight="semibold" color="onGreenSubtle" size="sm">{subLabel}</AppText>
      </View>
      <AppText size="xl">🥘</AppText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.green,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  textCol: {
    flex: 1,
    gap: spacing[1],
  },
});
```

- [ ] **Step 2: Implement IngredientRow**

`Ingredient` from `meal_plan.types` has `{ item: string; amount: string }`.

```typescript
// components/IngredientRow.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from './ui/AppText';
import { Divider } from './ui/Divider';
import { spacing } from '../constants/tokens';
import type { Ingredient } from '../meal_plan.types';

interface Props {
  ingredient: Ingredient;
}

export function IngredientRow({ ingredient }: Props) {
  return (
    <>
      <View style={styles.row}>
        <AppText weight="semibold" color="textPrimary" size="md" style={styles.name}>
          {ingredient.item}
        </AppText>
        <AppText weight="bold" color="orange" size="md">{ingredient.amount}</AppText>
      </View>
      <Divider />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  name: {
    flex: 1,
    marginRight: spacing[3],
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add components/BatchPlanBanner.tsx components/IngredientRow.tsx
git commit -m "feat: add BatchPlanBanner and IngredientRow components"
```

---

### Task 3: Recipes list screen

**Files:**
- Modify: `app/(tabs)/recipes.tsx` (replace empty skeleton from Plan 1)

- [ ] **Step 1: Implement the Recipes list screen**

`usePlan().plan` is `ActivePlan | null`. Use `plan.batchSteps` (pre-parsed `BatchStep[]`) and `plan.row.week_starting` — never re-parse `batch_plan_json`.

```typescript
// app/(tabs)/recipes.tsx
import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { AppText } from '../../components/ui/AppText';
import { EmptyState } from '../../components/ui/EmptyState';
import { CategoryHeader } from '../../components/ui/CategoryHeader';
import { RecipeCard } from '../../components/RecipeCard';
import { BatchPlanBanner } from '../../components/BatchPlanBanner';
import { usePlan } from '../../hooks/usePlan';
import { useRecipes } from '../../hooks/useRecipes';
import { colors, spacing } from '../../constants/tokens';

const MEAL_TYPE_ORDER = ['dinner', 'lunch', 'breakfast', 'snack'];

export default function RecipesScreen() {
  const { plan } = usePlan();
  const { recipes } = useRecipes();

  if (!plan || recipes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <EmptyState onImport={() => router.push('/settings')} />
      </View>
    );
  }

  // plan.batchSteps is already a BatchStep[] — no JSON.parse needed
  const batchSteps = plan.batchSteps;

  // Group recipes by meal_type in display order
  const groups = MEAL_TYPE_ORDER.flatMap((mealType) => {
    const group = recipes.filter((r) => r.meal_type === mealType);
    return group.length > 0 ? [{ mealType, recipes: group }] : [];
  });
  // Append any unlisted meal types
  const knownTypes = new Set(MEAL_TYPE_ORDER);
  const extraGroups = Object.entries(
    recipes
      .filter((r) => !knownTypes.has(r.meal_type))
      .reduce<Record<string, typeof recipes>>((acc, r) => {
        (acc[r.meal_type] = acc[r.meal_type] ?? []).push(r);
        return acc;
      }, {})
  ).map(([mealType, recs]) => ({ mealType, recipes: recs }));

  const allGroups = [...groups, ...extraGroups];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {batchSteps.length > 0 && (
        <BatchPlanBanner
          steps={batchSteps}
          onPress={() => router.push('/batch-plan')}
        />
      )}

      {allGroups.map(({ mealType, recipes: groupRecipes }) => (
        <View key={mealType} style={styles.group}>
          <CategoryHeader label={mealType} isOneoff={false} />
          <View style={styles.cards}>
            {groupRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onPress={() => router.push(`/recipe/${recipe.id}`)}
              />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { paddingBottom: spacing[10] },
  emptyContainer: { flex: 1, backgroundColor: colors.cream },
  group: { marginTop: spacing[4] },
  cards: { gap: spacing[3], paddingHorizontal: spacing[4], paddingTop: spacing[2] },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/\(tabs\)/recipes.tsx
git commit -m "feat: implement Recipes list screen"
```

---

### Task 4: Recipe Detail screen

**Files:**
- Modify: `app/recipe/[id].tsx` (replace empty skeleton from Plan 1)

- [ ] **Step 1: Implement Recipe Detail**

`useRecipes` pre-parses `ingredients` and `method_steps` — no `JSON.parse` needed. Find the recipe by ID from the cached `recipes` array (synchronous `.find()`), not via async `getById`.

```typescript
// app/recipe/[id].tsx
import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { GreenHeader } from '../../components/ui/GreenHeader';
import { AppText } from '../../components/ui/AppText';
import { StatStrip } from '../../components/ui/StatStrip';
import { StepList } from '../../components/ui/StepList';
import { CategoryHeader } from '../../components/ui/CategoryHeader';
import { IngredientRow } from '../../components/IngredientRow';
import { useRecipes } from '../../hooks/useRecipes';
import { formatCookTime } from '../../lib/format';
import { colors, spacing, radius } from '../../constants/tokens';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Find recipe from the already-loaded recipes array — synchronous, no extra DB query
  const { recipes } = useRecipes();
  const recipe = recipes.find((r) => r.id === id) ?? null;
  const [copied, setCopied] = useState(false);

  if (!recipe) {
    return (
      <View style={styles.notFound}>
        <AppText weight="semibold" color="textSecondary">Recipe not found.</AppText>
      </View>
    );
  }

  // recipe.ingredients is already Ingredient[] (pre-parsed by useRecipes)
  // recipe.method_steps is already string[] (pre-parsed by useRecipes)
  const timeLabel = formatCookTime(recipe.prep_minutes, recipe.cook_minutes);

  const buildCopyText = () =>
    [
      recipe.title,
      `Serves ${recipe.servings} | ${recipe.calories_per_serve} cal | ${recipe.protein_per_serve_g}g protein | ${recipe.cook_method} | ${timeLabel}`,
      '',
      'Ingredients:',
      ...recipe.ingredients.map((i) => `- ${i.amount} ${i.item}`),
      '',
      'Method:',
      ...recipe.method_steps.map((s, idx) => `${idx + 1}. ${s}`),
    ].join('\n');

  const handleCopy = async () => {
    await Clipboard.setStringAsync(buildCopyText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statItems = [
    { label: 'Cal', value: String(recipe.calories_per_serve), highlight: true },
    { label: 'Protein', value: `${recipe.protein_per_serve_g}g`, highlight: false },
    { label: 'Serves', value: String(recipe.servings), highlight: false },
    { label: 'Cook', value: timeLabel, highlight: false },
  ];

  return (
    <View style={styles.container}>
      <GreenHeader>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back to Recipes"
          >
            <AppText weight="bold" color="onGreenSubtle" size="sm">‹ Recipes</AppText>
          </TouchableOpacity>
          <AppText weight="extrabold" color="onGreen" size="2xl" numberOfLines={2}>
            {recipe.title}
          </AppText>
        </View>
      </GreenHeader>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <StatStrip items={statItems} />

        <View style={styles.section}>
          <CategoryHeader label="Ingredients" isOneoff={false} />
          <View style={styles.card}>
            {recipe.ingredients.map((ing, idx) => (
              <IngredientRow key={idx} ingredient={ing} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.methodHeader}>
            <CategoryHeader label="Method" isOneoff={false} />
            <TouchableOpacity
              onPress={handleCopy}
              style={styles.copyBtn}
              accessibilityRole="button"
              accessibilityLabel="Copy recipe to clipboard"
            >
              <AppText weight="bold" color="onGreen" size="2xs">
                {copied ? 'Copied!' : '📋 Copy recipe'}
              </AppText>
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            <StepList steps={recipe.method_steps} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cream },
  headerContent: { paddingHorizontal: spacing[4], paddingBottom: spacing[4], gap: spacing[2] },
  backBtn: { paddingVertical: spacing[3], paddingRight: spacing[4], alignSelf: 'flex-start' },
  body: { flex: 1 },
  bodyContent: { paddingBottom: spacing[10], gap: spacing[4] },
  section: { gap: spacing[2], paddingHorizontal: spacing[4] },
  card: { backgroundColor: colors.card, borderRadius: radius.md, overflow: 'hidden' },
  methodHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  copyBtn: {
    backgroundColor: colors.green,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.xl,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/recipe/\[id\].tsx
git commit -m "feat: implement Recipe Detail screen with copy-to-clipboard"
```

---

### Task 5: Batch Plan Detail screen

**Files:**
- Modify: `app/batch-plan.tsx` (replace empty skeleton from Plan 1)

- [ ] **Step 1: Implement Batch Plan Detail**

`plan.batchSteps` is already a `BatchStep[]` — no `JSON.parse` needed.

```typescript
// app/batch-plan.tsx
import React from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { GreenHeader } from '../components/ui/GreenHeader';
import { AppText } from '../components/ui/AppText';
import { Divider } from '../components/ui/Divider';
import { usePlan } from '../hooks/usePlan';
import { colors, spacing, radius } from '../constants/tokens';

export default function BatchPlanScreen() {
  const { plan } = usePlan();
  // plan.batchSteps is BatchStep[] — already parsed
  const steps = plan?.batchSteps ?? [];

  return (
    <View style={styles.container}>
      <GreenHeader>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back to Recipes"
          >
            <AppText weight="bold" color="onGreenSubtle" size="sm">‹ Recipes</AppText>
          </TouchableOpacity>
          <AppText weight="extrabold" color="onGreen" size="xl">Sunday Batch Plan</AppText>
        </View>
      </GreenHeader>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.card}>
          {steps.map((step, idx) => (
            <View key={idx}>
              <View style={styles.stepRow}>
                <AppText weight="bold" color="terracotta" size="md" style={styles.time}>
                  {step.time}
                </AppText>
                <AppText weight="semibold" color="textPrimary" size="md" style={styles.task}>
                  {step.task}
                </AppText>
              </View>
              {idx < steps.length - 1 && <Divider />}
            </View>
          ))}
          {steps.length === 0 && (
            <AppText weight="regular" color="textSecondary" size="md" style={styles.empty}>
              No batch plan steps for this week.
            </AppText>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  headerContent: { paddingHorizontal: spacing[4], paddingBottom: spacing[4], gap: spacing[2] },
  backBtn: { paddingVertical: spacing[3], paddingRight: spacing[4], alignSelf: 'flex-start' },
  body: { flex: 1 },
  bodyContent: { padding: spacing[4], paddingBottom: spacing[10] },
  card: { backgroundColor: colors.card, borderRadius: radius.md, overflow: 'hidden' },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    gap: spacing[4],
  },
  time: { width: 64, flexShrink: 0 },
  task: { flex: 1 },
  empty: { padding: spacing[4], textAlign: 'center' },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/batch-plan.tsx
git commit -m "feat: implement Batch Plan Detail screen"
```

---

### Task 6: TodayCard and DayCard components

**Files:**
- Create: `components/TodayCard.tsx`
- Create: `components/DayCard.tsx`
- Create: `__tests__/components/TodayCard.test.tsx`
- Create: `__tests__/components/DayCard.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/components/TodayCard.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { TodayCard } from '../../components/TodayCard';

const DAY = {
  day: 'Monday',
  breakfast: 'Overnight oats',
  lunch: 'Chicken burrito',
  dinner: 'Beef stew',
  calories: 2000,
  protein_g: 140,
};

describe('TodayCard', () => {
  it('renders day name', () => {
    const { getByText } = render(<TodayCard day={DAY} />);
    expect(getByText('Monday')).toBeTruthy();
  });

  it('renders TODAY badge', () => {
    const { getByText } = render(<TodayCard day={DAY} />);
    expect(getByText('TODAY')).toBeTruthy();
  });

  it('renders B/L/D meal names', () => {
    const { getByText } = render(<TodayCard day={DAY} />);
    expect(getByText('Overnight oats')).toBeTruthy();
    expect(getByText('Chicken burrito')).toBeTruthy();
    expect(getByText('Beef stew')).toBeTruthy();
  });

  it('renders calorie value in footer', () => {
    const { getByText } = render(<TodayCard day={DAY} />);
    expect(getByText('2000 cal')).toBeTruthy();
  });

  it('renders protein value in footer', () => {
    const { getByText } = render(<TodayCard day={DAY} />);
    expect(getByText('140g protein')).toBeTruthy();
  });
});
```

```typescript
// __tests__/components/DayCard.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DayCard } from '../../components/DayCard';

const DAY = {
  day: 'Tuesday',
  breakfast: 'Overnight oats',
  lunch: 'Tuna wrap',
  dinner: 'Chicken soup',
  calories: 2000,
  protein_g: 138,
};

describe('DayCard', () => {
  it('renders day name', () => {
    const { getByText } = render(<DayCard day={DAY} isFirst={false} isLast={false} />);
    expect(getByText('Tuesday')).toBeTruthy();
  });

  it('renders cal and protein', () => {
    const { getByText } = render(<DayCard day={DAY} isFirst={false} isLast={false} />);
    expect(getByText('2000 cal')).toBeTruthy();
    expect(getByText('138g protein')).toBeTruthy();
  });

  it('renders B / L / D meal names', () => {
    const { getByText } = render(<DayCard day={DAY} isFirst={false} isLast={false} />);
    expect(getByText('Overnight oats')).toBeTruthy();
    expect(getByText('Tuna wrap')).toBeTruthy();
    expect(getByText('Chicken soup')).toBeTruthy();
  });

  it('renders B / L / D prefix letters', () => {
    const { getAllByText } = render(<DayCard day={DAY} isFirst={false} isLast={false} />);
    expect(getAllByText('B').length).toBeGreaterThan(0);
    expect(getAllByText('L').length).toBeGreaterThan(0);
    expect(getAllByText('D').length).toBeGreaterThan(0);
  });

  it('calls onPress when tapped and onPress is provided', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <DayCard day={DAY} isFirst={false} isLast={false} onPress={onPress} />
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not render as a button when onPress is absent', () => {
    const { queryByRole } = render(<DayCard day={DAY} isFirst={false} isLast={false} />);
    expect(queryByRole('button')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/components/TodayCard.test.tsx __tests__/components/DayCard.test.tsx
```

Expected: FAIL — modules not found

- [ ] **Step 3: Implement TodayCard**

```typescript
// components/TodayCard.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from './ui/AppText';
import { colors, spacing, radius } from '../constants/tokens';

interface DayData {
  day: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  calories: number;
  protein_g: number;
}

interface Props {
  day: DayData;
}

export function TodayCard({ day }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppText weight="extrabold" color="onGreen" size="lg">{day.day}</AppText>
        <View style={styles.badge}>
          <AppText weight="bold" color="orange" size="2xs">TODAY</AppText>
        </View>
      </View>

      <View style={styles.meals}>
        <MealRow letter="B" meal={day.breakfast} />
        <MealRow letter="L" meal={day.lunch} />
        <MealRow letter="D" meal={day.dinner} />
      </View>

      <View style={styles.footer}>
        <AppText weight="bold" color="orange" size="sm">{day.calories} cal</AppText>
        <AppText weight="semibold" color="onGreenSubtle" size="sm">{day.protein_g}g protein</AppText>
      </View>
    </View>
  );
}

function MealRow({ letter, meal }: { letter: string; meal: string }) {
  return (
    <View style={styles.mealRow}>
      <AppText weight="bold" color="onGreen" size="md" style={styles.letter}>{letter}</AppText>
      <AppText weight="medium" color="onGreenSubtle" size="md" style={styles.mealName}>{meal}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.green,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
  },
  badge: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 9999,
  },
  meals: {
    paddingHorizontal: spacing[4],
    gap: spacing[2],
    paddingBottom: spacing[3],
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  letter: { width: 16 },
  mealName: { flex: 1 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
});
```

- [ ] **Step 4: Implement DayCard**

`onPress` is optional — the Plan screen passes it when the day has a `batch_ref` recipe.

```typescript
// components/DayCard.tsx
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText } from './ui/AppText';
import { colors, spacing, radius } from '../constants/tokens';

interface DayData {
  day: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  calories: number;
  protein_g: number;
}

interface Props {
  day: DayData;
  isFirst: boolean;
  isLast: boolean;
  onPress?: () => void;
}

export function DayCard({ day, isFirst, isLast, onPress }: Props) {
  const borderRadius = {
    borderTopLeftRadius: isFirst ? radius.md : 3,
    borderTopRightRadius: isFirst ? radius.md : 3,
    borderBottomLeftRadius: isLast ? radius.md : 3,
    borderBottomRightRadius: isLast ? radius.md : 3,
  };

  const inner = (
    <>
      <View style={styles.topRow}>
        <AppText weight="bold" color="textPrimary" size="md">{day.day}</AppText>
        <View style={styles.stats}>
          <AppText weight="semibold" color="orange" size="sm">{day.calories} cal</AppText>
          <AppText weight="regular" color="textTertiary" size="sm"> · </AppText>
          <AppText weight="semibold" color="textSecondary" size="sm">{day.protein_g}g protein</AppText>
        </View>
      </View>
      <View style={styles.mealsRow}>
        <MealLabel letter="B" meal={day.breakfast} />
        <MealLabel letter="L" meal={day.lunch} />
        <MealLabel letter="D" meal={day.dinner} />
      </View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[styles.card, borderRadius]}
        accessibilityRole="button"
        accessibilityLabel={`${day.day}, tap to view recipe`}
      >
        {inner}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.card, borderRadius]}>{inner}</View>;
}

function MealLabel({ letter, meal }: { letter: string; meal: string }) {
  return (
    <View style={styles.mealLabel}>
      <AppText weight="bold" color="terracotta" size="sm">{letter}</AppText>
      <AppText weight="regular" color="textSecondary" size="sm"> {meal}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[2],
    marginBottom: 1,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stats: { flexDirection: 'row', alignItems: 'center' },
  mealsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  mealLabel: { flexDirection: 'row', alignItems: 'center' },
});
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest __tests__/components/TodayCard.test.tsx __tests__/components/DayCard.test.tsx
```

Expected: PASS — 11 tests pass total

- [ ] **Step 6: Commit**

```bash
git add components/TodayCard.tsx components/DayCard.tsx \
  __tests__/components/TodayCard.test.tsx __tests__/components/DayCard.test.tsx
git commit -m "feat: add TodayCard and DayCard components"
```

---

### Task 7: Plan screen

**Files:**
- Modify: `app/(tabs)/plan.tsx` (replace empty skeleton from Plan 1)

- [ ] **Step 1: Implement the Plan screen**

Key data notes:
- `plan.days` is already `DayPlan[]` — each day has `d.meals.breakfast.name`, `d.meals.lunch.name`, `d.meals.dinner.name`, and `d.meals.dinner.batch_ref` (optional recipe ID linking to a recipe)
- `plan.meta` is already parsed — access `plan.meta.week_starting` via `plan.row.week_starting` (both available; use `row.week_starting` to keep `meta` and `row` concerns separate)
- Calorie target: use `plan.days[0]?.calories` — the `daily_targets` field from the JSON is not stored separately, but each `DayPlan.calories` equals the day's target
- Date parsing: `new Date("2026-05-24")` parses as UTC midnight, which breaks comparisons in Adelaide (UTC+9:30); parse as local date instead

```typescript
// app/(tabs)/plan.tsx
import React from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { AppText } from '../../components/ui/AppText';
import { EmptyState } from '../../components/ui/EmptyState';
import { TodayCard } from '../../components/TodayCard';
import { DayCard } from '../../components/DayCard';
import { usePlan } from '../../hooks/usePlan';
import { colors, spacing, radius, shadow } from '../../constants/tokens';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface DisplayDay {
  day: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  calories: number;
  protein_g: number;
  batchRef: string | null;
}

/** Parse "YYYY-MM-DD" as local midnight — avoids UTC offset bugs in timezones like Adelaide */
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function PlanScreen() {
  const { plan } = usePlan();

  if (!plan) {
    return (
      <View style={styles.emptyContainer}>
        <EmptyState onImport={() => router.push('/settings')} />
      </View>
    );
  }

  // plan.days is DayPlan[] — already parsed, access d.meals.breakfast.name etc.
  const calTarget: number = plan.days[0]?.calories ?? 2000;

  const days: DisplayDay[] = plan.days.map((d, idx) => ({
    day: DAY_NAMES[idx] ?? d.day,
    breakfast: d.meals?.breakfast?.name ?? '—',
    lunch: d.meals?.lunch?.name ?? '—',
    dinner: d.meals?.dinner?.name ?? '—',
    calories: d.calories ?? 0,
    protein_g: d.protein_g ?? 0,
    // Navigate to whichever meal has a batch_ref (dinner first, then lunch, then breakfast)
    batchRef:
      (d.meals?.dinner?.batch_ref as string | undefined) ??
      (d.meals?.lunch?.batch_ref as string | undefined) ??
      (d.meals?.breakfast?.batch_ref as string | undefined) ??
      null,
  }));

  // today's day index (0=Sun … 6=Sat) maps directly to days array index
  const todayIndex = new Date().getDay();

  // Parse plan start as local midnight to avoid UTC timezone offset bugs
  const planStart = parseLocalDate(plan.row.week_starting);
  const planEnd = new Date(planStart.getFullYear(), planStart.getMonth(), planStart.getDate() + 7);
  const todayLocal = (() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  })();
  const isTodayInPlan = todayLocal >= planStart && todayLocal < planEnd;

  // Format week range: "DD–DD MMM" in uppercase
  const startDay = planStart.getDate();
  const endDate = new Date(planStart.getFullYear(), planStart.getMonth(), planStart.getDate() + 6);
  const endDay = endDate.getDate();
  const monthShort = planStart.toLocaleString('en-AU', { month: 'short' });
  const weekRange = `${startDay}–${endDay} ${monthShort.toUpperCase()}`;

  const todayDay = isTodayInPlan ? days[todayIndex] : null;
  const otherDays = days.filter((_, idx) => !isTodayInPlan || idx !== todayIndex);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top row: week range + cal target + import button */}
      <View style={styles.topRow}>
        <View>
          <AppText weight="bold" color="terracotta" size="sm" style={styles.weekLabel}>
            {weekRange}
          </AppText>
          <AppText weight="semibold" color="textSecondary" size="xs">
            {calTarget} cal target
          </AppText>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/settings')}
          style={styles.importBtn}
          accessibilityRole="button"
          accessibilityLabel="Import new meal plan"
        >
          <AppText weight="bold" color="green" size="2xs">📂 Import</AppText>
        </TouchableOpacity>
      </View>

      {todayDay && <TodayCard day={todayDay} />}

      <View style={styles.otherDays}>
        {otherDays.map((day, idx) => (
          <DayCard
            key={day.day}
            day={day}
            isFirst={idx === 0}
            isLast={idx === otherDays.length - 1}
            onPress={day.batchRef ? () => router.push(`/recipe/${day.batchRef}`) : undefined}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { paddingBottom: spacing[10] },
  emptyContainer: { flex: 1, backgroundColor: colors.cream },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[6],
    paddingBottom: spacing[2],
  },
  weekLabel: { letterSpacing: 0.3, textTransform: 'uppercase' },
  importBtn: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.xl,
    ...shadow.pill,
  },
  otherDays: {
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    borderRadius: radius.md,
    overflow: 'hidden',
  },
});
```

- [ ] **Step 2: Run all tests to confirm nothing is broken**

```bash
npx jest
```

Expected: All tests pass.

- [ ] **Step 3: Manual verification**

Start the dev server and verify on device/emulator:

1. **Recipes tab:**
   - Batch Plan banner appears at top with step count + "starts HH:MM"
   - Tapping banner opens Batch Plan detail with time | task rows
   - Recipes grouped: Dinner / Lunch / Breakfast
   - Tapping a recipe card opens Recipe Detail
   - Recipe Detail shows stat strip (Cal/Protein/Serves/Cook), ingredients (name left, amount right in orange), numbered method steps (green circles, last circle orange)
   - "📋 Copy recipe" button changes to "Copied!" for 2 s then reverts
   - "‹ Recipes" back link returns to Recipes list

2. **Plan tab:**
   - Week range in uppercase terracotta at top, calorie target below
   - Today card (green) shows correct day with B / L / D meals and cal + protein in footer
   - Other days as stacked white cards with B · L · D inline; days with batch_ref meals are tappable and navigate to their recipe
   - If today is outside the plan week, all cards are white
   - "📂 Import" button opens Settings

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/plan.tsx
git commit -m "feat: implement Plan screen"
```

---

### Final: run full test suite

- [ ] **Step 1: Run all tests**

```bash
npx jest --coverage
```

Expected: All tests across Plans 1–4 pass. Coverage report shows lib/ and components/ui/ well covered.

- [ ] **Step 2: Final commit**

```bash
git add .
git commit -m "chore: complete Plans 3 and 4 — full app implemented"
```
