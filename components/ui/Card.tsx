import React from 'react';
import { View, ViewProps } from 'react-native';
import { colors, radius, shadow } from '../../constants/tokens';

interface CardProps extends ViewProps {
  children: React.ReactNode;
}

export function Card({ style, children, ...props }: CardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.md,
          ...shadow.card,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
