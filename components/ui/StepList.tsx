import React from 'react';
import { View } from 'react-native';
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
    <View style={{ gap: spacing[3] }}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <View key={index} style={{ flexDirection: 'row', gap: spacing[3], alignItems: 'flex-start' }}>
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: isLast ? colors.orange : colors.green,
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              <AppText weight="bold" size="2xs" color="onGreen">{String(index + 1)}</AppText>
            </View>
            <AppText color="textPrimary" style={{ flex: 1 }}>{step}</AppText>
          </View>
        );
      })}
    </View>
  );
}
