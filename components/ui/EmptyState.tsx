import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { Pill } from './Pill';
import { spacing } from '../../constants/tokens';

interface EmptyStateProps {
  onImport: () => void;
}

export function EmptyState({ onImport }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <AppText color="textSecondary">
        No meal plan loaded yet.
      </AppText>
      <Pill label="📂 Import meal plan" onPress={onImport} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[4],
  },
});
