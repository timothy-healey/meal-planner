import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { colors, spacing } from '../../constants/tokens';

interface StepListProps {
  steps: string[];
  method?: string;
}

export function StepList({ steps, method }: StepListProps) {
  if (steps.length === 0 && method) {
    return <AppText color="textPrimary">{method}</AppText>;
  }

  return (
    <View style={styles.list}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <View key={index} style={styles.row}>
            <View style={[styles.badge, isLast && styles.badgeLast]}>
              <AppText weight="bold" size="2xs" color="onGreen">{String(index + 1)}</AppText>
            </View>
            <AppText color="textPrimary" style={styles.text}>{step}</AppText>
          </View>
        );
      })}
    </View>
  );
}

const BADGE_SIZE = 18;

const styles = StyleSheet.create({
  list: {
    gap: spacing[3],
  },
  row: {
    flexDirection: 'row',
    gap: spacing[3],
    alignItems: 'flex-start',
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  badgeLast: {
    backgroundColor: colors.orange,
  },
  text: {
    flex: 1,
  },
});
