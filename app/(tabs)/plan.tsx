import { router } from "expo-router";
import { useMemo } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { DayCard } from "../../components/DayCard";
import { TodayCard } from "../../components/TodayCard";
import { AppText } from "../../components/ui/AppText";
import { EmptyState } from "../../components/ui/EmptyState";
import { PlanSkeleton } from "../../components/ui/PlanSkeleton";
import { colors, font, radius, shadow, spacing } from "../../constants/tokens";
import { usePlan } from "../../hooks/usePlan";
import { SelfBuiltPlanView } from "../../components/SelfBuiltPlanView";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

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
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const { plan, loading, createSelfBuiltPlan } = usePlan();

  /** Sunday of the current week, as a local ISO date. */
  function thisSunday(): string {
    const n = new Date();
    const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() - n.getDay());
    const pad = (v: number) => String(v).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  async function handleBuildPlan() {
    await createSelfBuiltPlan(thisSunday());
  }

  const days = useMemo<DisplayDay[]>(() => {
    if (!plan) return [];
    return plan.days.map((d, idx) => ({
      day: DAY_NAMES[idx] ?? d.day,
      breakfast: d.meals?.breakfast?.name ?? "—",
      lunch: d.meals?.lunch?.name ?? "—",
      dinner: d.meals?.dinner?.name ?? "—",
      calories: d.calories ?? 0,
      protein_g: d.protein_g ?? 0,
      batchRef:
        (d.meals?.dinner?.batch_ref as string | undefined) ??
        (d.meals?.lunch?.batch_ref as string | undefined) ??
        (d.meals?.breakfast?.batch_ref as string | undefined) ??
        null,
    }));
  }, [plan]);

  if (loading) {
    return (
      <View style={styles.outerContainer}>
        <PlanSkeleton />
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={styles.outerContainer}>
        <View style={[styles.emptyContainer, { marginTop: insets.top }]}>
          <EmptyState
            onImport={() => router.push("/settings")}
            onBuild={handleBuildPlan}
          />
        </View>
      </View>
    );
  }

  // A self-built plan has no per-day structure — days_json is []. Its home is
  // the recipe set, not the day grid.
  if (plan.row.source === "self_built") {
    return <SelfBuiltPlanView planId={plan.row.id} />;
  }

  // plan.days is DayPlan[] — already parsed, access d.meals.breakfast.name etc.
  const calTarget: number = plan.days[0]?.calories ?? 2000;

  // today's day index (0=Sun … 6=Sat) maps directly to days array index
  const todayIndex = new Date().getDay();

  // Parse plan start as local midnight to avoid UTC timezone offset bugs
  const planStart = parseLocalDate(plan.row.week_starting);
  const planEnd = new Date(
    planStart.getFullYear(),
    planStart.getMonth(),
    planStart.getDate() + 7,
  );
  const todayLocal = (() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  })();
  const isTodayInPlan = todayLocal >= planStart && todayLocal < planEnd;

  // Format week range: "DD–DD MMM" in uppercase
  const startDay = planStart.getDate();
  const endDate = new Date(
    planStart.getFullYear(),
    planStart.getMonth(),
    planStart.getDate() + 6,
  );
  const endDay = endDate.getDate();
  const monthShort = planStart.toLocaleString("en-AU", { month: "short" });
  const weekRange = `${startDay}–${endDay} ${monthShort.toUpperCase()}`;

  const todayDay = isTodayInPlan ? days[todayIndex] : null;
  const otherDays = days.filter(
    (_, idx) => !isTodayInPlan || idx !== todayIndex,
  );

  return (
    <View style={styles.outerContainer}>
      <ScrollView
        style={[styles.container, { marginTop: insets.top }]}
        contentContainerStyle={styles.content}
      >
        {/* Top row: week range + cal target + import button */}
        <View style={styles.topRow}>
          <View>
            <AppText
              weight="bold"
              color="terracotta"
              size="sm"
              style={styles.weekLabel}
            >
              {weekRange}
            </AppText>
            <AppText weight="semibold" color="textSecondary" size="xs">
              {calTarget} cal target
            </AppText>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/settings")}
            style={styles.importBtn}
            accessibilityRole="button"
            accessibilityLabel="Import new meal plan"
          >
            <Ionicons name="folder-open-outline" size={14} color={colors.green} />
            <AppText weight="bold" color="green" size="2xs">
              Import
            </AppText>
          </TouchableOpacity>
        </View>

        {todayDay && <TodayCard day={todayDay} />}

        <View style={styles.otherDays}>
          {otherDays.map((day) => (
            <DayCard
              key={day.day}
              day={day}
              onPress={
                day.batchRef
                  ? () => router.push(`/recipe/${day.batchRef}`)
                  : undefined
              }
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: colors.green },
  container: { flex: 1, backgroundColor: colors.cream },
  content: { paddingBottom: spacing[10] },
  emptyContainer: { flex: 1, backgroundColor: colors.cream },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
  },
  weekLabel: { letterSpacing: font.tracking.category, textTransform: "uppercase" },
  importBtn: {
    flexDirection: "row",
    gap: spacing[1] + 2,
    backgroundColor: colors.card,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.xl,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    ...shadow.pill,
  },
  otherDays: {
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    borderRadius: radius.lg,
    overflow: "hidden",
  },
});
