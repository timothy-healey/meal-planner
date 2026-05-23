import React from 'react';
import { View, ViewStyle } from 'react-native';
import { AppText } from './AppText';
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
        <AppText weight="bold" size="2xs" color="onGreen">✓</AppText>
      )}
    </View>
  );
}
