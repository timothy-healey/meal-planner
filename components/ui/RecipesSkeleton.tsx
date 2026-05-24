import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from './Skeleton';
import { colors, spacing, radius } from '../../constants/tokens';

function RecipeCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton height={18} borderRadius={4} style={styles.cardTitle} />
      <Skeleton width="60%" height={13} borderRadius={3} style={styles.cardSub} />
    </View>
  );
}

function GroupSkeleton({ cardCount }: { cardCount: number }) {
  return (
    <View style={styles.group}>
      {/* Category header */}
      <View style={styles.catHeader}>
        <Skeleton width={7} height={7} borderRadius={4} style={styles.catDot} />
        <Skeleton width={80} height={12} borderRadius={3} />
      </View>
      <View style={styles.cards}>
        {Array.from({ length: cardCount }, (_, i) => (
          <RecipeCardSkeleton key={i} />
        ))}
      </View>
    </View>
  );
}

export function RecipesSkeleton() {
  return (
    <View style={styles.container}>
      <GroupSkeleton cardCount={3} />
      <GroupSkeleton cardCount={2} />
      <GroupSkeleton cardCount={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingTop: spacing[2],
  },
  group: {
    marginTop: spacing[4],
    paddingHorizontal: spacing[4],
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
    gap: spacing[2],
  },
  catDot: {
    marginRight: spacing[1],
  },
  cards: {
    gap: spacing[3],
    paddingTop: spacing[2],
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing[4],
  },
  cardTitle: {
    marginBottom: spacing[2],
  },
  cardSub: {},
});
