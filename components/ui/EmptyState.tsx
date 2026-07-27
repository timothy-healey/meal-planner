import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { Pill } from './Pill';
import { spacing } from '../../constants/tokens';

interface EmptyStateProps {
  onImport: () => void;
  /** Omitted where building in-app isn't offered. */
  onBuild?: () => void;
}

export function EmptyState({ onImport, onBuild }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <AppText color="textSecondary">
        The pantry's empty. Drop in a meal plan, or build one from recipes you
        already have.
      </AppText>
      <Pill label="Import meal plan" icon="folder-open-outline" onPress={onImport} />
      {onBuild && (
        <Pill label="Build a plan" icon="restaurant-outline" onPress={onBuild} />
      )}
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
