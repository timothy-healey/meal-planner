import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../constants/tokens';

interface ProgressBarProps {
  progress: number; // 0–1
}

export function ProgressBar({ progress }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <View style={styles.track}>
      {clamped > 0 && (
        <View style={[styles.fill, { width: `${clamped * 100}%` }]} />
      )}
      <View style={styles.remainder} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.onGreen,
  },
  remainder: {
    flex: 1,
    height: '100%',
    backgroundColor: colors.orange,
  },
});
