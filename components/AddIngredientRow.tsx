import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AppText } from './ui/AppText';
import { colors, spacing, radius, font } from '../constants/tokens';

interface Props {
  onPress: () => void;
}

export function AddIngredientRow({ onPress }: Props) {
  return (
    <TouchableOpacity
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      activeOpacity={0.7}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel="Add ingredient"
    >
      <View style={styles.plus}>
        <AppText weight="extrabold" size="md" color="cream">+</AppText>
      </View>
      <AppText weight="bold" size="md" color="green" style={styles.label}>
        Add ingredient
      </AppText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3] + 2,
    paddingHorizontal: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.checkboxBorder,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(232, 240, 238, 0.35)',
  },
  plus: {
    width: 18,
    height: 18,
    borderRadius: radius.full,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    letterSpacing: font.tracking.label,
  },
});
