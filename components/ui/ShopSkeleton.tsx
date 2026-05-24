import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Skeleton } from './Skeleton';
import { colors, spacing, radius } from '../../constants/tokens';

function ShoppingItemSkeleton() {
  return (
    <View style={styles.item}>
      <Skeleton width={20} height={20} borderRadius={4} style={styles.checkbox} />
      <View style={styles.itemText}>
        <Skeleton height={13} borderRadius={3} />
        <Skeleton width="50%" height={11} borderRadius={3} style={styles.itemSub} />
      </View>
    </View>
  );
}

function CategorySkeleton({ itemCount }: { itemCount: number }) {
  return (
    <View style={styles.category}>
      <View style={styles.catHeader}>
        <Skeleton width={7} height={7} borderRadius={4} style={styles.catDot} />
        <Skeleton width={100} height={12} borderRadius={3} />
      </View>
      {Array.from({ length: itemCount }, (_, i) => (
        <ShoppingItemSkeleton key={i} />
      ))}
    </View>
  );
}

export function ShopSkeleton() {
  const { top } = useSafeAreaInsets();
  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading…"
    >
      {/* Green header skeleton */}
      <View style={[styles.header, { paddingTop: spacing[4] + top }]}>
        <Skeleton variant="dark" width={180} height={28} borderRadius={4} />
        <Skeleton variant="dark" width={120} height={11} borderRadius={3} style={styles.weekLabel} />
        <View style={styles.pillsRow}>
          <Skeleton variant="dark" width={90} height={24} borderRadius={radius.xl} />
          <Skeleton variant="dark" width={90} height={24} borderRadius={radius.xl} />
        </View>
        <Skeleton variant="dark" height={6} borderRadius={3} style={styles.progressBar} />
      </View>

      {/* Category sections */}
      <View style={styles.body}>
        <CategorySkeleton itemCount={4} />
        <CategorySkeleton itemCount={3} />
        <CategorySkeleton itemCount={2} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    backgroundColor: colors.green,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
  },
  weekLabel: {
    marginTop: spacing[2],
  },
  pillsRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[3],
  },
  progressBar: {
    marginTop: spacing[3],
  },
  body: {
    flex: 1,
    paddingTop: spacing[2],
  },
  category: {
    marginBottom: spacing[2],
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[2],
  },
  catDot: {
    marginRight: spacing[1],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: spacing[3],
  },
  checkbox: {
    flexShrink: 0,
  },
  itemText: {
    flex: 1,
    gap: spacing[1],
  },
  itemSub: {
    marginTop: spacing[1],
  },
});
