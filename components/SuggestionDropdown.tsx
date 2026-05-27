import { StyleSheet, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, spacing } from '../constants/tokens';
import { AppText } from './ui/AppText';
import { formatRelativeTime } from '../lib/format';
import type { Suggestion } from '../lib/suggestions/types';

interface Props {
  suggestions: Suggestion[];
  showBrandInSecondary: boolean;
  now?: number;
  onPick: (s: Suggestion) => void;
  onLayoutHeight: (h: number) => void;
}

export function SuggestionDropdown({
  suggestions, showBrandInSecondary, now, onPick, onLayoutHeight,
}: Props) {
  if (suggestions.length === 0) return null;
  const ts = now ?? Date.now();

  function handleLayout(e: LayoutChangeEvent) {
    onLayoutHeight(e.nativeEvent.layout.height);
  }

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {suggestions.map((s, i) => {
        const isLast = i === suggestions.length - 1;
        return (
          <TouchableOpacity
            key={`${s.kind}:${s.brand}:${s.productName ?? ''}`}
            style={[styles.row, isLast && styles.rowLast]}
            activeOpacity={0.7}
            onPress={() => onPick(s)}
          >
            <View style={styles.textCol}>
              <AppText weight="bold" size="md" color="textPrimary" numberOfLines={1}>
                {s.kind === 'brand' ? s.brand : s.productName ?? ''}
              </AppText>
              <Secondary s={s} showBrand={showBrandInSecondary} now={ts} />
            </View>
            <View style={styles.emblemSlot}>
              {s.kind === 'product' && s.foodNutritionId && (
                <Ionicons
                  testID="suggestion-emblem"
                  name="pie-chart"
                  size={16}
                  color={colors.green}
                />
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Secondary({ s, showBrand, now }: { s: Suggestion; showBrand: boolean; now: number }) {
  const relative = formatRelativeTime(s.lastUsedAt, now);
  if (s.kind === 'brand') {
    const productPart = s.latestProductName ? `${s.latestProductName} ` : '';
    return (
      <AppText
        weight="medium" size="sm" color="textTertiary" numberOfLines={1}
        style={{ marginTop: 2 }}
      >
        {`${s.productCount ?? 0} products · ${productPart}${relative}`}
      </AppText>
    );
  }
  if (showBrand) {
    return (
      <AppText
        weight="medium" size="sm" color="textTertiary" numberOfLines={1}
        style={{ marginTop: 2 }}
      >
        <AppText weight="bold" size="sm" color="green">{s.brand}</AppText>
        {` · ${relative}`}
      </AppText>
    );
  }
  return (
    <AppText
      weight="medium" size="sm" color="textTertiary" numberOfLines={1}
      style={{ marginTop: 2 }}
    >
      {relative}
    </AppText>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 6,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[3] + 2,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowLast: { borderBottomWidth: 0 },
  textCol: { flex: 1, minWidth: 0 },
  emblemSlot: { width: 16, alignItems: 'center', justifyContent: 'center' },
});
