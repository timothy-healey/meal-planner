import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { AppText } from './ui/AppText';
import { colors, spacing, radius, shadow } from '../constants/tokens';
import { formatCookTime } from '../lib/format';
import type { Recipe } from '../hooks/useRecipes';

interface Props {
  recipe: Recipe;
  onPress: () => void;
}

export function RecipeCard({ recipe, onPress }: Props) {
  const timeLabel = formatCookTime(recipe.prep_minutes, recipe.cook_minutes);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={recipe.title}
    >
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
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
});
