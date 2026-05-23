import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { AppText } from './ui/AppText';
import { colors, spacing, radius } from '../constants/tokens';
import type { BatchStep } from '../meal_plan.types';

interface Props {
  steps: BatchStep[];
  onPress: () => void;
}

export function BatchPlanBanner({ steps, onPress }: Props) {
  const startTime = steps[0]?.time;
  const subLabel = startTime
    ? `${steps.length} steps · starts ${startTime}`
    : `${steps.length} steps`;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={styles.banner}
      accessibilityRole="button"
      accessibilityLabel="Sunday Batch Plan"
    >
      <View style={styles.textCol}>
        <AppText weight="extrabold" color="onGreen" size="lg">Sunday Batch Plan</AppText>
        <AppText weight="semibold" color="onGreenSubtle" size="sm">{subLabel}</AppText>
      </View>
      <AppText size="xl">🥘</AppText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.green,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  textCol: {
    flex: 1,
    gap: spacing[1],
  },
});
