import { View } from 'react-native';
import { AppText } from '../components/ui/AppText';
import { colors, spacing } from '../constants/tokens';

export default function CategoryOrderScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.cream, padding: spacing[4] }}>
      <AppText weight="extrabold" size="xl">Category Order</AppText>
    </View>
  );
}
