import React, { useMemo, useState } from 'react';
import { Alert, Modal, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAvoidingView, KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './ui/AppText';
import { colors, font, radius, spacing } from '../constants/tokens';
import { findDuplicateMatches } from '../lib/catalog/findDuplicates';
import type { ProductRow } from '../types/db';

interface Props {
  visible: boolean;
  source: ProductRow;
  candidates: ProductRow[];
  onClose: () => void;
  onMerge: (targetId: string) => void;
}

function labelFor(p: ProductRow): string {
  return p.brand ? `${p.brand} ${p.product_name}` : p.product_name;
}

export function MergeProductSheet({ visible, source, candidates, onClose, onMerge }: Props) {
  const [query, setQuery] = useState('');

  const targets = useMemo(
    () => candidates.filter(c => c.id !== source.id),
    [candidates, source.id],
  );

  const suggested = useMemo(() => {
    const matches = findDuplicateMatches([source, ...targets]);
    return matches.get(source.id)?.twin ?? null;
  }, [source, targets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return targets;
    return targets.filter(c =>
      c.brand.toLowerCase().includes(q) ||
      c.product_name.toLowerCase().includes(q) ||
      c.item_name.toLowerCase().includes(q),
    );
  }, [targets, query]);

  function confirmAndMerge(target: ProductRow) {
    Alert.alert(
      `Merge "${labelFor(source)}" into "${labelFor(target)}"?`,
      "This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Merge', style: 'destructive', onPress: () => onMerge(target.id) },
      ],
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <KeyboardAwareScrollView keyboardShouldPersistTaps="handled">
            <AppText weight="extrabold" size="xl" color="textPrimary" style={styles.title}>
              Merge into…
            </AppText>
            <AppText weight="medium" size="sm" color="textTertiary" style={styles.subtitle}>
              Pick the product to keep. All references and purchases of <AppText weight="bold" size="sm" color="textPrimary">{labelFor(source)}</AppText> will be re-targeted, then it'll be deleted.
            </AppText>

            {suggested && (
              <View>
                <AppText weight="bold" size="xs" color="terracotta" style={styles.sectionLabel}>
                  SUGGESTED MATCH
                </AppText>
                <TouchableOpacity
                  style={styles.suggested}
                  onPress={() => confirmAndMerge(suggested)}
                  activeOpacity={0.85}
                >
                  <View style={{ flex: 1 }}>
                    <AppText weight="bold" size="md" color="textPrimary">{labelFor(suggested)}</AppText>
                    <AppText weight="medium" size="sm" color="textTertiary">{suggested.item_name}</AppText>
                  </View>
                  <Ionicons name="arrow-forward" size={18} color={colors.green} />
                </TouchableOpacity>
              </View>
            )}

            <AppText weight="bold" size="xs" color="terracotta" style={styles.sectionLabel}>
              ALL PRODUCTS
            </AppText>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color={colors.textTertiary} style={{ marginRight: 6 }} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search products"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
            {filtered.map(target => (
              <TouchableOpacity
                key={target.id}
                style={styles.row}
                onPress={() => confirmAndMerge(target)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <AppText weight="semibold" size="md" color="textPrimary">{labelFor(target)}</AppText>
                  <AppText weight="medium" size="sm" color="textTertiary">{target.item_name}</AppText>
                </View>
              </TouchableOpacity>
            ))}
          </KeyboardAwareScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[8],
    maxHeight: '80%',
  },
  handle: {
    width: 36, height: 4, borderRadius: radius.xs,
    backgroundColor: colors.divider,
    alignSelf: 'center', marginVertical: spacing[3],
  },
  title: { marginBottom: spacing[2] },
  subtitle: { marginBottom: spacing[4], lineHeight: 18 },
  sectionLabel: { letterSpacing: font.tracking.category, marginBottom: spacing[2], marginTop: spacing[2] },
  suggested: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: colors.cream, borderRadius: radius.md,
    padding: spacing[3], marginBottom: spacing[3],
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.cream, borderRadius: radius.full,
    paddingHorizontal: spacing[3], minHeight: 40, marginBottom: spacing[3],
  },
  searchInput: {
    flex: 1, fontFamily: font.family.semibold, fontSize: font.size.md,
    color: colors.textPrimary, padding: 0,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
});
