import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText } from './ui/AppText';
import { Divider } from './ui/Divider';
import { colors, spacing } from '../constants/tokens';
import * as Haptics from 'expo-haptics';
import type { Ingredient } from '../meal_plan.types';
import { formatAmount } from '../lib/amount';

interface MacroContribution {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface Props {
  ingredient: Ingredient;
  nutrition?: MacroContribution | null;
  onPress?: () => void;
}

export function IngredientRow({ ingredient, nutrition, onPress }: Props) {
  const inner = (
    <>
      <View style={styles.row}>
        <View style={styles.nameCol}>
          <AppText weight="semibold" color="textPrimary" size="md">
            {ingredient.item}
          </AppText>
          {nutrition ? (
            <View
              style={styles.chipRow}
              accessible
              accessibilityLabel={`${Math.round(nutrition.protein_g)}g protein, ${Math.round(nutrition.carbs_g)}g carbs, ${Math.round(nutrition.fat_g)}g fat`}
            >
              <View style={styles.macroChip} importantForAccessibility="no-hide-descendants">
                <AppText weight="semibold" size="2xs" color="textSecondary">
                  P {Math.round(nutrition.protein_g)}g
                </AppText>
              </View>
              <View style={styles.macroChip} importantForAccessibility="no-hide-descendants">
                <AppText weight="semibold" size="2xs" color="textSecondary">
                  C {Math.round(nutrition.carbs_g)}g
                </AppText>
              </View>
              <View style={styles.macroChip} importantForAccessibility="no-hide-descendants">
                <AppText weight="semibold" size="2xs" color="textSecondary">
                  F {Math.round(nutrition.fat_g)}g
                </AppText>
              </View>
            </View>
          ) : onPress ? (
            <AppText weight="regular" size="2xs" color="textTertiary" style={styles.hint}>
              tap to add nutrition
            </AppText>
          ) : null}
        </View>
        <AppText weight="bold" color="orange" size="md">{formatAmount(ingredient.amount)}</AppText>
      </View>
      <Divider />
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={ingredient.item}
        accessibilityHint={nutrition ? 'Tap to edit nutrition data' : 'Tap to add nutrition data'}
      >
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  nameCol: {
    flex: 1,
    marginRight: spacing[3],
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  macroChip: {
    backgroundColor: colors.chipSurface,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  hint: {
    marginTop: spacing[1],
  },
});
