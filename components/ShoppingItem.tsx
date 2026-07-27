import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AppText } from './ui/AppText';
import { Checkbox } from './ui/Checkbox';
import { Divider } from './ui/Divider';
import { colors, spacing } from '../constants/tokens';
import { formatPrice } from '../lib/format';
import type { ShoppingItemRow } from '../types/db';

interface Props {
  item: ShoppingItemRow;
  onToggle: () => void;
  showDivider?: boolean;
}

export function ShoppingItem({ item, onToggle, showDivider = true }: Props) {
  return (
    <>
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggle();
        }}
        activeOpacity={0.7}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.is_checked === 1 }}
        accessibilityLabel={item.name}
        accessibilityHint={item.is_checked === 1 ? 'Double-tap to uncheck' : 'Double-tap to check off'}
        style={styles.row}
      >
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden={true}>
          <Checkbox checked={item.is_checked === 1} />
        </View>
        <View style={styles.content}>
          <AppText
            weight="bold"
            color={item.is_checked === 1 ? 'textTertiary' : 'textPrimary'}
            size="lg"
            style={item.is_checked === 1 ? { textDecorationLine: 'line-through' } : undefined}
          >
            {item.name}
          </AppText>
          <View style={styles.detail}>
            <AppText weight="regular" color="textSecondary" size="sm">
              {item.estimated_price > 0 ? `${item.qty} ·` : item.qty}
            </AppText>
            {item.estimated_price > 0 && (
              <AppText weight="semibold" color="orange" size="sm">
                {formatPrice(item.estimated_price)}
              </AppText>
            )}
          </View>
          {/* The item_key guard is required, not decorative: manual rows have
              planned_qty null and a non-null qty, so comparing the two alone
              would flag every hand-added item as stale. */}
          {item.item_key !== null && item.planned_qty !== null
            && item.qty !== item.planned_qty ? (
            <AppText
              weight="regular"
              color="textNote"
              size="2xs"
              accessibilityLabel={`recipe now calls for ${item.planned_qty}`}
            >
              {`recipe now calls for ${item.planned_qty}`}
            </AppText>
          ) : null}
          {item.note ? (
            <AppText weight="regular" color="textNote" size="2xs">{item.note}</AppText>
          ) : null}
        </View>
      </TouchableOpacity>
      {showDivider && <Divider />}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[4],
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
