import { View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing } from '../../constants/tokens';
import { EmptyState } from '../../components/ui/EmptyState';
import { AppText } from '../../components/ui/AppText';
import { Row } from '../../components/ui/Row';

export default function PlanScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <Row justify="flex-end" style={{ padding: spacing[4] }}>
        <TouchableOpacity
          onPress={() => router.push('/settings')}
          accessibilityLabel="Settings"
        >
          <AppText size="xl">⚙</AppText>
        </TouchableOpacity>
      </Row>
      <EmptyState onImport={() => router.push('/settings')} />
    </View>
  );
}
