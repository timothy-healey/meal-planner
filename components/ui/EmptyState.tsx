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
        The pantry's empty. Drop in a meal plan to see your week.
      </AppText>
      <Pill label="Import meal plan" icon="folder-open-outline" onPress={onImport} />
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
