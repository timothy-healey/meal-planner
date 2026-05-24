import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SwipeableShoppingItem } from './SwipeableShoppingItem';
import { CategoryHeader } from './ui/CategoryHeader';
import { spacing } from '../constants/tokens';
import type { ShoppingItemRow } from '../types/db';

interface Props {
  category: string;
  items: ShoppingItemRow[];
  isOneoff: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (item: ShoppingItemRow) => void;
}

export function CategorySection({ category, items, isOneoff, onToggle, onDelete, onEdit }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.headerPad}>
        <CategoryHeader label={category} isOneoff={isOneoff} />
      </View>
      {items.map((item) => (
        <SwipeableShoppingItem
          key={item.id}
          item={item}
          onToggle={() => onToggle(item.id)}
          onDelete={() => onDelete(item.id)}
          onEdit={() => onEdit(item)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[2],
  },
  headerPad: {
    paddingHorizontal: spacing[4],
  },
});
