import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { GreenHeader } from '../../components/ui/GreenHeader';
import { AppText } from '../../components/ui/AppText';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { EmptyState } from '../../components/ui/EmptyState';
import { CategorySection } from '../../components/CategorySection';
import { BasketSection } from '../../components/BasketSection';
import { AddItemSheet } from '../../components/AddItemSheet';
import { usePlan } from '../../hooks/usePlan';
import { useShoppingItems } from '../../hooks/useShoppingItems';
import type { ShoppingItemRow } from '../../types/db';
import { useCategoryOrder } from '../../hooks/useCategoryOrder';
import { formatWeekOf, formatPrice, formatItemCount } from '../../lib/format';
import { colors, spacing, radius, shadow } from '../../constants/tokens';

const TITLE_COLLAPSE_START = 10;
const TITLE_COLLAPSE_END = 55;

export default function ShopScreen() {
  const { plan } = usePlan();
  const { items, toggleItem, addItem, updateItem, deleteItem } = useShoppingItems(plan?.row.id ?? null);
  const { applySavedOrder } = useCategoryOrder();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItemRow | null>(null);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const titleRowStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [TITLE_COLLAPSE_START, TITLE_COLLAPSE_END], [1, 0], Extrapolation.CLAMP);
    const maxHeight = interpolate(scrollY.value, [TITLE_COLLAPSE_START, TITLE_COLLAPSE_END], [62, 0], Extrapolation.CLAMP);
    return { opacity, maxHeight, overflow: 'hidden' };
  });

  const uncheckedItems = items.filter((i) => i.is_checked === 0);
  const checkedItems = items.filter((i) => i.is_checked === 1);

  const allCategories = [...new Set(items.map((i) => i.category))];

  const allCategoryNames = [...new Set(uncheckedItems.map((i) => i.category))];
  const isCategoryOneoff = (cat: string) =>
    uncheckedItems.some((i) => i.category === cat && i.is_oneoff === 1);

  const sortedNames = applySavedOrder(allCategoryNames);
  const regularCategories = sortedNames.filter((c) => !isCategoryOneoff(c));
  const oneoffCategories = sortedNames.filter((c) => isCategoryOneoff(c));
  const orderedCategories = [...regularCategories, ...oneoffCategories];

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
      <GreenHeader>
        <View style={styles.headerContent}>
          <Animated.View style={[styles.titleRow, titleRowStyle, { paddingBottom: spacing[2] }]}>
            <AppText weight="extrabold" color="onGreen" size="3xl">Shopping List</AppText>
            <TouchableOpacity
              onPress={() => router.push('/category-order')}
              style={styles.reorderBtn}
              accessibilityLabel="Reorder categories"
              accessibilityRole="button"
            >
              <Ionicons name="swap-vertical-outline" size={22} color={colors.onGreen} />
            </TouchableOpacity>
          </Animated.View>

          <AppText weight="semibold" color="onGreenSubtle" size="xs">
            Week of {formatWeekOf(plan.row.week_starting)}
          </AppText>

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

          <ProgressBar progress={progress} />

          <AppText weight="semibold" color="onGreenSubtle" size="2xs" style={styles.itemsLeft}>
            {itemsLeft} item{itemsLeft !== 1 ? 's' : ''} left
          </AppText>
        </View>
      </GreenHeader>

      <Animated.ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
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
              onDelete={deleteItem}
              onEdit={setEditingItem}
            />
          );
        })}

        {checkedItems.length > 0 && (
          <BasketSection items={checkedItems} onToggle={toggleItem} />
        )}
      </Animated.ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setSheetVisible(true)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Add item to shopping list"
      >
        <Ionicons name="add" size={32} color={colors.onGreen} />
      </TouchableOpacity>

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
    paddingBottom: spacing[1],
    gap: spacing[1],
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
  itemsLeft: {},
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingBottom: 100,
  },
  fab: {
    position: 'absolute',
    bottom: spacing[6],
    right: spacing[5],
    width: 60,
    height: 60,
    borderRadius: radius.full,
    backgroundColor: colors.orange,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.pill,
  },
});
