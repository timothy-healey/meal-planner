import React from 'react';
import { TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AppText } from './AppText';
import { colors, radius, shadow, spacing } from '../../constants/tokens';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface PillProps {
  label: string;
  onPress?: () => void;
  variant?: 'green' | 'white';
  icon?: IoniconName;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function Pill({ label, onPress, variant = 'white', icon, style, accessibilityLabel }: PillProps) {
  const bg = variant === 'green' ? colors.green : colors.card;
  const textColor = variant === 'green' ? 'onGreen' as const : 'green' as const;
  const iconColor = variant === 'green' ? colors.onGreen : colors.green;
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] + 2 }}>
        {icon && <Ionicons name={icon} size={16} color={iconColor} />}
        <AppText weight="bold" size="sm" color={textColor}>{label}</AppText>
      </View>
    </TouchableOpacity>
  );
}
