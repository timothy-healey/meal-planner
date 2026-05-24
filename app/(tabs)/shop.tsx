import React, { useState, useCallback, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { GreenHeader } from '../../components/ui/GreenHeader';
import { AppText } from '../../components/ui/AppText';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { EmptyState } from '../../components/ui/EmptyState';
import { CategorySection } from '../../components/CategorySection';
import { BasketSection } from '../../components/BasketSection';
import { AddItemSheet } from '../../components/AddItemSheet';
import { ReviewItemSheet } from '../../components/ReviewItemSheet';
import { StorePickerSheet } from '../../components/StorePickerSheet';
import { usePlan } from '../../hooks/usePlan';
import { useShoppingItems } from '../../hooks/useShoppingItems';
import { usePurchaseHistory } from '../../hooks/usePurchaseHistory';
import { useShoppingMode } from '../../hooks/useShoppingMode';
import { takePendingScanResult } from '../../lib/barcodeScanResult';
import type { ShoppingItemRow, PurchaseHistoryRow } from '../../types/db';
import type { ScanResult } from '../../lib/barcodeScanResult';
import type { AddPurchaseData } from '../../hooks/usePurchaseHistory';
import { useCategoryOrder } from '../../hooks/useCategoryOrder';
import { formatWeekOf, formatPrice, formatItemCount } from '../../lib/format';
import { colors, spacing, radius, shadow } from '../../constants/tokens';

const TITLE_COLLAPSE_START = 10;
const TITLE_COLLAPSE_END = 55;

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const { plan } = usePlan();
  const { items, toggleItem, addItem, updateItem, deleteItem } = useShoppingItems(plan?.row.id ?? null);
  const { applySavedOrder, reload: reloadCategoryOrder } = useCategoryOrder();
  const { addRecord, getLatestForItem } = usePurchaseHistory(plan?.row.id ?? null);
  const { mode, activeStore, savedStores, setMode } = useShoppingMode(plan?.row.id ?? null);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItemRow | null>(null);
  const [reviewItem, setReviewItem] = useState<ShoppingItemRow | null>(null);
  const [reviewLatest, setReviewLatest] = useState<PurchaseHistoryRow | null>(null);
  const [storePickerVisible, setStorePickerVisible] = useState(false);
  const [pendingScan, setPendingScan] = useState<ScanResult | null>(null);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const titleRowStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [TITLE_COLLAPSE_START, TITLE_COLLAPSE_END], [1, 0], Extrapolation.CLAMP);
    const maxHeight = interpolate(scrollY.value, [TITLE_COLLAPSE_START, TITLE_COLLAPSE_END], [62, 0], Extrapolation.CLAMP);
    return { opacity, maxHeight, overflow: 'hidden' };
  });

  // Pick up scanner result and refresh category order when returning to this screen
  useFocusEffect(useCallback(() => {
    reloadCategoryOrder();
    const result = takePendingScanResult();
    if (result) setPendingScan(result);
  }, [reloadCategoryOrder]));

  const {
    uncheckedItems,
    checkedItems,
    allCategories,
    orderedCategories,
    oneoffCategorySet,
    totalItems,
    checkedCount,
    totalBudget,
    progress,
    itemsLeft,
  } = useMemo(() => {
    const unchecked = items.filter((i) => i.is_checked === 0);
    const checked = items.filter((i) => i.is_checked === 1);
    const allCats = [...new Set(items.map((i) => i.category))];
    const uncheckedCatNames = [...new Set(unchecked.map((i) => i.category))];
    const oneoffCats = new Set(
      unchecked.filter((i) => i.is_oneoff === 1).map((i) => i.category)
    );
    const sorted = applySavedOrder(uncheckedCatNames);
    const regular = sorted.filter((c) => !oneoffCats.has(c));
    const oneoff = sorted.filter((c) => oneoffCats.has(c));
    const total = items.length;
    const checkedCnt = checked.length;
    const budget = items.reduce((sum, i) => sum + i.estimated_price, 0);
    return {
      uncheckedItems: unchecked,
      checkedItems: checked,
      allCategories: allCats,
      orderedCategories: [...regular, ...oneoff],
      oneoffCategorySet: oneoffCats,
      totalItems: total,
      checkedCount: checkedCnt,
      totalBudget: budget,
      progress: total > 0 ? checkedCnt / total : 0,
      itemsLeft: total - checkedCnt,
    };
  }, [items, applySavedOrder]);

  async function handleToggle(itemId: string) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    if (mode === 'review' && item.is_checked === 0) {
      const latest = await getLatestForItem(item.name);
      setReviewLatest(latest);
      setReviewItem(item);
    } else {
      toggleItem(itemId);
    }
  }

  async function handleReviewSave(data: AddPurchaseData) {
    if (!reviewItem) return;
    toggleItem(reviewItem.id);
    await addRecord(data);
    setReviewItem(null);
    setReviewLatest(null);
  }

  function handleModeToggle(newMode: 'quick' | 'review') {
    if (newMode === mode) return;
    if (newMode === 'review') {
      setStorePickerVisible(true);
    } else {
      setMode('quick');
    }
  }

  function handleStoreConfirm(storeName: string) {
    setStorePickerVisible(false);
    setMode('review', storeName);
  }

  if (!plan) {
    return (
      <View style={styles.outerEmpty}>
        <View style={[styles.emptyContainer, { marginTop: insets.top }]}>
          <EmptyState onImport={() => router.push('/settings')} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GreenHeader>
        <View style={styles.headerContent}>
          <Animated.View style={[styles.titleRow, titleRowStyle, { paddingBottom: spacing[2] }]}>
            <AppText weight="extrabold" color="onGreen" size="3xl">Shopping List</AppText>
            <View style={styles.titleRowRight}>
              {/* Mode toggle pill */}
              <View style={styles.modeSeg}>
                <TouchableOpacity
                  style={[styles.segOpt, mode === 'quick' && styles.segOptActive]}
                  onPress={() => handleModeToggle('quick')}
                  activeOpacity={0.8}
                >
                  <AppText weight="bold" size="2xs" color={mode === 'quick' ? 'green' : 'onGreenSubtle'}>
                    Quick
                  </AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segOpt, mode === 'review' && styles.segOptActive]}
                  onPress={() => handleModeToggle('review')}
                  activeOpacity={0.8}
                >
                  <AppText weight="bold" size="2xs" color={mode === 'review' ? 'green' : 'onGreenSubtle'}>
                    Review
                  </AppText>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/category-order')}
                style={styles.reorderBtn}
                accessibilityLabel="Reorder categories"
                accessibilityRole="button"
              >
                <Ionicons name="swap-vertical-outline" size={22} color={colors.onGreen} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Week label + store pill */}
          <View style={styles.weekStoreRow}>
            <AppText weight="semibold" color="onGreenSubtle" size="xs">
              Week of {formatWeekOf(plan.row.week_starting)}
            </AppText>
            {mode === 'review' && activeStore && (
              <View style={styles.storePill}>
                <Ionicons name="location-outline" size={10} color={colors.onGreenSubtle} />
                <AppText weight="bold" size="2xs" color="onGreenSubtle">{activeStore}</AppText>
              </View>
            )}
          </View>

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
              isOneoff={oneoffCategorySet.has(cat)}
              onToggle={handleToggle}
              onDelete={deleteItem}
              onEdit={setEditingItem}
            />
          );
        })}

        {checkedItems.length > 0 && (
          <BasketSection
            items={checkedItems}
            onToggle={handleToggle}
            onDelete={deleteItem}
            onEdit={setEditingItem}
          />
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

      <ReviewItemSheet
        visible={reviewItem !== null}
        item={reviewItem}
        store={activeStore ?? ''}
        latestRecord={reviewLatest}
        pendingScan={pendingScan}
        onSave={handleReviewSave}
        onClose={() => { setReviewItem(null); setReviewLatest(null); }}
        onPendingScanConsumed={() => setPendingScan(null)}
      />

      <StorePickerSheet
        visible={storePickerVisible}
        stores={savedStores}
        onConfirm={handleStoreConfirm}
        onClose={() => setStorePickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  outerEmpty: { flex: 1, backgroundColor: colors.green },
  emptyContainer: { flex: 1, backgroundColor: colors.cream },
  headerContent: { paddingBottom: spacing[1], gap: spacing[1] },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  modeSeg: {
    flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: radius.full, padding: 2, gap: 2,
  },
  segOpt: { borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: spacing[1] },
  segOptActive: { backgroundColor: colors.onGreen },
  reorderBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  weekStoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  storePill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: radius.full,
    paddingHorizontal: spacing[2], paddingVertical: spacing[1],
  },
  pillsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2] },
  pill: { backgroundColor: colors.headerPill, paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: 9999 },
  itemsLeft: {},
  body: { flex: 1 },
  bodyContent: { paddingBottom: 100 },
  fab: {
    position: 'absolute', bottom: spacing[6], right: spacing[5],
    width: 60, height: 60, borderRadius: radius.full,
    backgroundColor: colors.orange, justifyContent: 'center', alignItems: 'center',
    ...shadow.pill,
  },
});
