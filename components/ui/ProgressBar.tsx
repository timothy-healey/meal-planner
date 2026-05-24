import React from 'react';
import { View } from 'react-native';
import { colors } from '../../constants/tokens';

interface ProgressBarProps {
  progress: number; // 0–1
}

export function ProgressBar({ progress }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, progress));
  const tickedPct = `${clamped * 100}%`;
  return (
    <View style={{ height: 4, borderRadius: 2, overflow: 'hidden', flexDirection: 'row' }}>
      {clamped > 0 && (
        <View style={{ width: tickedPct, height: '100%', backgroundColor: colors.onGreen }} />
      )}
      <View style={{ flex: 1, height: '100%', backgroundColor: colors.orange }} />
    </View>
  );
}
