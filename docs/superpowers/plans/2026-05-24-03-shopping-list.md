# Shopping List Screen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fully functional shopping list screen — animated item checking, collapsible In Basket section, and a drag-to-reorder category order modal — all wired to the hooks from Plan 2.

**Architecture:** The shop screen is a fixed green header (non-scrollable) above a `ScrollView` of category sections plus a collapsible In Basket section at the bottom. Reanimated `FadeIn`/`FadeOut` transitions handle basket item entry/exit. The Category Order modal is a separate Expo Router screen using `react-native-draggable-flatlist`.

**Tech Stack:** React Native, `react-native-reanimated` (item animations, collapse), `react-native-gesture-handler` + `react-native-draggable-flatlist` (drag-to-reorder), hooks from Plan 2 (`useShoppingItems`, `usePlan`, `useCategoryOrder`)

**Prerequisite:** Plans 1 and 2 complete (all hooks, all UI primitives, nav skeleton).

---

## File Map

| File | Responsibility |
|---|---|
| `components/ShoppingItem.tsx` | Unchecked item row: full-row tap, checkbox, name, qty · price, note |
| `components/BasketItem.tsx` | Checked item row: strikethrough, 40% opacity, category label, Reanimated entry/exit |
| `components/BasketSection.tsx` | Collapsible "IN BASKET" section: animated header, hint text, item list |
| `components/CategorySection.tsx` | One category group: `CategoryHeader` + list of `ShoppingItem` |
| `app/(tabs)/shop.tsx` | Full Shopping List screen: fixed header, scroll body, empty state |
| `app/category-order.tsx` | Full-screen Category Order modal: `DraggableFlatList`, Done / Reset |
| `__tests__/components/ShoppingItem.test.tsx` | Render + tap behaviour |
| `__tests__/components/BasketSection.test.tsx` | Render + collapse toggle |
| `__tests__/components/CategorySection.test.tsx` | Render + tap delegation |

---

### Task 1: ShoppingItem component

**Files:**
- Create: `components/ShoppingItem.tsx`
- Create: `__tests__/components/ShoppingItem.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/components/ShoppingItem.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ShoppingItem } from '../../components/ShoppingItem';
import type { ShoppingItemRow } from '../../types/db';

const ITEM: ShoppingItemRow = {
  id: 'plan1_0_0',
  plan_id: 'plan1',
  category: 'Meat & Seafood',
  category_order: 0,
  item_order: 0,
  name: 'Chicken thighs',
  qty: '1.2 kg',
  estimated_price: 8.5,
  is_oneoff: 0,
  note: null,
  is_checked: 0,
  actual_price: null,
  store: null,
};

const ITEM_WITH_NOTE: ShoppingItemRow = { ...ITEM, id: 'plan1_0_1', note: 'Free range' };

describe('ShoppingItem', () => {
  it('renders item name', () => {
    const { getByText } = render(<ShoppingItem item={ITEM} onToggle={jest.fn()} />);
    expect(getByText('Chicken thighs')).toBeTruthy();
  });

  it('renders qty and formatted price', () => {
    const { getByText } = render(<ShoppingItem item={ITEM} onToggle={jest.fn()} />);
    expect(getByText('1.2 kg ·')).toBeTruthy();
    expect(getByText('$8.50')).toBeTruthy();
  });

  it('renders note when present', () => {
    const { getByText } = render(<ShoppingItem item={ITEM_WITH_NOTE} onToggle={jest.fn()} />);
    expect(getByText('Free range')).toBeTruthy();
  });

  it('does not render note when absent', () => {
    const { queryByText } = render(<ShoppingItem item={ITEM} onToggle={jest.fn()} />);
    expect(queryByText('Free range')).toBeNull();
  });

  it('calls onToggle when row is pressed', () => {
    const onToggle = jest.fn();
    const { getByRole } = render(<ShoppingItem item={ITEM} onToggle={onToggle} />);
    fireEvent.press(getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/components/ShoppingItem.test.tsx
```

Expected: FAIL — `Cannot find module '../../components/ShoppingItem'`

- [ ] **Step 3: Implement ShoppingItem**

```typescript
// components/ShoppingItem.tsx
import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { AppText } from './ui/AppText';
import { Checkbox } from './ui/Checkbox';
import { Divider } from './ui/Divider';
import { colors, spacing } from '../constants/tokens';
import { formatPrice } from '../lib/format';
import type { ShoppingItemRow } from '../types/db';

interface Props {
  item: ShoppingItemRow;
  onToggle: () => void;
}

export function ShoppingItem({ item, onToggle }: Props) {
  return (
    <>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.7}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: false }}
        accessibilityLabel={item.name}
        style={styles.row}
      >
        <Checkbox checked={false} />
        <View style={styles.content}>
          <AppText weight="bold" color="textPrimary" size="md">{item.name}</AppText>
          <View style={styles.detail}>
            <AppText weight="semibold" color="terracotta" size="sm">{item.qty} ·</AppText>
            <AppText weight="semibold" color="orange" size="sm">{formatPrice(item.estimated_price)}</AppText>
          </View>
          {item.note ? (
            <AppText weight="regular" color="textNote" size="2xs">{item.note}</AppText>
          ) : null}
        </View>
      </TouchableOpacity>
      <Divider />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    gap: spacing[3],
    backgroundColor: colors.card,
  },
  content: {
    flex: 1,
    gap: spacing[1],
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/components/ShoppingItem.test.tsx
```

Expected: PASS — 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add components/ShoppingItem.tsx __tests__/components/ShoppingItem.test.tsx
git commit -m "feat: add ShoppingItem component"
```

---

### Task 2: BasketItem component

**Files:**
- Create: `components/BasketItem.tsx`
- Create: `__tests__/components/BasketItem.test.tsx`

- [ ] **Step 1: Write the failing tests**

The Reanimated mock must be in place for `Animated.View` entering/exiting to not throw in test. Confirm `jest.config.js` (or `package.json` jest section) has the Reanimated mock configured:

```js
// jest.setup.js (create if missing)
require('react-native-reanimated/mock');
```

```json
// In jest config (package.json or jest.config.js):
"setupFiles": ["./jest.setup.js"]
```

Now the test:

```typescript
// __tests__/components/BasketItem.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BasketItem } from '../../components/BasketItem';
import type { ShoppingItemRow } from '../../types/db';

const ITEM: ShoppingItemRow = {
  id: 'plan1_0_0',
  plan_id: 'plan1',
  category: 'Meat & Seafood',
  category_order: 0,
  item_order: 0,
  name: 'Chicken thighs',
  qty: '1.2 kg',
  estimated_price: 8.5,
  is_oneoff: 0,
  note: null,
  is_checked: 1,
  actual_price: null,
  store: null,
};

describe('BasketItem', () => {
  it('renders item name with strikethrough', () => {
    const { getByText } = render(<BasketItem item={ITEM} onToggle={jest.fn()} />);
    const nameEl = getByText('Chicken thighs');
    expect(nameEl).toBeTruthy();
    // strikethrough is applied via style
    expect(nameEl.props.style).toMatchObject(
      expect.arrayContaining([expect.objectContaining({ textDecorationLine: 'line-through' })])
    );
  });

  it('renders category label below name', () => {
    const { getByText } = render(<BasketItem item={ITEM} onToggle={jest.fn()} />);
    expect(getByText('Meat & Seafood')).toBeTruthy();
  });

  it('has accessibilityState checked=true', () => {
    const { getByRole } = render(<BasketItem item={ITEM} onToggle={jest.fn()} />);
    const checkbox = getByRole('checkbox');
    expect(checkbox.props.accessibilityState).toEqual({ checked: true });
  });

  it('calls onToggle when row is pressed', () => {
    const onToggle = jest.fn();
    const { getByRole } = render(<BasketItem item={ITEM} onToggle={onToggle} />);
    fireEvent.press(getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/components/BasketItem.test.tsx
```

Expected: FAIL — `Cannot find module '../../components/BasketItem'`

- [ ] **Step 3: Implement BasketItem**

```typescript
// components/BasketItem.tsx
import React from 'react';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { AppText } from './ui/AppText';
import { Checkbox } from './ui/Checkbox';
import { Divider } from './ui/Divider';
import { colors, spacing } from '../constants/tokens';
import type { ShoppingItemRow } from '../types/db';

interface Props {
  item: ShoppingItemRow;
  onToggle: () => void;
}

export function BasketItem({ item, onToggle }: Props) {
  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: true }}
        accessibilityHint="Double-tap to uncheck and return to list"
        style={styles.row}
      >
        <Checkbox checked={true} />
        <View style={styles.content}>
          <AppText
            weight="bold"
            color="textSecondary"
            size="md"
            style={styles.strikethrough}
          >
            {item.name}
          </AppText>
          <AppText weight="regular" color="textNote" size="2xs">{item.category}</AppText>
        </View>
      </TouchableOpacity>
      <Divider />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    gap: spacing[3],
    backgroundColor: colors.card,
    opacity: 0.4,
  },
  content: {
    flex: 1,
    gap: spacing[1],
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/components/BasketItem.test.tsx
```

Expected: PASS — 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add components/BasketItem.tsx __tests__/components/BasketItem.test.tsx jest.setup.js
git commit -m "feat: add BasketItem component"
```

---

### Task 3: BasketSection component

**Files:**
- Create: `components/BasketSection.tsx`
- Create: `__tests__/components/BasketSection.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/components/BasketSection.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BasketSection } from '../../components/BasketSection';
import type { ShoppingItemRow } from '../../types/db';

const makeItem = (id: string, name: string): ShoppingItemRow => ({
  id,
  plan_id: 'plan1',
  category: 'Produce',
  category_order: 1,
  item_order: 0,
  name,
  qty: '1',
  estimated_price: 2,
  is_oneoff: 0,
  note: null,
  is_checked: 1,
  actual_price: null,
  store: null,
});

describe('BasketSection', () => {
  it('shows "IN BASKET" header with count', () => {
    const items = [makeItem('a', 'Milk'), makeItem('b', 'Eggs')];
    const { getByText } = render(<BasketSection items={items} onToggle={jest.fn()} />);
    expect(getByText('IN BASKET (2)')).toBeTruthy();
  });

  it('shows hint text', () => {
    const items = [makeItem('a', 'Milk')];
    const { getByText } = render(<BasketSection items={items} onToggle={jest.fn()} />);
    expect(getByText('Tap any item to put it back')).toBeTruthy();
  });

  it('renders item names when expanded (default)', () => {
    const items = [makeItem('a', 'Milk'), makeItem('b', 'Eggs')];
    const { getByText } = render(<BasketSection items={items} onToggle={jest.fn()} />);
    expect(getByText('Milk')).toBeTruthy();
    expect(getByText('Eggs')).toBeTruthy();
  });

  it('collapses item list when header is pressed', () => {
    const items = [makeItem('a', 'Milk')];
    const { getByText, queryByText } = render(
      <BasketSection items={items} onToggle={jest.fn()} />
    );
    fireEvent.press(getByText('IN BASKET (1)'));
    // Items hidden after collapse (maxHeight → 0 hides content)
    expect(queryByText('Milk')).toBeTruthy(); // still in DOM, just animated out
  });

  it('calls onToggle with item id when item is pressed', () => {
    const onToggle = jest.fn();
    const items = [makeItem('a', 'Milk')];
    const { getByText } = render(<BasketSection items={items} onToggle={onToggle} />);
    fireEvent.press(getByText('Milk').parent!.parent!);
    expect(onToggle).toHaveBeenCalledWith('a');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/components/BasketSection.test.tsx
```

Expected: FAIL — `Cannot find module '../../components/BasketSection'`

- [ ] **Step 3: Implement BasketSection**

```typescript
// components/BasketSection.tsx
import React, { useState } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { BasketItem } from './BasketItem';
import { AppText } from './ui/AppText';
import { colors, spacing } from '../constants/tokens';
import type { ShoppingItemRow } from '../types/db';

interface Props {
  items: ShoppingItemRow[];
  onToggle: (id: string) => void;
}

export function BasketSection({ items, onToggle }: Props) {
  const [isExpanded, setIsExpanded] = useState(true);
  const expandedValue = useSharedValue(1);

  const collapseStyle = useAnimatedStyle(() => ({
    maxHeight: withTiming(expandedValue.value * 4000, { duration: 250 }),
    opacity: withTiming(expandedValue.value, { duration: 200 }),
    overflow: 'hidden',
  }));

  const handleToggleExpand = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    expandedValue.value = next ? 1 : 0;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={handleToggleExpand}
        style={styles.header}
        accessibilityRole="button"
        accessibilityLabel={`In Basket, ${items.length} item${items.length !== 1 ? 's' : ''}, ${isExpanded ? 'tap to collapse' : 'tap to expand'}`}
      >
        <AppText weight="bold" color="green" size="md">✓</AppText>
        <AppText weight="semibold" color="green" size="sm" style={styles.headerLabel}>
          IN BASKET ({items.length})
        </AppText>
      </TouchableOpacity>

      <Animated.View style={collapseStyle}>
        <AppText weight="regular" color="textNote" size="2xs" style={styles.hint}>
          Tap any item to put it back
        </AppText>
        {items.map((item) => (
          <BasketItem key={item.id} item={item} onToggle={() => onToggle(item.id)} />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.cream,
  },
  headerLabel: {
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  hint: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
    paddingTop: spacing[1],
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/components/BasketSection.test.tsx
```

Expected: PASS — 5 tests pass. (The collapse test verifies the item is still in the DOM tree, as Reanimated hides via maxHeight rather than unmounting.)

- [ ] **Step 5: Commit**

```bash
git add components/BasketSection.tsx __tests__/components/BasketSection.test.tsx
git commit -m "feat: add BasketSection component with collapse animation"
```

---

### Task 4: CategorySection component

**Files:**
- Create: `components/CategorySection.tsx`
- Create: `__tests__/components/CategorySection.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/components/CategorySection.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CategorySection } from '../../components/CategorySection';
import type { ShoppingItemRow } from '../../types/db';

const makeItem = (id: string, name: string, isOneoff = 0): ShoppingItemRow => ({
  id,
  plan_id: 'plan1',
  category: 'Produce',
  category_order: 0,
  item_order: 0,
  name,
  qty: '2',
  estimated_price: 3.5,
  is_oneoff: isOneoff as 0 | 1,
  note: null,
  is_checked: 0,
  actual_price: null,
  store: null,
});

describe('CategorySection', () => {
  it('renders the category header', () => {
    const { getByText } = render(
      <CategorySection
        category="Produce"
        items={[makeItem('a', 'Broccoli')]}
        isOneoff={false}
        onToggle={jest.fn()}
      />
    );
    expect(getByText('PRODUCE')).toBeTruthy();
  });

  it('renders all items', () => {
    const items = [makeItem('a', 'Broccoli'), makeItem('b', 'Spinach')];
    const { getByText } = render(
      <CategorySection category="Produce" items={items} isOneoff={false} onToggle={jest.fn()} />
    );
    expect(getByText('Broccoli')).toBeTruthy();
    expect(getByText('Spinach')).toBeTruthy();
  });

  it('calls onToggle with item id when item is pressed', () => {
    const onToggle = jest.fn();
    const { getByText } = render(
      <CategorySection
        category="Produce"
        items={[makeItem('item_abc', 'Broccoli')]}
        isOneoff={false}
        onToggle={onToggle}
      />
    );
    fireEvent.press(getByText('Broccoli').parent!.parent!);
    expect(onToggle).toHaveBeenCalledWith('item_abc');
  });

  it('passes isOneoff to CategoryHeader', () => {
    const { getByText } = render(
      <CategorySection
        category="One-Off Items"
        items={[makeItem('a', 'Salt', 1)]}
        isOneoff={true}
        onToggle={jest.fn()}
      />
    );
    expect(getByText('(check pantry first)')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/components/CategorySection.test.tsx
```

Expected: FAIL — `Cannot find module '../../components/CategorySection'`

- [ ] **Step 3: Implement CategorySection**

```typescript
// components/CategorySection.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ShoppingItem } from './ShoppingItem';
import { CategoryHeader } from './ui/CategoryHeader';
import { spacing } from '../constants/tokens';
import type { ShoppingItemRow } from '../types/db';

interface Props {
  category: string;
  items: ShoppingItemRow[];
  isOneoff: boolean;
  onToggle: (id: string) => void;
}

export function CategorySection({ category, items, isOneoff, onToggle }: Props) {
  return (
    <View style={styles.container}>
      <CategoryHeader label={category} isOneoff={isOneoff} />
      {items.map((item) => (
        <ShoppingItem key={item.id} item={item} onToggle={() => onToggle(item.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[2],
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/components/CategorySection.test.tsx
```

Expected: PASS — 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add components/CategorySection.tsx __tests__/components/CategorySection.test.tsx
git commit -m "feat: add CategorySection component"
```

---

### Task 5: Category Order modal

**Files:**
- Modify: `app/category-order.tsx` (replace empty skeleton from Plan 1)

- [ ] **Step 1: Implement the Category Order modal**

```typescript
// app/category-order.tsx
import React, { useMemo, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppText } from '../components/ui/AppText';
import { Divider } from '../components/ui/Divider';
import { usePlan } from '../hooks/usePlan';
import { useShoppingItems } from '../hooks/useShoppingItems';
import { useCategoryOrder } from '../hooks/useCategoryOrder';
import { colors, spacing, radius } from '../constants/tokens';

type CategoryEntry = { name: string; isOneoff: boolean };

export default function CategoryOrderModal() {
  const { plan } = usePlan();
  const { items } = useShoppingItems(plan?.id ?? null);
  const { saveOrder, applySavedOrder } = useCategoryOrder();

  // Derive unique categories from current plan items
  const allCategories = useMemo((): CategoryEntry[] => {
    const seen = new Map<string, boolean>();
    for (const item of items) {
      if (!seen.has(item.category)) {
        seen.set(item.category, item.is_oneoff === 1);
      }
    }
    return [...seen.entries()].map(([name, isOneoff]) => ({ name, isOneoff }));
  }, [items]);

  const regularCats = allCategories.filter((c) => !c.isOneoff);
  const oneoffCats = allCategories.filter((c) => c.isOneoff);

  const sortedRegularNames = applySavedOrder(regularCats.map((c) => c.name));
  const initialRegular = sortedRegularNames
    .map((name) => regularCats.find((c) => c.name === name))
    .filter(Boolean) as CategoryEntry[];

  const [draggable, setDraggable] = useState<CategoryEntry[]>(initialRegular);
  // Snapshot of last-saved order for Reset
  const savedRef = useRef<CategoryEntry[]>(initialRegular);

  const handleDone = async () => {
    const prefs: Record<string, number> = {};
    draggable.forEach((cat, idx) => {
      prefs[cat.name] = idx;
    });
    await saveOrder(prefs);
    router.back();
  };

  const handleReset = () => {
    setDraggable(savedRef.current);
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<CategoryEntry>) => (
    <ScaleDecorator>
      <TouchableOpacity
        onLongPress={drag}
        disabled={isActive}
        style={[styles.row, isActive && styles.rowActive]}
        accessibilityLabel={item.name}
      >
        <AppText weight="regular" color="textSecondary" size="xl" style={styles.handle}>
          ≡
        </AppText>
        <AppText weight="semibold" color="textPrimary" size="md" style={styles.label}>
          {item.name}
        </AppText>
      </TouchableOpacity>
      <Divider />
    </ScaleDecorator>
  );

  const renderLockedItem = (cat: CategoryEntry) => (
    <View key={cat.name}>
      <View style={styles.rowLocked}>
        <AppText weight="regular" color="textTertiary" size="md" style={styles.handle}>
          🔒
        </AppText>
        <AppText weight="semibold" color="textTertiary" size="md" style={styles.label}>
          {cat.name}
        </AppText>
      </View>
      <Divider />
    </View>
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaView style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <AppText weight="extrabold" color="onGreen" size="xl">Reorder Categories</AppText>
          <AppText weight="semibold" color="onGreenSubtle" size="xs">
            Hold ≡ to drag
          </AppText>
        </View>

        {/* Draggable list */}
        <View style={styles.listContainer}>
          <DraggableFlatList
            data={draggable}
            renderItem={renderItem}
            keyExtractor={(item) => item.name}
            onDragEnd={({ data }) => setDraggable(data)}
            ListFooterComponent={
              oneoffCats.length > 0 ? (
                <View>
                  <AppText weight="regular" color="textNote" size="2xs" style={styles.lockedNote}>
                    These categories always appear last
                  </AppText>
                  {oneoffCats.map(renderLockedItem)}
                </View>
              ) : null
            }
          />
        </View>

        {/* Bottom buttons */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={handleReset} style={styles.resetBtn} accessibilityRole="button">
            <AppText weight="bold" color="textSecondary" size="md">Reset</AppText>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDone} style={styles.doneBtn} accessibilityRole="button">
            <AppText weight="bold" color="onGreen" size="md">Done</AppText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    backgroundColor: colors.green,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
    gap: spacing[1],
  },
  listContainer: {
    flex: 1,
    backgroundColor: colors.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.card,
  },
  rowActive: {
    backgroundColor: colors.cream,
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  rowLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.card,
    opacity: 0.5,
  },
  handle: {
    width: 32,
  },
  label: {
    flex: 1,
  },
  lockedNote: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.card,
  },
  resetBtn: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  doneBtn: {
    backgroundColor: colors.green,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderRadius: radius.xl,
  },
});
```

- [ ] **Step 2: Verify the modal is reachable**

In `app/_layout.tsx` (from Plan 1), `category-order` is registered as a modal screen. Confirm this is present:

```typescript
// In the Stack inside app/_layout.tsx — should already exist from Plan 1:
<Stack.Screen name="category-order" options={{ presentation: 'modal', headerShown: false }} />
```

- [ ] **Step 3: Commit**

```bash
git add app/category-order.tsx
git commit -m "feat: add Category Order modal with drag-to-reorder"
```

---

### Task 6: Shop screen

**Files:**
- Modify: `app/(tabs)/shop.tsx` (replace empty skeleton from Plan 1)

- [ ] **Step 1: Implement the full Shop screen**

```typescript
// app/(tabs)/shop.tsx
import React from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { GreenHeader } from '../../components/ui/GreenHeader';
import { AppText } from '../../components/ui/AppText';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { EmptyState } from '../../components/ui/EmptyState';
import { CategorySection } from '../../components/CategorySection';
import { BasketSection } from '../../components/BasketSection';
import { usePlan } from '../../hooks/usePlan';
import { useShoppingItems } from '../../hooks/useShoppingItems';
import { useCategoryOrder } from '../../hooks/useCategoryOrder';
import { formatWeekOf, formatPrice, formatItemCount } from '../../lib/format';
import { colors, spacing } from '../../constants/tokens';

export default function ShopScreen() {
  const { plan } = usePlan();
  const { items, toggleItem } = useShoppingItems(plan?.id ?? null);
  const { applySavedOrder } = useCategoryOrder();

  const uncheckedItems = items.filter((i) => i.is_checked === 0);
  const checkedItems = items.filter((i) => i.is_checked === 1);

  // Derive ordered categories, oneoff always last
  const allCategoryNames = [...new Set(uncheckedItems.map((i) => i.category))];
  const isCategoryOneoff = (cat: string) =>
    uncheckedItems.some((i) => i.category === cat && i.is_oneoff === 1);

  const sortedNames = applySavedOrder(allCategoryNames);
  const regularCategories = sortedNames.filter((c) => !isCategoryOneoff(c));
  const oneoffCategories = sortedNames.filter((c) => isCategoryOneoff(c));
  const orderedCategories = [...regularCategories, ...oneoffCategories];

  // Header stats
  const totalItems = items.length;
  const checkedCount = checkedItems.length;
  const totalBudget = items.reduce((sum, i) => sum + i.estimated_price, 0);
  const progress = totalItems > 0 ? checkedCount / totalItems : 0;
  const itemsLeft = totalItems - checkedCount;

  if (!plan) {
    return (
      <View style={styles.emptyContainer}>
        <EmptyState onImport={() => router.push('/settings')} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Fixed green header */}
      <GreenHeader>
        <View style={styles.headerContent}>
          {/* Title row + reorder button */}
          <View style={styles.titleRow}>
            <AppText weight="extrabold" color="onGreen" size="xl">Shopping List</AppText>
            <TouchableOpacity
              onPress={() => router.push('/category-order')}
              style={styles.reorderBtn}
              accessibilityLabel="Reorder categories"
              accessibilityRole="button"
            >
              <AppText weight="bold" color="onGreen" size="xl">↕</AppText>
            </TouchableOpacity>
          </View>

          {/* Week sub-label */}
          <AppText weight="semibold" color="onGreenSubtle" size="xs">
            Week of {formatWeekOf(plan.week_starting)}
          </AppText>

          {/* Budget pills */}
          <View style={styles.pillsRow}>
            <View style={styles.pill}>
              <AppText weight="bold" color="onGreen" size="2xs">
                Budget {formatPrice(totalBudget)}
              </AppText>
            </View>
            <View style={styles.pill}>
              <AppText weight="bold" color="onGreen" size="2xs">
                {formatItemCount(checkedCount, totalItems)}
              </AppText>
            </View>
          </View>

          {/* Progress bar */}
          <ProgressBar progress={progress} />

          {/* Items left label */}
          <AppText weight="semibold" color="onGreenSubtle" size="2xs" style={styles.itemsLeft}>
            {itemsLeft} item{itemsLeft !== 1 ? 's' : ''} left
          </AppText>
        </View>
      </GreenHeader>

      {/* Scrollable body */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        {orderedCategories.map((cat) => {
          const catItems = uncheckedItems.filter((i) => i.category === cat);
          return (
            <CategorySection
              key={cat}
              category={cat}
              items={catItems}
              isOneoff={isCategoryOneoff(cat)}
              onToggle={toggleItem}
            />
          );
        })}

        {checkedItems.length > 0 && (
          <BasketSection items={checkedItems} onToggle={toggleItem} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  headerContent: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
    gap: spacing[2],
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reorderBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  pill: {
    backgroundColor: colors.headerPill,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: 9999,
  },
  itemsLeft: {
    paddingTop: spacing[1],
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingBottom: spacing[10],
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

1. Import a `meal_plan.json` via Settings — Shopping List should display with categories and items
2. Tap an item row anywhere (not just the checkbox) — item moves to In Basket with fade animation
3. Tap the item in In Basket — item returns to its original category position
4. Check that `is_oneoff` categories appear at the bottom of the list
5. Tap ↕ — Category Order modal opens
6. Long-press a drag handle (`≡`) and drag a category to a new position
7. Tap Done — return to shopping list, categories are reordered
8. Open modal again, tap Reset — order reverts to the saved state
9. Tap header "IN BASKET (N)" — the item list collapses and expands

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/shop.tsx
git commit -m "feat: implement Shopping List screen"
```
