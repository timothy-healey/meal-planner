import { View } from 'react-native';
import { colors } from '../../constants/tokens';
import { EmptyState } from '../../components/ui/EmptyState';

export default function PlanScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <EmptyState onImport={() => {}} />
    </View>
  );
}
