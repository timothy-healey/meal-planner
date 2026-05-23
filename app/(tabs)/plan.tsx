import React from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { AppText } from '../../components/ui/AppText';
import { EmptyState } from '../../components/ui/EmptyState';
import { TodayCard } from '../../components/TodayCard';
import { DayCard } from '../../components/DayCard';
import { usePlan } from '../../hooks/usePlan';
import { colors, spacing, radius, shadow } from '../../constants/tokens';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface DisplayDay {
  day: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  calories: number;
  protein_g: number;
  batchRef: string | null;
}

/** Parse "YYYY-MM-DD" as local midnight — avoids UTC offset bugs in timezones like Adelaide */
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function PlanScreen() {
  const { plan } = usePlan();

  if (!plan) {
    return (
      <View style={styles.emptyContainer}>
        <EmptyState onImport={() => router.push('/settings')} />
      </View>
    );
  }

  // plan.days is DayPlan[] — already parsed, access d.meals.breakfast.name etc.
  const calTarget: number = plan.days[0]?.calories ?? 2000;

  const days: DisplayDay[] = plan.days.map((d, idx) => ({
    day: DAY_NAMES[idx] ?? d.day,
    breakfast: d.meals?.breakfast?.name ?? '—',
    lunch: d.meals?.lunch?.name ?? '—',
    dinner: d.meals?.dinner?.name ?? '—',
    calories: d.calories ?? 0,
    protein_g: d.protein_g ?? 0,
    // Navigate to whichever meal has a batch_ref (dinner first, then lunch, then breakfast)
    batchRef:
      (d.meals?.dinner?.batch_ref as string | undefined) ??
      (d.meals?.lunch?.batch_ref as string | undefined) ??
      (d.meals?.breakfast?.batch_ref as string | undefined) ??
      null,
  }));

  // today's day index (0=Sun … 6=Sat) maps directly to days array index
  const todayIndex = new Date().getDay();

  // Parse plan start as local midnight to avoid UTC timezone offset bugs
  const planStart = parseLocalDate(plan.row.week_starting);
  const planEnd = new Date(planStart.getFullYear(), planStart.getMonth(), planStart.getDate() + 7);
  const todayLocal = (() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  })();
  const isTodayInPlan = todayLocal >= planStart && todayLocal < planEnd;

  // Format week range: "DD–DD MMM" in uppercase
  const startDay = planStart.getDate();
  const endDate = new Date(planStart.getFullYear(), planStart.getMonth(), planStart.getDate() + 6);
  const endDay = endDate.getDate();
  const monthShort = planStart.toLocaleString('en-AU', { month: 'short' });
  const weekRange = `${startDay}–${endDay} ${monthShort.toUpperCase()}`;

  const todayDay = isTodayInPlan ? days[todayIndex] : null;
  const otherDays = days.filter((_, idx) => !isTodayInPlan || idx !== todayIndex);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top row: week range + cal target + import button */}
      <View style={styles.topRow}>
        <View>
          <AppText weight="bold" color="terracotta" size="sm" style={styles.weekLabel}>
            {weekRange}
          </AppText>
          <AppText weight="semibold" color="textSecondary" size="xs">
            {calTarget} cal target
          </AppText>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/settings')}
          style={styles.importBtn}
          accessibilityRole="button"
          accessibilityLabel="Import new meal plan"
        >
          <AppText weight="bold" color="green" size="2xs">📂 Import</AppText>
        </TouchableOpacity>
      </View>

      {todayDay && <TodayCard day={todayDay} />}

      <View style={styles.otherDays}>
        {otherDays.map((day, idx) => (
          <DayCard
            key={day.day}
            day={day}
            isFirst={idx === 0}
            isLast={idx === otherDays.length - 1}
            onPress={day.batchRef ? () => router.push(`/recipe/${day.batchRef}`) : undefined}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { paddingBottom: spacing[10] },
  emptyContainer: { flex: 1, backgroundColor: colors.cream },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[6],
    paddingBottom: spacing[2],
  },
  weekLabel: { letterSpacing: 0.3, textTransform: 'uppercase' },
  importBtn: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.xl,
    ...shadow.pill,
  },
  otherDays: {
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    borderRadius: radius.md,
    overflow: 'hidden',
  },
});
