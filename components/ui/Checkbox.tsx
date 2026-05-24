import React from 'react';
import { View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../../constants/tokens';

interface CheckboxProps {
  checked: boolean;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}

export function Checkbox({ checked, style, testID, accessibilityLabel }: CheckboxProps) {
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          width: 20,
          height: 20,
          borderRadius: radius.xs,
          borderWidth: 1.5,
          borderColor: checked ? colors.green : colors.checkboxBorder,
          backgroundColor: checked ? colors.green : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {checked && (
        <Ionicons name="checkmark" size={13} color={colors.onGreen} />
      )}
    </View>
  );
}
