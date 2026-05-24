import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText } from './ui/AppText';
import { colors, spacing } from '../constants/tokens';

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
  onPress?: () => void;
}

export function DayCard({ day, onPress }: Props) {
  const inner = (
    <>
      <View style={styles.topRow}>
        <AppText weight="bold" color="textPrimary" size="xl">{day.day}</AppText>
        <View style={styles.stats}>
          <AppText weight="semibold" color="orange" size="sm">{day.calories} cal</AppText>
          <AppText weight="regular" color="textTertiary" size="sm"> · </AppText>
          <AppText weight="semibold" color="textSecondary" size="sm">{day.protein_g}g protein</AppText>
        </View>
      </View>
      <View style={styles.mealsRow}>
        <MealLabel letter="B" meal={day.breakfast} />
        <MealLabel letter="L" meal={day.lunch} />
        <MealLabel letter="D" meal={day.dinner} />
      </View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={`${day.day}, tap to view recipe`}
      >
        {inner}
      </TouchableOpacity>
    );
  }

  return <View style={styles.card}>{inner}</View>;
}

function MealLabel({ letter, meal }: { letter: string; meal: string }) {
  return (
    <View style={styles.mealLabel}>
      <AppText weight="bold" color="terracotta" size="sm">{letter}</AppText>
      <AppText weight="regular" color="textSecondary" size="sm"> {meal}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    gap: spacing[2],
    marginBottom: 1,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stats: { flexDirection: 'row', alignItems: 'center' },
  mealsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  mealLabel: { flexDirection: 'row', alignItems: 'center' },
});
