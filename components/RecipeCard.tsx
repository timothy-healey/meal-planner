import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { AppText } from './ui/AppText';
import { colors, spacing, radius, shadow, font } from '../constants/tokens';
import { formatCookTime } from '../lib/format';
import type { Recipe } from '../hooks/useRecipes';

interface Props {
  recipe: Recipe;
  onPress: () => void;
  /** Part of the active plan — marked, not reordered. */
  inPlan?: boolean;
}

export function RecipeCard({ recipe, onPress, inPlan = false }: Props) {
  const timeLabel = formatCookTime(recipe.prep_minutes, recipe.cook_minutes);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={inPlan ? `${recipe.title}, in this week's plan` : recipe.title}
    >
      {/* Terracotta, not orange: DESIGN.md reserves orange for actions and
          headline numbers, and this is taxonomy — a label, not a verb. */}
      {inPlan && (
        <View style={styles.thisWeek}>
          <AppText weight="bold" size="2xs" color="terracotta" style={styles.thisWeekText}>
            THIS WEEK
          </AppText>
        </View>
      )}
      <AppText weight="bold" color="textPrimary" size="lg">{recipe.title}</AppText>
      <View style={styles.stats}>
        <AppText weight="semibold" color="orange" size="sm">
          {recipe.calories_per_serve} cal
        </AppText>
        <AppText weight="regular" color="textTertiary" size="sm"> · </AppText>
        <AppText weight="semibold" color="textSecondary" size="sm">
          {recipe.protein_per_serve_g}g protein
        </AppText>
        <AppText weight="regular" color="textTertiary" size="sm"> · </AppText>
        <AppText weight="regular" color="textTertiary" size="sm">{timeLabel}</AppText>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing[5],
    gap: spacing[2],
    ...shadow.card,
  },
  thisWeek: {
    alignSelf: 'flex-start',
    backgroundColor: colors.saleTint,
    borderRadius: radius.xs,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  thisWeekText: { letterSpacing: font.tracking.category },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
});
