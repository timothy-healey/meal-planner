# Haptics + Skeleton Loading States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add light-impact haptic feedback to action buttons across all screens, and add shimmer skeleton loading screens to the three main tabs (Plan, Shop, Recipes).

**Architecture:** Haptics are added directly at each call site using `expo-haptics` (already installed). Skeletons use a single `Skeleton` Reanimated atom composed into three screen-specific components; each tab screen checks its hook's `loading` state and renders the skeleton in place of content.

**Tech Stack:** `expo-haptics`, `react-native-reanimated` (already installed), `@testing-library/react-native` (Jest, already configured)

---

## File Map

**Create:**
- `components/ui/Skeleton.tsx` — animated shimmer rectangle atom
- `components/ui/PlanSkeleton.tsx` — skeleton layout for Plan tab
- `components/ui/ShopSkeleton.tsx` — skeleton layout for Shop tab
- `components/ui/RecipesSkeleton.tsx` — skeleton layout for Recipes tab
- `__tests__/components/ui/Skeleton.test.tsx` — Skeleton atom tests
- `__tests__/components/ui/PlanSkeleton.test.tsx`
- `__tests__/components/ui/ShopSkeleton.test.tsx`
- `__tests__/components/ui/RecipesSkeleton.test.tsx`

**Modify:**
- `components/ui/Pill.tsx` — add haptic on press
- `app/category-order.tsx` — Done, Reset, drag begin haptics
- `app/barcode-scanner.tsx` — Use, Continue, Scan again, Grant Access haptics
- `app/recipe/[id].tsx` — Copy recipe haptic
- `components/IngredientRow.tsx` — onPress haptic
- `app/(tabs)/plan.tsx` — integrate PlanSkeleton
- `app/(tabs)/shop.tsx` — integrate ShopSkeleton
- `app/(tabs)/recipes.tsx` — integrate RecipesSkeleton

---

## Part 1: Haptics

---

### Task 1: Pill component haptic

**Files:**
- Modify: `components/ui/Pill.tsx`
- Test: `__tests__/components/ui/Pill.test.tsx` (create)

- [ ] **Write the failing test**

```tsx
// __tests__/components/ui/Pill.test.tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Pill } from '../../../components/ui/Pill';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

describe('Pill', () => {
  it('fires light haptic on press', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<Pill label="Save" onPress={onPress} />);
    fireEvent.press(getByRole('button'));
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
  });

  it('still calls onPress after haptic', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<Pill label="Save" onPress={onPress} />);
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Run test to confirm it fails**

```bash
npx jest __tests__/components/ui/Pill.test.tsx --no-coverage
```

Expected: FAIL — `Haptics.impactAsync` not called

- [ ] **Update `components/ui/Pill.tsx`**

```tsx
import React from 'react';
import { TouchableOpacity, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AppText } from './AppText';
import { colors, radius, shadow, spacing } from '../../constants/tokens';

interface PillProps {
  label: string;
  onPress?: () => void;
  variant?: 'green' | 'white';
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function Pill({ label, onPress, variant = 'white', style, accessibilityLabel }: PillProps) {
  const bg = variant === 'green' ? colors.green : colors.card;
  const textColor = variant === 'green' ? 'onGreen' as const : 'green' as const;
  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      style={[
        {
          backgroundColor: bg,
          borderRadius: radius.xl,
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[2],
          minHeight: 44,
          justifyContent: 'center',
          alignItems: 'center',
          ...shadow.pill,
        },
        style,
      ]}
    >
      <AppText weight="bold" size="sm" color={textColor}>{label}</AppText>
    </TouchableOpacity>
  );
}
```

- [ ] **Run test to confirm it passes**

```bash
npx jest __tests__/components/ui/Pill.test.tsx --no-coverage
```

Expected: PASS

- [ ] **Commit**

```bash
git add components/ui/Pill.tsx __tests__/components/ui/Pill.test.tsx
git commit -m "feat: add haptic feedback to Pill component"
```

---

### Task 2: Category order screen haptics

**Files:**
- Modify: `app/category-order.tsx`

- [ ] **Add `expo-haptics` import to `app/category-order.tsx`**

Add after the existing imports:

```tsx
import * as Haptics from 'expo-haptics';
```

- [ ] **Add haptic to Done button**

Find the Done `TouchableOpacity` (currently `onPress={handleDone}`) and wrap:

```tsx
<TouchableOpacity
  onPress={() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleDone();
  }}
  style={styles.doneBtn}
  accessibilityRole="button"
>
```

- [ ] **Add haptic to Reset button**

Find the Reset `TouchableOpacity` (currently `onPress={handleReset}`) and wrap:

```tsx
<TouchableOpacity
  onPress={() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleReset();
  }}
  style={styles.resetBtn}
  accessibilityRole="button"
>
```

- [ ] **Add haptic on drag begin**

`DraggableFlatList` supports an `onDragBegin` callback. Add it to the `<DraggableFlatList>` element:

```tsx
<DraggableFlatList
  data={draggable}
  renderItem={renderItem}
  keyExtractor={(item) => item.name}
  onDragEnd={({ data }) => setDraggable(data)}
  onDragBegin={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
  ListFooterComponent={...}
/>
```

- [ ] **Commit**

```bash
git add app/category-order.tsx
git commit -m "feat: add haptic feedback to category order screen"
```

---

### Task 3: Barcode scanner haptics

**Files:**
- Modify: `app/barcode-scanner.tsx`

- [ ] **Add `expo-haptics` import**

```tsx
import * as Haptics from 'expo-haptics';
```

- [ ] **Add haptic to Grant Access button**

Find `onPress={requestPermission}` and wrap:

```tsx
onPress={() => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  requestPermission();
}}
```

- [ ] **Add haptic to Use button**

Find `onPress={handleUse}` on the matched record button and wrap:

```tsx
onPress={() => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  handleUse();
}}
```

- [ ] **Add haptic to Scan again**

Find `onPress={() => setScanned(false)}` and wrap:

```tsx
onPress={() => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  setScanned(false);
}}
```

- [ ] **Add haptic to Continue button**

Find the second `onPress={handleUse}` (the no-match Continue button) and wrap:

```tsx
onPress={() => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  handleUse();
}}
```

- [ ] **Commit**

```bash
git add app/barcode-scanner.tsx
git commit -m "feat: add haptic feedback to barcode scanner actions"
```

---

### Task 4: Recipe detail copy button haptic

**Files:**
- Modify: `app/recipe/[id].tsx`

- [ ] **Add `expo-haptics` import**

```tsx
import * as Haptics from 'expo-haptics';
```

- [ ] **Add haptic to `handleCopy`**

The existing `handleCopy` function at the top of the component:

```tsx
const handleCopy = async () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  const text = [
    recipe.title,
    `Serves ${recipe.servings} | ${recipe.calories_per_serve} cal | ${recipe.protein_per_serve_g}g protein | ${recipe.cook_method} | ${timeLabel}`,
    '',
    'Ingredients:',
    ...recipe.ingredients.map((i) => `- ${i.amount} ${i.item}`),
    '',
    'Method:',
    ...recipe.method_steps.map((s, idx) => `${idx + 1}. ${s}`),
  ].join('\n');
  await Clipboard.setStringAsync(text);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};
```

- [ ] **Commit**

```bash
git add "app/recipe/[id].tsx"
git commit -m "feat: add haptic feedback to recipe copy button"
```

---

### Task 5: IngredientRow onPress haptic

**Files:**
- Modify: `components/IngredientRow.tsx`

- [ ] **Add `expo-haptics` import**

```tsx
import * as Haptics from 'expo-haptics';
```

- [ ] **Wrap the TouchableOpacity onPress**

Find the `onPress` prop on the `TouchableOpacity` wrapper (the one that wraps `inner`):

```tsx
<TouchableOpacity
  onPress={() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }}
  activeOpacity={0.7}
  accessibilityRole="button"
  accessibilityLabel={ingredient.item}
  accessibilityHint={nutrition ? 'Tap to edit nutrition data' : 'Tap to add nutrition data'}
>
```

- [ ] **Commit**

```bash
git add components/IngredientRow.tsx
git commit -m "feat: add haptic feedback to ingredient row nutrition tap"
```

---

## Part 2: Skeleton Loading States

---

### Task 6: Skeleton atom

**Files:**
- Create: `components/ui/Skeleton.tsx`
- Create: `__tests__/components/ui/Skeleton.test.tsx`

- [ ] **Write the failing test**

```tsx
// __tests__/components/ui/Skeleton.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { Skeleton } from '../../../components/ui/Skeleton';

jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock')
);

describe('Skeleton', () => {
  it('renders with given width and height', () => {
    const { getByTestId } = render(
      <Skeleton testID="skel" width={200} height={20} />
    );
    const el = getByTestId('skel');
    expect(el).toBeTruthy();
  });

  it('applies borderRadius prop', () => {
    const { getByTestId } = render(
      <Skeleton testID="skel" width={100} height={10} borderRadius={8} />
    );
    const el = getByTestId('skel');
    const flatStyle = Array.isArray(el.props.style)
      ? Object.assign({}, ...el.props.style)
      : el.props.style;
    expect(flatStyle.borderRadius).toBe(8);
  });
});
```

- [ ] **Run test to confirm it fails**

```bash
npx jest __tests__/components/ui/Skeleton.test.tsx --no-coverage
```

Expected: FAIL — `Skeleton` not found

- [ ] **Create `components/ui/Skeleton.tsx`**

```tsx
import React, { useEffect } from 'react';
import { ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { colors, radius } from '../../constants/tokens';

interface SkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
  testID?: string;
}

export function Skeleton({ width, height, borderRadius = radius.xs, style, testID }: SkeletonProps) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.9, { duration: 900 }), -1, true);
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      testID={testID}
      style={[
        { width, height, borderRadius, backgroundColor: colors.divider },
        animStyle,
        style,
      ]}
    />
  );
}
```

- [ ] **Run test to confirm it passes**

```bash
npx jest __tests__/components/ui/Skeleton.test.tsx --no-coverage
```

Expected: PASS

- [ ] **Commit**

```bash
git add components/ui/Skeleton.tsx __tests__/components/ui/Skeleton.test.tsx
git commit -m "feat: add Skeleton shimmer atom"
```

---

### Task 7: PlanSkeleton

**Files:**
- Create: `components/ui/PlanSkeleton.tsx`
- Create: `__tests__/components/ui/PlanSkeleton.test.tsx`

- [ ] **Write the failing test**

```tsx
// __tests__/components/ui/PlanSkeleton.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { PlanSkeleton } from '../../../components/ui/PlanSkeleton';

jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock')
);

describe('PlanSkeleton', () => {
  it('renders without crashing', () => {
    const { getByTestId } = render(<PlanSkeleton />);
    expect(getByTestId('plan-skeleton')).toBeTruthy();
  });
});
```

- [ ] **Run test to confirm it fails**

```bash
npx jest __tests__/components/ui/PlanSkeleton.test.tsx --no-coverage
```

Expected: FAIL — `PlanSkeleton` not found

- [ ] **Create `components/ui/PlanSkeleton.tsx`**

```tsx
import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Skeleton } from './Skeleton';
import { colors, spacing, radius } from '../../constants/tokens';

export function PlanSkeleton() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.outer} testID="plan-skeleton">
      <ScrollView
        style={[styles.container, { marginTop: insets.top }]}
        contentContainerStyle={styles.content}
        scrollEnabled={false}
      >
        {/* TodayCard stand-in */}
        <View style={styles.todayCard}>
          <Skeleton width={120} height={14} borderRadius={4} style={styles.todayLabel} />
          <Skeleton width="90%" height={18} borderRadius={4} style={styles.todayMeal} />
          <Skeleton width="70%" height={18} borderRadius={4} style={styles.todayMeal} />
          <Skeleton width="80%" height={18} borderRadius={4} style={styles.todayMeal} />
        </View>

        {/* DayCard rows */}
        <View style={styles.dayRows}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={styles.dayRow}>
              <Skeleton width={80} height={14} borderRadius={4} />
              <View style={styles.dayMeals}>
                <Skeleton width="30%" height={12} borderRadius={4} />
                <Skeleton width="30%" height={12} borderRadius={4} />
                <Skeleton width="30%" height={12} borderRadius={4} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: colors.green },
  container: { flex: 1, backgroundColor: colors.cream },
  content: { paddingBottom: spacing[10] },
  todayCard: {
    backgroundColor: colors.green,
    borderRadius: radius.md,
    margin: spacing[4],
    padding: spacing[4],
    gap: spacing[2],
    opacity: 0.5,
  },
  todayLabel: { marginBottom: spacing[1] },
  todayMeal: {},
  dayRows: {
    marginHorizontal: spacing[4],
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    gap: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  dayMeals: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing[2],
  },
});
```

- [ ] **Run test to confirm it passes**

```bash
npx jest __tests__/components/ui/PlanSkeleton.test.tsx --no-coverage
```

Expected: PASS

- [ ] **Commit**

```bash
git add components/ui/PlanSkeleton.tsx __tests__/components/ui/PlanSkeleton.test.tsx
git commit -m "feat: add PlanSkeleton loading state"
```

---

### Task 8: ShopSkeleton

**Files:**
- Create: `components/ui/ShopSkeleton.tsx`
- Create: `__tests__/components/ui/ShopSkeleton.test.tsx`

- [ ] **Write the failing test**

```tsx
// __tests__/components/ui/ShopSkeleton.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { ShopSkeleton } from '../../../components/ui/ShopSkeleton';

jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock')
);

describe('ShopSkeleton', () => {
  it('renders without crashing', () => {
    const { getByTestId } = render(<ShopSkeleton />);
    expect(getByTestId('shop-skeleton')).toBeTruthy();
  });
});
```

- [ ] **Run test to confirm it fails**

```bash
npx jest __tests__/components/ui/ShopSkeleton.test.tsx --no-coverage
```

Expected: FAIL — `ShopSkeleton` not found

- [ ] **Create `components/ui/ShopSkeleton.tsx`**

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Skeleton } from './Skeleton';
import { colors, spacing, radius } from '../../constants/tokens';

function SkeletonItemRow() {
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemCheck} />
      <View style={styles.itemContent}>
        <Skeleton width="60%" height={15} borderRadius={4} />
        <Skeleton width="30%" height={11} borderRadius={4} style={styles.itemSub} />
      </View>
    </View>
  );
}

function SkeletonCategoryGroup() {
  return (
    <View style={styles.group}>
      <View style={styles.categoryHeader}>
        <Skeleton width={90} height={11} borderRadius={4} />
      </View>
      <View style={styles.groupItems}>
        <SkeletonItemRow />
        <SkeletonItemRow />
        <SkeletonItemRow />
      </View>
    </View>
  );
}

export function ShopSkeleton() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="shop-skeleton">
      {/* Header area */}
      <View style={styles.header}>
        <Skeleton width={160} height={28} borderRadius={4} />
        <Skeleton width={80} height={14} borderRadius={4} style={styles.headerSub} />
        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Skeleton width="45%" height={4} borderRadius={2} />
        </View>
      </View>

      {/* Category groups */}
      <View style={styles.body}>
        <SkeletonCategoryGroup />
        <SkeletonCategoryGroup />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.green },
  header: {
    backgroundColor: colors.green,
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
    gap: spacing[2],
  },
  headerSub: { marginTop: spacing[1] },
  progressTrack: {
    height: 4,
    backgroundColor: colors.divider,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: spacing[2],
  },
  body: { flex: 1, backgroundColor: colors.cream },
  group: { marginTop: spacing[4] },
  categoryHeader: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  groupItems: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginHorizontal: spacing[4],
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    gap: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  itemCheck: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: colors.checkboxBorder,
  },
  itemContent: { flex: 1, gap: spacing[1] },
  itemSub: { marginTop: spacing[1] },
});
```

- [ ] **Run test to confirm it passes**

```bash
npx jest __tests__/components/ui/ShopSkeleton.test.tsx --no-coverage
```

Expected: PASS

- [ ] **Commit**

```bash
git add components/ui/ShopSkeleton.tsx __tests__/components/ui/ShopSkeleton.test.tsx
git commit -m "feat: add ShopSkeleton loading state"
```

---

### Task 9: RecipesSkeleton

**Files:**
- Create: `components/ui/RecipesSkeleton.tsx`
- Create: `__tests__/components/ui/RecipesSkeleton.test.tsx`

- [ ] **Write the failing test**

```tsx
// __tests__/components/ui/RecipesSkeleton.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { RecipesSkeleton } from '../../../components/ui/RecipesSkeleton';

jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock')
);

describe('RecipesSkeleton', () => {
  it('renders without crashing', () => {
    const { getByTestId } = render(<RecipesSkeleton />);
    expect(getByTestId('recipes-skeleton')).toBeTruthy();
  });
});
```

- [ ] **Run test to confirm it fails**

```bash
npx jest __tests__/components/ui/RecipesSkeleton.test.tsx --no-coverage
```

Expected: FAIL — `RecipesSkeleton` not found

- [ ] **Create `components/ui/RecipesSkeleton.tsx`**

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Skeleton } from './Skeleton';
import { colors, spacing, radius } from '../../constants/tokens';

function SkeletonRecipeCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <Skeleton width="70%" height={15} borderRadius={4} />
        <Skeleton width="40%" height={11} borderRadius={4} style={styles.cardSub} />
      </View>
      <View style={styles.cardMacros}>
        <Skeleton width={36} height={28} borderRadius={4} />
        <Skeleton width={36} height={28} borderRadius={4} />
        <Skeleton width={36} height={28} borderRadius={4} />
      </View>
    </View>
  );
}

function SkeletonRecipeGroup() {
  return (
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        <Skeleton width={70} height={11} borderRadius={4} />
      </View>
      <View style={styles.cards}>
        <SkeletonRecipeCard />
        <SkeletonRecipeCard />
      </View>
    </View>
  );
}

export function RecipesSkeleton() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.outer} testID="recipes-skeleton">
      <View style={[styles.container, { marginTop: insets.top }]}>
        <SkeletonRecipeGroup />
        <SkeletonRecipeGroup />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: colors.green },
  container: { flex: 1, backgroundColor: colors.cream, paddingTop: spacing[2] },
  group: { marginTop: spacing[4], paddingHorizontal: spacing[4] },
  groupHeader: { paddingVertical: spacing[2] },
  cards: { gap: spacing[3] },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  cardContent: { flex: 1, gap: spacing[2] },
  cardSub: {},
  cardMacros: { flexDirection: 'row', gap: spacing[2] },
});
```

- [ ] **Run test to confirm it passes**

```bash
npx jest __tests__/components/ui/RecipesSkeleton.test.tsx --no-coverage
```

Expected: PASS

- [ ] **Commit**

```bash
git add components/ui/RecipesSkeleton.tsx __tests__/components/ui/RecipesSkeleton.test.tsx
git commit -m "feat: add RecipesSkeleton loading state"
```

---

### Task 10: Integrate skeletons into tab screens

**Files:**
- Modify: `app/(tabs)/plan.tsx`
- Modify: `app/(tabs)/shop.tsx`
- Modify: `app/(tabs)/recipes.tsx`

- [ ] **Plan tab — add skeleton**

In `app/(tabs)/plan.tsx`, destructure `loading` from `usePlan` and add early return before the existing `!plan` check:

```tsx
const { plan, loading } = usePlan();

// add these imports at the top of the file:
// import { PlanSkeleton } from '../../components/ui/PlanSkeleton';

if (loading) return <PlanSkeleton />;
```

The `if (!plan)` empty state return stays below — it handles the case where loading is done but no plan exists.

- [ ] **Shop tab — add skeleton**

`useShoppingItems(null)` returns `loading: false` immediately when no plan is loaded yet. The shop skeleton must therefore show while either plan OR items are loading.

In `app/(tabs)/shop.tsx`:

```tsx
// Change this line:
const { plan } = usePlan();
// To:
const { plan, loading: planLoading } = usePlan();

// Change this line:
const { items, toggleItem, addItem, updateItem, deleteItem } = useShoppingItems(plan?.row.id ?? null);
// To:
const { items, loading: itemsLoading, toggleItem, addItem, updateItem, deleteItem } = useShoppingItems(plan?.row.id ?? null);

// Add import at the top:
// import { ShopSkeleton } from '../../components/ui/ShopSkeleton';

// Add early return before any existing returns (after the useMemo block):
if (planLoading || itemsLoading) return <ShopSkeleton />;
```

- [ ] **Recipes tab — add skeleton**

In `app/(tabs)/recipes.tsx`:

```tsx
// Change:
const { recipes } = useRecipes();
// To:
const { recipes, loading } = useRecipes();

// Add import at the top:
// import { RecipesSkeleton } from '../../components/ui/RecipesSkeleton';

// Add early return before the existing !plan check:
if (loading) return <RecipesSkeleton />;
```

- [ ] **Run the full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass

- [ ] **Commit**

```bash
git add "app/(tabs)/plan.tsx" "app/(tabs)/shop.tsx" "app/(tabs)/recipes.tsx"
git commit -m "feat: integrate skeleton loading states into tab screens"
```
