import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './ui/AppText';
import { colors, spacing, radius } from '../constants/tokens';
import { formatPrice, formatRelativeTime } from '../lib/format';
import type { CatalogRow as CatalogRowData } from '../hooks/useCatalog';

interface Props {
  row: CatalogRowData;
  onPress: (productId: string) => void;
  now?: number;
}

export function CatalogRow({ row, onPress, now }: Props) {
  const ts = now ?? Date.now();
  const isProblem = row.issue !== null;
  const isGeneric = row.product.brand === '';
  const titleText = isGeneric
    ? row.product.product_name
    : `${row.product.brand} ${row.product.product_name}`;
  const accessibilityLabel = titleText;

  return (
    <TouchableOpacity
      style={[styles.row, isProblem && styles.rowDim]}
      onPress={() => onPress(row.product.id)}
      accessibilityLabel={accessibilityLabel}
      activeOpacity={0.7}
    >
      <View style={styles.main}>
        <View style={styles.titleRow}>
          <AppText weight="bold" size="md" color="textPrimary" numberOfLines={1} style={styles.titleText}>
            {titleText}
          </AppText>
          {isGeneric && (
            <AppText weight="semibold" size="2xs" color="textTertiary" style={styles.genericTag}>
              · generic
            </AppText>
          )}
        </View>
        {row.issue === 'duplicate' && row.duplicate_of && (
          <View style={styles.issueLine}>
            <Ionicons name="alert-circle-outline" size={12} color={colors.terracotta} style={styles.issueIcon} />
            <AppText weight="semibold" size="sm" color="terracotta">
              Looks like a duplicate of <AppText weight="bold" size="sm" color="terracotta">{row.duplicate_of.product_name}</AppText>
            </AppText>
          </View>
        )}
        {row.issue === 'missing_nutrition' && (
          <View style={styles.issueLine}>
            <Ionicons name="alert-circle-outline" size={12} color={colors.terracotta} style={styles.issueIcon} />
            <AppText weight="semibold" size="sm" color="terracotta">No nutrition on file</AppText>
          </View>
        )}
        {row.issue === 'unused' && (
          <View style={styles.issueLine}>
            <Ionicons name="alert-circle-outline" size={12} color={colors.terracotta} style={styles.issueIcon} />
            <AppText weight="semibold" size="sm" color="terracotta">Unused — never purchased or referenced</AppText>
          </View>
        )}
        {!row.issue && row.latest && (
          <AppText weight="medium" size="sm" color="textTertiary" numberOfLines={1} style={styles.metaLine}>
            {`${row.latest.chain} · ${formatRelativeTime(row.latest.purchased_at, ts)} · ${row.latest.qty}`}
          </AppText>
        )}
        {!row.issue && !row.latest && (
          <AppText weight="medium" size="sm" color="textTertiary" style={styles.metaLine}>
            No purchases yet
          </AppText>
        )}
      </View>
      <View style={styles.tail}>
        {!row.issue && row.latest && (
          <AppText weight="extrabold" size="md" color="orange">{formatPrice(row.latest.price)}</AppText>
        )}
        {row.issue === 'missing_nutrition' && (
          <AppText weight="semibold" size="sm" color="textTertiary">
            {row.recipe_count === 1 ? 'used in 1 recipe' : `used in ${row.recipe_count} recipes`}
          </AppText>
        )}
        {row.issue === 'duplicate' && (
          <AppText weight="semibold" size="sm" color="textTertiary">
            {row.purchase_count === 1 ? '1 purchase' : `${row.purchase_count} purchases`}
          </AppText>
        )}
        {row.issue === 'unused' && (
          <AppText weight="semibold" size="sm" color="textTertiary">—</AppText>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3] + 2,
    marginBottom: spacing[2],
  },
  rowDim: { opacity: 0.7 },
  main: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[1] },
  titleText: { flexShrink: 1 },
  genericTag: { flexShrink: 0 },
  issueLine: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  issueIcon: { marginRight: 4 },
  metaLine: { marginTop: 3 },
  tail: { alignItems: 'flex-end' },
});
