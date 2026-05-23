import React, { useState } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { BasketItem } from './BasketItem';
import { AppText } from './ui/AppText';
import { colors, spacing } from '../constants/tokens';
import type { ShoppingItemRow } from '../types/db';

interface Props {
  items: ShoppingItemRow[];
  onToggle: (id: string) => void;
}

export function BasketSection({ items, onToggle }: Props) {
  const [isExpanded, setIsExpanded] = useState(true);
  const expandedValue = useSharedValue(1);

  const collapseStyle = useAnimatedStyle(() => ({
    maxHeight: withTiming(expandedValue.value * 4000, { duration: 250 }),
    opacity: withTiming(expandedValue.value, { duration: 200 }),
    overflow: 'hidden',
  }));

  const handleToggleExpand = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    expandedValue.value = next ? 1 : 0;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={handleToggleExpand}
        style={styles.header}
        accessibilityRole="button"
        accessibilityLabel={`In Basket, ${items.length} item${items.length !== 1 ? 's' : ''}, ${isExpanded ? 'tap to collapse' : 'tap to expand'}`}
      >
        <AppText weight="bold" color="green" size="md">✓</AppText>
        <AppText weight="semibold" color="green" size="sm" style={styles.headerLabel}>
          IN BASKET ({items.length})
        </AppText>
      </TouchableOpacity>

      <Animated.View style={collapseStyle}>
        <AppText weight="regular" color="textNote" size="2xs" style={styles.hint}>
          Tap any item to put it back
        </AppText>
        {items.map((item) => (
          <BasketItem key={item.id} item={item} onToggle={() => onToggle(item.id)} />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.cream,
  },
  headerLabel: {
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  hint: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
    paddingTop: spacing[1],
  },
});
