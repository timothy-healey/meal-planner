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
  const { items, toggleItem } = useShoppingItems(plan?.row.id ?? null);
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
            Week of {formatWeekOf(plan.row.week_starting)}
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
