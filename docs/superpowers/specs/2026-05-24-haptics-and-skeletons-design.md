# Haptics + Skeleton Loading States

## Overview

Two independent enhancements to the meal planner app:

1. **Haptics** — light impact feedback on action buttons across all screens
2. **Skeleton screens** — shimmer loading states for the three main tabs (Plan, Shop, Recipes)

---

## Enhancement 1: Haptics

### Decision

All haptics use `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` uniformly. No success/warning/error vibration patterns.

Pure navigation (back buttons, cancel, opening a screen) gets no haptics. Only action completions and confirmations.

`expo-haptics` is already installed.

### Changes

| File | What changes |
|---|---|
| `components/ui/Pill.tsx` | Add light impact on press — covers all settings actions in one shot |
| `app/category-order.tsx` | Done button, Reset button, drag begin (`onDragBegin` on DraggableFlatList) |
| `app/barcode-scanner.tsx` | Use button, Continue button, Scan again, Grant Access |
| `app/recipe/[id].tsx` | Copy recipe button |
| `components/IngredientRow.tsx` | TouchableOpacity onPress (tap to add/edit nutrition) |

### Excluded

- Back buttons (`‹ Recipes`, `‹ Cancel`)
- RecipeCard, DayCard, BatchPlanBanner press (navigation)
- Tab bar taps

---

## Enhancement 2: Skeleton Loading States

### Skeleton Atom

**File:** `components/ui/Skeleton.tsx`

A single rectangular shimmer block. Props:

```ts
interface SkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}
```

Animation: Reanimated `withRepeat(withTiming(...))` cycling opacity 0.4 → 0.9 → 0.4. Duration: 900ms per half-cycle. Color: `colors.divider`.

No logic. Compose into skeleton screens.

### Skeleton Components

**`components/ui/PlanSkeleton.tsx`**

- Full-width green block at top (mimics TodayCard, ~120px tall, `colors.green` background with opacity shimmer)
- 6 rows below: each row has a short-wide block (day name) + three narrower blocks (meal labels), separated by dividers
- Matches the visual weight and rhythm of the real Plan screen

**`components/ui/ShopSkeleton.tsx`**

- Thin 4px block at top (mimics ProgressBar)
- Two groups: each group has a small category-label-sized block + 3 item rows
- Each item row: wide name block on left + narrow price block on right
- Matches ShoppingItem row height (~56px)

**`components/ui/RecipesSkeleton.tsx`**

- Two groups: each group has a small category-label block + 2 taller card blocks
- Card blocks match RecipeCard height (~80px)

### Integration

Each tab screen destructures `loading` from its hook and short-circuits to the skeleton:

```ts
// plan.tsx
const { plan, loading } = usePlan();
if (loading) return <PlanSkeleton />;

// shop.tsx
const { items, loading } = useShoppingItems(...);
if (loading) return <ShopSkeleton />;

// recipes.tsx
const { recipes, loading } = useRecipes();
if (loading) return <RecipesSkeleton />;
```

Skeleton renders inside the same outer container as the real screen (same background color, same safe area handling) so there's no layout jump when data loads.

### Files Created

- `components/ui/Skeleton.tsx`
- `components/ui/PlanSkeleton.tsx`
- `components/ui/ShopSkeleton.tsx`
- `components/ui/RecipesSkeleton.tsx`

---

## Out of Scope

- Skeleton states for detail screens (recipe detail, batch plan, settings) — these are navigated to, not opened on launch
- Refresh/refetch skeleton states — only initial load
- Error states
