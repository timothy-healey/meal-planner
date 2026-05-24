import React, { useState } from 'react';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { SwipeableShoppingItem } from './SwipeableShoppingItem';
import { AppText } from './ui/AppText';
import { colors, spacing } from '../constants/tokens';
import type { ShoppingItemRow } from '../types/db';

interface Props {
  items: ShoppingItemRow[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (item: ShoppingItemRow) => void;
}

export function BasketSection({ items, onToggle, onDelete, onEdit }: Props) {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleToggleExpand = () => setIsExpanded((prev) => !prev);

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

      {isExpanded && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
          <AppText weight="regular" color="textNote" size="2xs" style={styles.hint}>
            Tap any item to put it back
          </AppText>
          {items.map((item) => (
            <SwipeableShoppingItem
              key={item.id}
              item={item}
              onToggle={() => onToggle(item.id)}
              onDelete={() => onDelete(item.id)}
              onEdit={() => onEdit(item)}
            />
          ))}
        </Animated.View>
      )}
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
    minHeight: 44,
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
