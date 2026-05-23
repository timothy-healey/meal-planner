import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from './ui/AppText';
import { Divider } from './ui/Divider';
import { spacing } from '../constants/tokens';
import type { Ingredient } from '../meal_plan.types';

interface Props {
  ingredient: Ingredient;
}

export function IngredientRow({ ingredient }: Props) {
  return (
    <>
      <View style={styles.row}>
        <AppText weight="semibold" color="textPrimary" size="md" style={styles.name}>
          {ingredient.item}
        </AppText>
        <AppText weight="bold" color="orange" size="md">{ingredient.amount}</AppText>
      </View>
      <Divider />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  name: {
    flex: 1,
    marginRight: spacing[3],
  },
});
