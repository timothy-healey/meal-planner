import React from 'react';
import { Text, TextProps } from 'react-native';
import { font, colors } from '../../constants/tokens';

type Weight = keyof typeof font.family;
type Size = keyof typeof font.size;
type ColorName = keyof typeof colors;

interface AppTextProps extends TextProps {
  weight?: Weight;
  size?: Size;
  color?: ColorName;
  children: React.ReactNode;
}

export function AppText({
  weight = 'regular',
  size = 'md',
  color = 'textPrimary',
  style,
  children,
  ...props
}: AppTextProps) {
  return (
    <Text
      // Cap Dynamic Type at 2.0× so dense screens (shopping list, recipe rows)
      // don't reflow into unreadable overlap at extreme system text scaling.
      maxFontSizeMultiplier={2.0}
      style={[
        {
          fontFamily: font.family[weight],
          fontSize: font.size[size],
          color: colors[color],
        },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
}
