import React, { useState } from 'react';
import {
  View, Modal, TouchableOpacity, TextInput,
  ScrollView, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './ui/AppText';
import { colors, spacing, radius } from '../constants/tokens';
import type { SavedStore } from '../hooks/useShoppingMode';

interface Props {
  visible: boolean;
  stores: SavedStore[];
  onConfirm: (storeName: string) => void;
  onClose: () => void;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatLastUsed(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function StorePickerSheet({ visible, stores, onConfirm, onClose }: Props) {
  const [selected, setSelected] = useState<string | null>(stores[0]?.name ?? null);
  const [newStore, setNewStore] = useState('');
  const [adding, setAdding] = useState(false);

  function handleConfirm() {
    const name = adding ? newStore.trim() : selected;
    if (!name) return;
    onConfirm(name);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <AppText weight="extrabold" size="lg" color="textPrimary" style={styles.heading}>
            Where are you shopping?
          </AppText>
          <AppText weight="regular" size="sm" color="textNote" style={styles.sub}>
            Saved with your purchases for this trip
          </AppText>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {stores.map((s) => (
              <TouchableOpacity
                key={s.name}
                style={[styles.storeRow, selected === s.name && !adding && styles.storeRowSelected]}
                onPress={() => { setSelected(s.name); setAdding(false); }}
                activeOpacity={0.7}
              >
                <View style={styles.storeRowContent}>
                  <AppText weight="bold" size="md" color="textPrimary">{s.name}</AppText>
                  <AppText weight="regular" size="sm" color="textTertiary">
                    Last used {formatLastUsed(s.lastUsed)}
                  </AppText>
                </View>
                {selected === s.name && !adding && (
                  <Ionicons name="checkmark" size={16} color={colors.green} />
                )}
              </TouchableOpacity>
            ))}

            {adding ? (
              <View style={styles.newStoreInput}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Coles Bondi"
                  placeholderTextColor={colors.textTertiary}
                  value={newStore}
                  onChangeText={setNewStore}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleConfirm}
                />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addRow}
                onPress={() => { setAdding(true); setSelected(null); }}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={16} color={colors.textTertiary} />
                <AppText weight="semibold" size="sm" color="textSecondary">
                  Add new store…
                </AppText>
              </TouchableOpacity>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.confirmBtn, !(selected || (adding && newStore.trim())) && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            activeOpacity={0.85}
          >
            <AppText weight="extrabold" size="md" color="onGreen">Start reviewing</AppText>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing[4],
    paddingBottom: spacing[8],
    maxHeight: '80%',
  },
  handle: {
    width: 32, height: 4, borderRadius: radius.full,
    backgroundColor: colors.divider, alignSelf: 'center', marginBottom: spacing[3],
  },
  heading: { marginBottom: spacing[1] },
  sub: { marginBottom: spacing[4] },
  list: { marginBottom: spacing[3] },
  storeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing[3], borderRadius: radius.md,
    backgroundColor: colors.cream, borderWidth: 1.5,
    borderColor: colors.divider, marginBottom: spacing[2],
  },
  storeRowSelected: { borderColor: colors.green, backgroundColor: 'rgba(28,69,60,0.04)' },
  storeRowContent: { flex: 1, gap: spacing[1] },
  newStoreInput: {
    backgroundColor: colors.cream, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.green,
    paddingHorizontal: spacing[3], marginBottom: spacing[2],
  },
  input: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13, color: colors.textPrimary,
    paddingVertical: spacing[3],
  },
  addRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    padding: spacing[3], borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.divider,
    borderStyle: 'dashed', marginBottom: spacing[2],
  },
  confirmBtn: {
    backgroundColor: colors.orange, borderRadius: radius.full,
    paddingVertical: spacing[3], alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.45 },
});
