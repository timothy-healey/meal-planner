import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from './Skeleton';
import { colors, spacing, radius } from '../../constants/tokens';

function DayRowSkeleton() {
  return (
    <View style={styles.dayRow}>
      <Skeleton width={64} height={13} borderRadius={4} style={styles.dayName} />
      <View style={styles.meals}>
        <Skeleton height={11} borderRadius={3} />
        <Skeleton height={11} borderRadius={3} style={styles.mealLine} />
        <Skeleton width="60%" height={11} borderRadius={3} style={styles.mealLine} />
      </View>
    </View>
  );
}

export function PlanSkeleton() {
  return (
    <View style={styles.container}>
      {/* Top row: week range + cal target */}
      <View style={styles.topRow}>
        <View style={styles.topLeft}>
          <Skeleton width={100} height={13} borderRadius={4} />
          <Skeleton width={80} height={11} borderRadius={3} style={styles.calLabel} />
        </View>
        <Skeleton width={72} height={32} borderRadius={radius.xl} />
      </View>

      {/* Today card placeholder */}
      <View style={styles.todayCard}>
        <Skeleton width={48} height={11} borderRadius={3} style={styles.todayLabel} />
        <Skeleton height={18} borderRadius={4} style={styles.todayTitle} />
        <Skeleton width="70%" height={13} borderRadius={3} />
      </View>

      {/* Day list */}
      <View style={styles.dayList}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <DayRowSkeleton key={i} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
  },
  topLeft: {
    gap: spacing[1],
  },
  calLabel: {
    marginTop: spacing[1],
  },
  todayCard: {
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing[4],
  },
  todayLabel: {
    marginBottom: spacing[2],
  },
  todayTitle: {
    marginBottom: spacing[2],
  },
  dayList: {
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  dayRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: spacing[3],
  },
  dayName: {
    marginTop: spacing[1],
  },
  meals: {
    flex: 1,
    gap: spacing[1],
  },
  mealLine: {
    marginTop: spacing[1],
  },
});
