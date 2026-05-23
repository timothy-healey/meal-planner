import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { AppText } from './ui/AppText';
import { Checkbox } from './ui/Checkbox';
import { Divider } from './ui/Divider';
import { colors, spacing } from '../constants/tokens';
import { formatPrice } from '../lib/format';
import type { ShoppingItemRow } from '../types/db';

interface Props {
  item: ShoppingItemRow;
  onToggle: () => void;
}

export function ShoppingItem({ item, onToggle }: Props) {
  return (
    <>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.7}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.is_checked === 1 }}
        accessibilityLabel={item.name}
        style={styles.row}
      >
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden={true}>
          <Checkbox checked={false} />
        </View>
        <View style={styles.content}>
          <AppText weight="bold" color="textPrimary" size="md">{item.name}</AppText>
          <View style={styles.detail}>
            <AppText weight="semibold" color="terracotta" size="sm">{item.qty} ·</AppText>
            <AppText weight="semibold" color="orange" size="sm">{formatPrice(item.estimated_price)}</AppText>
          </View>
          {item.note ? (
            <AppText weight="regular" color="textNote" size="2xs">{item.note}</AppText>
          ) : null}
        </View>
      </TouchableOpacity>
      <Divider />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    gap: spacing[3],
    backgroundColor: colors.card,
  },
  content: {
    flex: 1,
    gap: spacing[1],
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
});
