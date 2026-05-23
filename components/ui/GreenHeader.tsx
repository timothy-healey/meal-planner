import React from 'react';
import { View, ViewStyle, SafeAreaView } from 'react-native';
import { colors, spacing } from '../../constants/tokens';

interface GreenHeaderProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function GreenHeader({ children, style }: GreenHeaderProps) {
  return (
    <View style={{ backgroundColor: colors.green }}>
      <SafeAreaView>
        <View style={[{ paddingHorizontal: spacing[4], paddingBottom: spacing[3] }, style]}>
          {children}
        </View>
      </SafeAreaView>
    </View>
  );
}
