import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from './ui/AppText';
import { colors, spacing, radius } from '../constants/tokens';

interface DayData {
  day: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  calories: number;
  protein_g: number;
}

interface Props {
  day: DayData;
}

// Only rendered for today's date — green card with TODAY badge
export function TodayCard({ day }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppText weight="extrabold" color="onGreen" size="lg">{day.day}</AppText>
        <View style={styles.badge}>
          <AppText weight="bold" color="orange" size="2xs">TODAY</AppText>
        </View>
      </View>

      <View style={styles.meals}>
        <MealRow letter="B" meal={day.breakfast} />
        <MealRow letter="L" meal={day.lunch} />
        <MealRow letter="D" meal={day.dinner} />
      </View>

      <View style={styles.footer}>
        <AppText weight="bold" color="orange" size="sm">{day.calories} cal</AppText>
        <AppText weight="semibold" color="onGreenSubtle" size="sm">{day.protein_g}g protein</AppText>
      </View>
    </View>
  );
}

function MealRow({ letter, meal }: { letter: string; meal: string }) {
  return (
    <View style={styles.mealRow}>
      <AppText weight="bold" color="onGreen" size="md" style={styles.letter}>{letter}</AppText>
      <AppText weight="medium" color="onGreenSubtle" size="md" style={styles.mealName}>{meal}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.green,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
  },
  badge: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 9999,
  },
  meals: {
    paddingHorizontal: spacing[4],
    gap: spacing[2],
    paddingBottom: spacing[3],
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  letter: { width: 16 },
  mealName: { flex: 1 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
});
