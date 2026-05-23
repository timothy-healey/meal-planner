import React from 'react';
import { View, ViewProps } from 'react-native';
import { spacing } from '../../constants/tokens';

interface RowProps extends ViewProps {
  gap?: keyof typeof spacing;
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between';
  children: React.ReactNode;
}

export function Row({ gap, align = 'center', justify = 'flex-start', style, children, ...props }: RowProps) {
  return (
    <View
      style={[{ flexDirection: 'row', alignItems: align, justifyContent: justify, gap: gap ? spacing[gap] : 0 }, style]}
      {...props}
    >
      {children}
    </View>
  );
}
