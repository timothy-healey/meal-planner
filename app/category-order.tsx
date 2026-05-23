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
  const { items } = useShoppingItems(plan?.row.id ?? null);
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
