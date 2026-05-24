# Edit Shopping Item Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users swipe left on any shopping item to reveal Edit and Delete actions; tapping Edit opens a bottom sheet pre-populated with the item's fields so they can change name, qty, price, category, or note.

**Architecture:** Extend the existing `AddItemSheet` to handle both add and edit modes via an `initialItem` prop. Add `updateItem` to `useShoppingItems`. Thread an `onEdit` callback from `shop.tsx` → `CategorySection` → `SwipeableShoppingItem`.

**Tech Stack:** React Native, Expo SDK 56, `react-native-gesture-handler/ReanimatedSwipeable`, `expo-sqlite`, `@expo/vector-icons` (Ionicons), `@testing-library/react-native`, Jest

---

## File Map

| File | Change |
|------|--------|
| `hooks/useShoppingItems.ts` | Add `updateItem`; extend `addItem` to accept `note` |
| `components/AddItemSheet.tsx` | Add `initialItem?`, `onSave?`, note field; rename `AddItemData` → `ItemFormData` |
| `components/SwipeableShoppingItem.tsx` | Add `EditAction` component and `onEdit` prop |
| `components/CategorySection.tsx` | Add `onEdit: (item: ShoppingItemRow) => void` prop |
| `app/(tabs)/shop.tsx` | Add `editingItem` state, wire `updateItem` and `onEdit` |
| `__tests__/components/AddItemSheet.test.tsx` | New — tests for note field and edit mode |

---

## Task 1: Extend `useShoppingItems` — `updateItem` and note in `addItem`

**Files:**
- Modify: `hooks/useShoppingItems.ts`

- [ ] **Step 1: Add `note` to `addItem`**

In `hooks/useShoppingItems.ts`, update the `addItem` callback signature and SQL to store note:

```ts
const addItem = useCallback(async (data: {
  name: string;
  qty: string;
  estimatedPrice: number;
  category: string;
  note?: string | null;
}) => {
  if (!planId) return;
  const catItems = items.filter((i) => i.category === data.category);
  const existingCatItem = items.find((i) => i.category === data.category);
  const categoryOrder = existingCatItem?.category_order ??
    (items.length > 0 ? Math.max(...items.map((i) => i.category_order)) + 1 : 0);
  const itemOrder = catItems.length > 0
    ? Math.max(...catItems.map((i) => i.item_order)) + 1
    : 0;
  const id = generateId();
  await db.runAsync(
    `INSERT INTO shopping_items
       (id, plan_id, category, category_order, item_order, name, qty,
        estimated_price, is_oneoff, note, is_checked)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0)`,
    [id, planId, data.category, categoryOrder, itemOrder,
     data.name, data.qty, data.estimatedPrice, data.note ?? null]
  );
  await load();
}, [planId, items, db]);
```

- [ ] **Step 2: Add `updateItem` after `deleteItem`**

```ts
const updateItem = useCallback(async (itemId: string, data: {
  name: string;
  qty: string;
  estimatedPrice: number;
  category: string;
  note: string | null;
}) => {
  const existing = items.find((i) => i.id === itemId);
  if (!existing) return;

  let categoryOrder = existing.category_order;
  let itemOrder = existing.item_order;

  if (data.category !== existing.category) {
    const catItems = items.filter((i) => i.category === data.category);
    const existingCatItem = items.find((i) => i.category === data.category);
    if (existingCatItem) {
      categoryOrder = existingCatItem.category_order;
      itemOrder = catItems.length > 0
        ? Math.max(...catItems.map((i) => i.item_order)) + 1
        : 0;
    } else {
      categoryOrder = items.length > 0
        ? Math.max(...items.map((i) => i.category_order)) + 1
        : 0;
      itemOrder = 0;
    }
  }

  await db.runAsync(
    `UPDATE shopping_items
     SET name = ?, qty = ?, estimated_price = ?, category = ?,
         category_order = ?, item_order = ?, note = ?
     WHERE id = ?`,
    [data.name, data.qty, data.estimatedPrice, data.category,
     categoryOrder, itemOrder, data.note, itemId]
  );

  setItems((prev) =>
    prev.map((i) =>
      i.id === itemId
        ? {
            ...i,
            name: data.name,
            qty: data.qty,
            estimated_price: data.estimatedPrice,
            category: data.category,
            category_order: categoryOrder,
            item_order: itemOrder,
            note: data.note,
            isChecked: i.isChecked,
          }
        : i
    )
  );
}, [items, db]);
```

- [ ] **Step 3: Add `updateItem` to the return value**

```ts
return { items, loading, toggleItem, resetAll, addItem, updateItem, deleteItem };
```

- [ ] **Step 4: Commit**

```bash
git add hooks/useShoppingItems.ts
git commit -m "feat: add updateItem and note support to useShoppingItems"
```

---

## Task 2: Extend `AddItemSheet` — note field and edit mode

**Files:**
- Modify: `components/AddItemSheet.tsx`
- Create: `__tests__/components/AddItemSheet.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/components/AddItemSheet.test.tsx`:

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AddItemSheet } from '../../components/AddItemSheet';
import type { ShoppingItemRow } from '../../types/db';

const CATEGORIES = ['Fresh Produce', 'Freezer', 'Dairy'];

const ITEM: ShoppingItemRow = {
  id: 'item1',
  plan_id: 'plan1',
  category: 'Fresh Produce',
  category_order: 0,
  item_order: 0,
  name: 'Mixed berries',
  qty: '1 bag',
  estimated_price: 6,
  is_oneoff: 0,
  note: null,
  is_checked: 0,
  actual_price: null,
  store: null,
};

const ITEM_WITH_NOTE: ShoppingItemRow = { ...ITEM, id: 'item2', note: 'Buy frozen' };

describe('AddItemSheet — note field', () => {
  it('hides note field by default in add mode', () => {
    const { queryByLabelText } = render(
      <AddItemSheet
        visible
        categories={CATEGORIES}
        onAdd={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(queryByLabelText('Note, optional')).toBeNull();
  });

  it('reveals note field when "+ Add note" is pressed', () => {
    const { getByLabelText } = render(
      <AddItemSheet
        visible
        categories={CATEGORIES}
        onAdd={jest.fn()}
        onClose={jest.fn()}
      />
    );
    fireEvent.press(getByLabelText('Add note'));
    expect(getByLabelText('Note, optional')).toBeTruthy();
  });
});

describe('AddItemSheet — edit mode', () => {
  it('shows "Edit item" title when initialItem is provided', () => {
    const { getByText } = render(
      <AddItemSheet
        visible
        categories={CATEGORIES}
        onAdd={jest.fn()}
        onSave={jest.fn()}
        onClose={jest.fn()}
        initialItem={ITEM}
      />
    );
    expect(getByText('Edit item')).toBeTruthy();
  });

  it('shows "Save changes" CTA in edit mode', () => {
    const { getByText } = render(
      <AddItemSheet
        visible
        categories={CATEGORIES}
        onAdd={jest.fn()}
        onSave={jest.fn()}
        onClose={jest.fn()}
        initialItem={ITEM}
      />
    );
    expect(getByText('Save changes')).toBeTruthy();
  });

  it('pre-populates name field from initialItem', () => {
    const { getByDisplayValue } = render(
      <AddItemSheet
        visible
        categories={CATEGORIES}
        onAdd={jest.fn()}
        onSave={jest.fn()}
        onClose={jest.fn()}
        initialItem={ITEM}
      />
    );
    expect(getByDisplayValue('Mixed berries')).toBeTruthy();
  });

  it('expands note field when initialItem has a note', () => {
    const { getByLabelText } = render(
      <AddItemSheet
        visible
        categories={CATEGORIES}
        onAdd={jest.fn()}
        onSave={jest.fn()}
        onClose={jest.fn()}
        initialItem={ITEM_WITH_NOTE}
      />
    );
    expect(getByLabelText('Note, optional')).toBeTruthy();
  });

  it('calls onSave (not onAdd) when Save changes is pressed', () => {
    const onAdd = jest.fn();
    const onSave = jest.fn();
    const { getByLabelText } = render(
      <AddItemSheet
        visible
        categories={CATEGORIES}
        onAdd={onAdd}
        onSave={onSave}
        onClose={jest.fn()}
        initialItem={ITEM}
      />
    );
    fireEvent.press(getByLabelText('Save changes'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('item1', {
      name: 'Mixed berries',
      qty: '1 bag',
      estimatedPrice: 6,
      category: 'Fresh Produce',
      note: null,
    });
    expect(onAdd).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --experimental-vm-modules node_modules/.bin/jest __tests__/components/AddItemSheet.test.tsx --no-coverage
```

Expected: FAIL — `AddItemSheet` does not yet accept `initialItem` or `onSave`, and has no note field.

- [ ] **Step 3: Update `AddItemSheet.tsx`**

Replace the entire file with the following (changes: new `ItemFormData` type; `initialItem?`/`onSave?` props; note state; pre-population in `useEffect`; mode-aware title/CTA):

```tsx
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './ui/AppText';
import { colors, spacing, radius, font } from '../constants/tokens';
import type { ShoppingItemRow } from '../types/db';

const SHEET_HEIGHT = Dimensions.get('window').height * 0.72;

export interface ItemFormData {
  name: string;
  qty: string;
  estimatedPrice: number;
  category: string;
  note: string | null;
}

interface Props {
  visible: boolean;
  categories: string[];
  onAdd: (data: ItemFormData) => void;
  onSave?: (id: string, data: ItemFormData) => void;
  onClose: () => void;
  initialItem?: ShoppingItemRow;
}

export function AddItemSheet({ visible, categories, onAdd, onSave, onClose, initialItem }: Props) {
  const translateY = useSharedValue(SHEET_HEIGHT);
  const scrimOpacity = useSharedValue(0);

  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(categories[0] ?? '');
  const [note, setNote] = useState('');
  const [noteExpanded, setNoteExpanded] = useState(false);

  const isEditMode = !!initialItem;

  useEffect(() => {
    if (visible) {
      if (initialItem) {
        setName(initialItem.name);
        setQty(initialItem.qty);
        setPrice(initialItem.estimated_price > 0 ? String(initialItem.estimated_price) : '');
        setSelectedCategory(initialItem.category);
        setNote(initialItem.note ?? '');
        setNoteExpanded(!!initialItem.note);
      } else {
        setName('');
        setQty('1');
        setPrice('');
        setSelectedCategory(categories[0] ?? '');
        setNote('');
        setNoteExpanded(false);
      }
      scrimOpacity.value = withTiming(1, { duration: 180 });
      translateY.value = withTiming(0, { duration: 280 });
    }
  }, [visible]);

  const handleClose = () => {
    scrimOpacity.value = withTiming(0, { duration: 220 });
    translateY.value = withTiming(SHEET_HEIGHT, { duration: 260 }, () => {
      runOnJS(onClose)();
    });
  };

  const handleSubmit = () => {
    if (!name.trim() || !selectedCategory) return;
    const data: ItemFormData = {
      name: name.trim(),
      qty: qty.trim() || '1',
      estimatedPrice: parseFloat(price.replace(/[^0-9.]/g, '')) || 0,
      category: selectedCategory,
      note: note.trim() || null,
    };
    if (isEditMode && initialItem) {
      onSave?.(initialItem.id, data);
    } else {
      onAdd(data);
    }
    handleClose();
  };

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity.value,
  }));

  if (!visible) return null;

  const canSubmit = name.trim().length > 0 && selectedCategory.length > 0;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <Animated.View style={[styles.sheet, sheetStyle]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <AppText weight="extrabold" color="textPrimary" size="xl">
              {isEditMode ? 'Edit item' : 'Add item'}
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

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <AppText weight="semibold" color="terracotta" size="sm" style={styles.label}>
              ITEM NAME
            </AppText>
            <TextInput
              style={styles.input}
              placeholder="e.g. Greek yoghurt"
              placeholderTextColor={colors.textTertiary}
              value={name}
              onChangeText={setName}
              autoFocus={!isEditMode}
              returnKeyType="next"
              accessibilityLabel="Item name"
            />

            <View style={styles.twoCol}>
              <View style={styles.col}>
                <AppText weight="semibold" color="terracotta" size="sm" style={styles.label}>
                  QUANTITY
                </AppText>
                <TextInput
                  style={styles.input}
                  placeholder="1 tub"
                  placeholderTextColor={colors.textTertiary}
                  value={qty}
                  onChangeText={setQty}
                  returnKeyType="next"
                  accessibilityLabel="Quantity"
                />
              </View>
              <View style={styles.col}>
                <AppText weight="semibold" color="terracotta" size="sm" style={styles.label}>
                  PRICE
                </AppText>
                <TextInput
                  style={styles.input}
                  placeholder="$4.50"
                  placeholderTextColor={colors.textTertiary}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  accessibilityLabel="Price, optional"
                />
              </View>
            </View>

            <AppText weight="semibold" color="terracotta" size="sm" style={[styles.label, styles.categoryLabel]}>
              CATEGORY
            </AppText>
            {categories.length === 0 ? (
              <AppText weight="regular" color="textSecondary" size="md" style={styles.noCategories}>
                No categories yet — import a plan first
              </AppText>
            ) : (
              categories.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryRow, isSelected && styles.categoryRowSelected]}
                    onPress={() => setSelectedCategory(cat)}
                    activeOpacity={0.65}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={cat}
                  >
                    <AppText
                      weight={isSelected ? 'bold' : 'regular'}
                      color={isSelected ? 'textPrimary' : 'textSecondary'}
                      size="md"
                    >
                      {cat}
                    </AppText>
                    {isSelected && (
                      <Ionicons name="checkmark" size={18} color={colors.green} />
                    )}
                  </TouchableOpacity>
                );
              })
            )}

            {noteExpanded ? (
              <>
                <AppText weight="semibold" color="terracotta" size="sm" style={[styles.label, styles.noteLabel]}>
                  NOTE
                </AppText>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Free range"
                  placeholderTextColor={colors.textTertiary}
                  value={note}
                  onChangeText={setNote}
                  returnKeyType="done"
                  accessibilityLabel="Note, optional"
                />
              </>
            ) : (
              <TouchableOpacity
                style={styles.addNoteRow}
                onPress={() => setNoteExpanded(true)}
                accessibilityRole="button"
                accessibilityLabel="Add note"
              >
                <Ionicons name="add-circle-outline" size={16} color={colors.textSecondary} />
                <AppText weight="semibold" color="textSecondary" size="sm">Add note</AppText>
              </TouchableOpacity>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.addBtn, !canSubmit && styles.addBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={isEditMode ? 'Save changes' : 'Add to list'}
              accessibilityState={{ disabled: !canSubmit }}
            >
              <AppText weight="extrabold" color="onGreen" size="md">
                {isEditMode ? 'Save changes' : '+ Add to list'}
              </AppText>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    backgroundColor: 'rgba(28, 69, 60, 0.45)',
  },
  sheet: {
    height: SHEET_HEIGHT,
    backgroundColor: colors.cream,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 16,
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
  closeBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
  },
  label: {
    letterSpacing: 1.0,
    marginBottom: spacing[1],
  },
  categoryLabel: {
    marginTop: spacing[5],
  },
  noteLabel: {
    marginTop: spacing[5],
  },
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
    marginBottom: spacing[3],
  },
  twoCol: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  col: {
    flex: 1,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: radius.sm,
    marginBottom: spacing[1],
  },
  categoryRowSelected: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  noCategories: {
    paddingVertical: spacing[3],
  },
  addNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    marginTop: spacing[2],
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  addBtn: {
    backgroundColor: colors.green,
    paddingVertical: spacing[4],
    borderRadius: radius.xl,
    alignItems: 'center',
  },
  addBtnDisabled: {
    opacity: 0.4,
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --experimental-vm-modules node_modules/.bin/jest __tests__/components/AddItemSheet.test.tsx --no-coverage
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
node --experimental-vm-modules node_modules/.bin/jest --no-coverage
```

Expected: all existing tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add components/AddItemSheet.tsx __tests__/components/AddItemSheet.test.tsx
git commit -m "feat: add note field and edit mode to AddItemSheet"
```

---

## Task 3: Update `SwipeableShoppingItem` — add `EditAction`

**Files:**
- Modify: `components/SwipeableShoppingItem.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
import { Ionicons } from "@expo/vector-icons";
import { useRef } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { colors } from "../constants/tokens";
import type { ShoppingItemRow } from "../types/db";
import { ShoppingItem } from "./ShoppingItem";

interface Props {
  item: ShoppingItemRow;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

function EditAction({ onEdit }: { onEdit: () => void }) {
  return (
    <TouchableOpacity
      style={styles.editAction}
      onPress={onEdit}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Edit item"
    >
      <Ionicons name="create-outline" size={22} color={colors.onGreen} />
    </TouchableOpacity>
  );
}

function DeleteAction({ onDelete }: { onDelete: () => void }) {
  return (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={onDelete}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Delete item"
    >
      <Ionicons name="trash-outline" size={22} color={colors.onGreen} />
    </TouchableOpacity>
  );
}

export function SwipeableShoppingItem({ item, onToggle, onDelete, onEdit }: Props) {
  const swipeableRef = useRef<SwipeableMethods>(null);

  const handleDelete = () => {
    swipeableRef.current?.close();
    onDelete();
  };

  const handleEdit = () => {
    swipeableRef.current?.close();
    onEdit();
  };

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      friction={2}
      rightThreshold={60}
      renderRightActions={() => (
        <>
          <EditAction onEdit={handleEdit} />
          <DeleteAction onDelete={handleDelete} />
        </>
      )}
      overshootRight={false}
    >
      <ShoppingItem item={item} onToggle={onToggle} />
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  editAction: {
    width: 80,
    backgroundColor: colors.green,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteAction: {
    width: 80,
    backgroundColor: colors.orange,
    justifyContent: "center",
    alignItems: "center",
  },
});
```

- [ ] **Step 2: Run full test suite**

```bash
node --experimental-vm-modules node_modules/.bin/jest --no-coverage
```

Expected: all tests PASS (TypeScript errors for missing `onEdit` prop will surface at compile time in the next step when CategorySection is updated).

- [ ] **Step 3: Commit**

```bash
git add components/SwipeableShoppingItem.tsx
git commit -m "feat: add EditAction to SwipeableShoppingItem"
```

---

## Task 4: Update `CategorySection` — thread `onEdit`

**Files:**
- Modify: `components/CategorySection.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SwipeableShoppingItem } from './SwipeableShoppingItem';
import { CategoryHeader } from './ui/CategoryHeader';
import { spacing } from '../constants/tokens';
import type { ShoppingItemRow } from '../types/db';

interface Props {
  category: string;
  items: ShoppingItemRow[];
  isOneoff: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (item: ShoppingItemRow) => void;
}

export function CategorySection({ category, items, isOneoff, onToggle, onDelete, onEdit }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.headerPad}>
        <CategoryHeader label={category} isOneoff={isOneoff} />
      </View>
      {items.map((item) => (
        <SwipeableShoppingItem
          key={item.id}
          item={item}
          onToggle={() => onToggle(item.id)}
          onDelete={() => onDelete(item.id)}
          onEdit={() => onEdit(item)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[2],
  },
  headerPad: {
    paddingHorizontal: spacing[4],
  },
});
```

- [ ] **Step 2: Run full test suite**

```bash
node --experimental-vm-modules node_modules/.bin/jest --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add components/CategorySection.tsx
git commit -m "feat: thread onEdit through CategorySection"
```

---

## Task 5: Wire up `shop.tsx`

**Files:**
- Modify: `app/(tabs)/shop.tsx`

- [ ] **Step 1: Add `editingItem` state and wire `updateItem`**

At the top of `ShopScreen`, update the destructuring from `useShoppingItems` and add the new state:

```tsx
const { items, toggleItem, addItem, updateItem, deleteItem } = useShoppingItems(plan?.row.id ?? null);
const [sheetVisible, setSheetVisible] = useState(false);
const [editingItem, setEditingItem] = useState<ShoppingItemRow | null>(null);
```

Add the `ShoppingItemRow` import at the top of the file if not already present:

```tsx
import type { ShoppingItemRow } from '../../types/db';
```

- [ ] **Step 2: Update `CategorySection` usage to pass `onEdit`**

Replace each `CategorySection` call in the JSX (there is one, inside `orderedCategories.map`):

```tsx
<CategorySection
  key={cat}
  category={cat}
  items={catItems}
  isOneoff={isCategoryOneoff(cat)}
  onToggle={toggleItem}
  onDelete={deleteItem}
  onEdit={setEditingItem}
/>
```

- [ ] **Step 3: Update `AddItemSheet` usage**

Replace the existing `AddItemSheet` render at the bottom of the JSX:

```tsx
<AddItemSheet
  visible={sheetVisible || editingItem !== null}
  categories={allCategories}
  onAdd={addItem}
  onSave={(id, data) => {
    updateItem(id, data);
    setEditingItem(null);
  }}
  onClose={() => {
    setSheetVisible(false);
    setEditingItem(null);
  }}
  initialItem={editingItem ?? undefined}
/>
```

- [ ] **Step 4: Run full test suite**

```bash
node --experimental-vm-modules node_modules/.bin/jest --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/(tabs)/shop.tsx
git commit -m "feat: wire edit item flow in ShopScreen"
```

---

## Done

All commits land on `main`. Manual smoke test:
1. Open the shopping list with an active plan.
2. Swipe left on any item — confirm green Edit button and orange Delete button appear.
3. Tap Edit — confirm sheet opens pre-populated with the item's fields.
4. Change the category (e.g. "Fresh Produce" → "Freezer") and tap Save changes.
5. Confirm the item moves to the correct category section.
6. Tap "+ Add note", type a note, save — confirm it displays on the item.
7. Swipe left and tap Delete — confirm item is removed (existing behaviour unchanged).
