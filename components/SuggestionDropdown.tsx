import { StyleSheet, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, spacing } from '../constants/tokens';
import { AppText } from './ui/AppText';
import { formatRelativeTime } from '../lib/format';
import type { Suggestion } from '../lib/suggestions/types';

interface Props {
  suggestions: Suggestion[];
  showBrandInSecondary: boolean;
  hideEmblem?: boolean;
  now?: number;
  onPick: (s: Suggestion) => void;
  onLayoutHeight: (h: number) => void;
}

export function SuggestionDropdown({
  suggestions, showBrandInSecondary, hideEmblem = false, now, onPick, onLayoutHeight,
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
              <HighlightedText
                text={s.kind === 'brand' ? s.brand : s.productName ?? ''}
                indices={
                  s.matches.find(m => m.field === (s.kind === 'brand' ? 'brand' : 'product'))?.indices ?? []
                }
              />
              <Secondary s={s} showBrand={showBrandInSecondary} now={ts} />
            </View>
            {!hideEmblem && (
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
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function HighlightedText({ text, indices }: { text: string; indices: [number, number][] }) {
  if (indices.length === 0) {
    return (
      <AppText weight="bold" size="md" color="textPrimary" numberOfLines={1}>
        {text}
      </AppText>
    );
  }
  const segments: { text: string; highlight: boolean }[] = [];
  let cursor = 0;
  const sorted = [...indices].sort((a, b) => a[0] - b[0]);
  for (const [start, end] of sorted) {
    if (start > cursor) segments.push({ text: text.slice(cursor, start), highlight: false });
    segments.push({ text: text.slice(start, end + 1), highlight: true });
    cursor = end + 1;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), highlight: false });

  return (
    <AppText weight="bold" size="md" color="textPrimary" numberOfLines={1}>
      {segments.map((seg, i) =>
        seg.highlight ? (
          <AppText
            key={i}
            weight="extrabold"
            size="md"
            color="orange"
            style={styles.highlight}
          >
            {seg.text}
          </AppText>
        ) : (
          seg.text
        ),
      )}
    </AppText>
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
  highlight: { backgroundColor: 'rgba(232, 123, 58, 0.18)' },
});
