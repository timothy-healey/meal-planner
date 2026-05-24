import React from 'react';
import { TouchableOpacity, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AppText } from './AppText';
import { colors, radius, shadow, spacing } from '../../constants/tokens';

interface PillProps {
  label: string;
  onPress?: () => void;
  variant?: 'green' | 'white';
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function Pill({ label, onPress, variant = 'white', style, accessibilityLabel }: PillProps) {
  const bg = variant === 'green' ? colors.green : colors.card;
  const textColor = variant === 'green' ? 'onGreen' as const : 'green' as const;
  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      style={[
        {
          backgroundColor: bg,
          borderRadius: radius.xl,
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[2],
          minHeight: 44,
          justifyContent: 'center',
          alignItems: 'center',
          ...shadow.pill,
        },
        style,
      ]}
    >
      <AppText weight="bold" size="sm" color={textColor}>{label}</AppText>
    </TouchableOpacity>
  );
}
