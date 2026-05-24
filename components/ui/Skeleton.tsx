import React, { useEffect } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import { colors } from '../../constants/tokens';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  variant?: 'light' | 'dark';
}

export function Skeleton({ width, height = 16, borderRadius = 4, style, variant = 'light' }: SkeletonProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [progress]);

  const fromColor = variant === 'dark' ? 'rgba(255,255,255,0.10)' : colors.divider;
  const toColor = variant === 'dark' ? 'rgba(255,255,255,0.25)' : colors.cream;

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [fromColor, toColor],
    ),
  }));

  return (
    <Animated.View
      style={[
        styles.base,
        { width: width ?? '100%', height, borderRadius },
        animatedStyle,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
