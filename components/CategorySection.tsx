import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ShoppingItem } from './ShoppingItem';
import { CategoryHeader } from './ui/CategoryHeader';
import { spacing } from '../constants/tokens';
import type { ShoppingItemRow } from '../types/db';

interface Props {
  category: string;
  items: ShoppingItemRow[];
  isOneoff: boolean;
  onToggle: (id: string) => void;
}

export function CategorySection({ category, items, isOneoff, onToggle }: Props) {
  return (
    <View style={styles.container}>
      <CategoryHeader label={category} isOneoff={isOneoff} />
      {items.map((item) => (
        <ShoppingItem key={item.id} item={item} onToggle={() => onToggle(item.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[2],
  },
});
