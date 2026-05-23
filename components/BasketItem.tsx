import React from 'react';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { AppText } from './ui/AppText';
import { Checkbox } from './ui/Checkbox';
import { Divider } from './ui/Divider';
import { colors, spacing } from '../constants/tokens';
import type { ShoppingItemRow } from '../types/db';

interface Props {
  item: ShoppingItemRow;
  onToggle: () => void;
}

export function BasketItem({ item, onToggle }: Props) {
  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: true }}
        accessibilityHint="Double-tap to uncheck and return to list"
        style={styles.row}
      >
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden={true}>
          <Checkbox checked={true} />
        </View>
        <View style={styles.content}>
          <AppText
            weight="bold"
            color="textSecondary"
            size="md"
            style={styles.strikethrough}
          >
            {item.name}
          </AppText>
          <AppText weight="regular" color="textNote" size="2xs">{item.category}</AppText>
        </View>
      </TouchableOpacity>
      <Divider />
    </Animated.View>
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
    opacity: 0.4,
  },
  content: {
    flex: 1,
    gap: spacing[1],
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
});
