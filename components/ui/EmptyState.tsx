import React from 'react';
import { View } from 'react-native';
import { AppText } from './AppText';
import { Pill } from './Pill';
import { spacing } from '../../constants/tokens';

interface EmptyStateProps {
  onImport: () => void;
}

export function EmptyState({ onImport }: EmptyStateProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4] }}>
      <AppText color="textSecondary">
        No meal plan loaded yet.
      </AppText>
      <Pill label="📂 Import meal plan" onPress={onImport} />
    </View>
  );
}
