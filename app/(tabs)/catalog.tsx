import { useMemo, useState } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GreenHeader } from '../../components/ui/GreenHeader';
import { AppText } from '../../components/ui/AppText';
import { CatalogRow } from '../../components/CatalogRow';
import { useCatalog } from '../../hooks/useCatalog';
import { colors, font, radius, spacing } from '../../constants/tokens';

type ActiveChip = 'missing_nutrition' | 'unused' | 'duplicate' | null;

export default function CatalogScreen() {
  const insets = useSafeAreaInsets();
  const { rows, counts, loading } = useCatalog();
  const [query, setQuery] = useState('');
  const [activeChip, setActiveChip] = useState<ActiveChip>(null);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      if (activeChip && r.issue !== activeChip) return false;
      if (!q) return true;
      const p = r.product;
      return (
        p.brand.toLowerCase().includes(q) ||
        p.product_name.toLowerCase().includes(q) ||
        p.item_name.toLowerCase().includes(q)
      );
    });
  }, [rows, query, activeChip]);

  const liveCounts = useMemo(() => {
    if (!query.trim()) return counts;
    const q = query.trim().toLowerCase();
    const matching = rows.filter(r => {
      const p = r.product;
      return (
        p.brand.toLowerCase().includes(q) ||
        p.product_name.toLowerCase().includes(q) ||
        p.item_name.toLowerCase().includes(q)
      );
    });
    return {
      missingNutrition: matching.filter(r => r.issue === 'missing_nutrition').length,
      unused: matching.filter(r => r.issue === 'unused').length,
      duplicates: matching.filter(r => r.issue === 'duplicate').length,
      total: matching.length,
    };
  }, [rows, query, counts]);

  const onPress = (productId: string) => {
    router.push(`/catalog/${productId}`);
  };

  return (
    <View style={styles.outer}>
      <GreenHeader>
        <AppText weight="extrabold" size="3xl" color="onGreen">Catalog · {counts.total}</AppText>
      </GreenHeader>

      <ScrollView
        style={[styles.scroll, { paddingTop: spacing[3] }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[6] }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.textTertiary} style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search products"
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Search products"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {(liveCounts.missingNutrition + liveCounts.unused + liveCounts.duplicates === 0) ? (
          rows.length > 0 && (
            <AppText weight="medium" size="sm" color="textTertiary" style={styles.cleanMsg}>
              Catalog clean — no issues to address.
            </AppText>
          )
        ) : (
          <View style={styles.chipRow}>
            <ChipPill
              label="Missing nutrition"
              count={liveCounts.missingNutrition}
              active={activeChip === 'missing_nutrition'}
              onPress={() => setActiveChip(activeChip === 'missing_nutrition' ? null : 'missing_nutrition')}
            />
            <ChipPill
              label="Unused"
              count={liveCounts.unused}
              active={activeChip === 'unused'}
              onPress={() => setActiveChip(activeChip === 'unused' ? null : 'unused')}
            />
            <ChipPill
              label="Possible duplicates"
              count={liveCounts.duplicates}
              active={activeChip === 'duplicate'}
              onPress={() => setActiveChip(activeChip === 'duplicate' ? null : 'duplicate')}
            />
          </View>
        )}

        {rows.length > 0 && (
          <AppText weight="bold" size="xs" color="terracotta" style={styles.sectionLabel}>
            {activeChip ? sectionLabelForChip(activeChip) : 'ALL PRODUCTS'} · {filteredRows.length}
          </AppText>
        )}

        {rows.length === 0 && !loading && (
          <View style={styles.emptyContainer}>
            <AppText weight="bold" size="lg" color="textPrimary">No products yet.</AppText>
            <AppText weight="medium" size="sm" color="textTertiary" style={styles.emptySubtitle}>
              Tag an ingredient or log a shop purchase to start your catalog.
            </AppText>
          </View>
        )}

        {filteredRows.map(row => (
          <CatalogRow key={row.product.id} row={row} onPress={onPress} />
        ))}
      </ScrollView>
    </View>
  );
}

function ChipPill({ label, count, active, onPress }: {
  label: string; count: number; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      activeOpacity={0.85}
    >
      <AppText weight="bold" size="xs" color={active ? 'cream' : 'terracotta'}>
        {label}
      </AppText>
      <View style={[styles.chipCount, active && styles.chipCountActive]}>
        <AppText weight="extrabold" size="2xs" color={active ? 'terracotta' : 'cream'}>
          {count}
        </AppText>
      </View>
    </TouchableOpacity>
  );
}

function sectionLabelForChip(chip: ActiveChip): string {
  switch (chip) {
    case 'missing_nutrition': return 'MISSING NUTRITION';
    case 'unused': return 'UNUSED';
    case 'duplicate': return 'POSSIBLE DUPLICATES';
    default: return 'ALL PRODUCTS';
  }
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: colors.cream },
  scroll: { flex: 1, paddingHorizontal: spacing[3] },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radius.full,
    paddingHorizontal: spacing[3], minHeight: 40,
    marginBottom: spacing[3],
  },
  searchInput: {
    flex: 1, fontFamily: font.family.semibold, fontSize: font.size.md,
    color: colors.textPrimary, padding: 0,
  },
  cleanMsg: { textAlign: 'center', paddingVertical: spacing[3] },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[3] },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.chipSurface, borderRadius: radius.full,
    paddingVertical: 6, paddingHorizontal: spacing[3],
    minHeight: 32,
  },
  chipActive: { backgroundColor: colors.terracotta },
  chipCount: {
    backgroundColor: colors.terracotta, borderRadius: radius.full,
    paddingHorizontal: 6, paddingVertical: 1,
    minWidth: 18, alignItems: 'center', justifyContent: 'center',
  },
  chipCountActive: { backgroundColor: colors.cream },
  sectionLabel: { letterSpacing: font.tracking.category, marginBottom: spacing[2] },
  emptyContainer: { alignItems: 'center', paddingVertical: spacing[10] },
  emptySubtitle: { textAlign: 'center', marginTop: spacing[2], paddingHorizontal: spacing[6] },
});
