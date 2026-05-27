import React, { useState, useEffect } from 'react';
import {
  View, TextInput, TouchableOpacity, Switch,
  StyleSheet, Modal, ScrollView, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './ui/AppText';
import { colors, font, spacing, radius } from '../constants/tokens';
import { useStores } from '../hooks/useStores';
import { usePurchaseHistory } from '../hooks/usePurchaseHistory';
import type { QtyUnit } from '../types/db';

interface Props {
  visible: boolean;
  brand: string | null;
  productName: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function AddPriceSheet({ visible, brand, productName, onClose, onSaved }: Props) {
  const { stores } = useStores();
  const { addRecord } = usePurchaseHistory(null);

  const [selectedChain, setSelectedChain] = useState('');
  const [newStoreName, setNewStoreName] = useState('');
  const [addingNewStore, setAddingNewStore] = useState(false);
  const [price, setPrice] = useState('');
  const [qtyAmount, setQtyAmount] = useState('1');
  const [qtyUnit, setQtyUnit] = useState<QtyUnit>('kg');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isOnSale, setIsOnSale] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && stores.length > 0 && !selectedChain) {
      setSelectedChain(stores[0].chain);
    }
  }, [visible, stores, selectedChain]);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

  const canSave = !!((selectedChain || (addingNewStore && newStoreName.trim())) && price.trim());

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const chain = addingNewStore ? newStoreName.trim() : selectedChain;
      const parsedPrice = parseFloat(price);
      const parsedQty = parseFloat(qtyAmount);
      await addRecord({
        plan_id: null,
        item_name: productName ?? brand ?? '',
        store: chain,
        brand: brand ?? null,
        product_name: productName ?? null,
        qty_amount: isNaN(parsedQty) ? null : parsedQty,
        qty_unit: qtyUnit,
        price: isNaN(parsedPrice) ? null : parsedPrice,
        is_sale: isOnSale ? 1 : 0,
        barcode: null,
        purchased_at: date.toISOString(),
      });
      setPrice('');
      setIsOnSale(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
        accessibilityLabel="Dismiss"
        accessibilityRole="button"
      />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <AppText weight="bold" size="xl" color="textPrimary" style={styles.title}>
            Log a price
          </AppText>

          {/* Store selection */}
          <AppText weight="bold" size="sm" color="textTertiary" style={styles.fieldLabel}>
            STORE
          </AppText>
          <View style={styles.storeList}>
            {stores.map(store => {
              const isSelected = selectedChain === store.chain && !addingNewStore;
              return (
                <TouchableOpacity
                  key={store.id}
                  style={styles.storeRow}
                  onPress={() => { setSelectedChain(store.chain); setAddingNewStore(false); }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={store.chain}
                >
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                  <AppText weight="semibold" size="md" color="textPrimary">
                    {store.chain}
                  </AppText>
                </TouchableOpacity>
              );
            })}
            {addingNewStore ? (
              <TextInput
                style={[styles.fieldInput, { marginTop: spacing[1] }]}
                placeholder="New store name"
                placeholderTextColor={colors.textTertiary}
                value={newStoreName}
                onChangeText={setNewStoreName}
                autoFocus
                accessibilityLabel="New store name"
              />
            ) : (
              <TouchableOpacity
                style={styles.addStoreRow}
                onPress={() => { setAddingNewStore(true); setSelectedChain(''); }}
                accessibilityRole="button"
                accessibilityLabel="Add new store"
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.textTertiary} />
                <AppText weight="semibold" size="md" color="textTertiary">
                  Add new store…
                </AppText>
              </TouchableOpacity>
            )}
          </View>

          {/* Price + Qty */}
          <View style={styles.inlineRow}>
            <View style={{ flex: 1 }}>
              <AppText weight="bold" size="sm" color="textTertiary" style={styles.fieldLabel}>
                PRICE
              </AppText>
              <TextInput
                style={styles.fieldInput}
                value={price}
                onChangeText={setPrice}
                placeholder="$0.00"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                accessibilityLabel="Price"
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppText weight="bold" size="sm" color="textTertiary" style={styles.fieldLabel}>
                QTY
              </AppText>
              <View style={styles.qtyRow}>
                <TextInput
                  style={[styles.fieldInput, { flex: 1 }]}
                  value={qtyAmount}
                  onChangeText={setQtyAmount}
                  keyboardType="decimal-pad"
                  accessibilityLabel="Quantity amount"
                />
                <TouchableOpacity
                  style={styles.unitBtn}
                  onPress={() => {
                    const units: QtyUnit[] = ['g', 'kg', 'mL', 'L', 'units'];
                    const next = units[(units.indexOf(qtyUnit) + 1) % units.length];
                    setQtyUnit(next);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Unit: ${qtyUnit}, tap to change`}
                >
                  <AppText weight="bold" size="md" color="green">{qtyUnit}</AppText>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Date */}
          <AppText weight="bold" size="sm" color="textTertiary" style={styles.fieldLabel}>
            DATE
          </AppText>
          <TouchableOpacity
            style={styles.fieldInput}
            onPress={() => setShowDatePicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`Date: ${formatDate(date)}, tap to change`}
          >
            <AppText weight="semibold" size="md" color="textPrimary">
              {formatDate(date)}
            </AppText>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              maximumDate={new Date()}
              onChange={(_, selected) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selected) setDate(selected);
              }}
            />
          )}

          {/* Sale toggle */}
          <View style={styles.toggleRow}>
            <AppText weight="semibold" size="md" color="textSecondary">Sale price</AppText>
            <Switch
              value={isOnSale}
              onValueChange={setIsOnSale}
              trackColor={{ false: colors.divider, true: colors.orange }}
              thumbColor={colors.cream}
              accessibilityLabel="Sale price"
            />
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave || saving}
            accessibilityRole="button"
            accessibilityLabel="Save price"
            accessibilityState={{ disabled: !canSave || saving }}
          >
            <AppText weight="bold" size="md" color="onGreen">Save price</AppText>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[8],
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radius.xs,
    backgroundColor: colors.divider,
    alignSelf: 'center',
    marginVertical: spacing[3],
  },
  title: {
    marginBottom: spacing[4],
  },
  fieldLabel: {
    letterSpacing: font.tracking.label,
    marginBottom: spacing[1],
  },
  fieldInput: {
    backgroundColor: colors.cream,
    borderRadius: radius.sm + 3,
    padding: spacing[3],
    minHeight: 44,
    justifyContent: 'center',
    fontFamily: font.family.semibold,
    fontSize: font.size.md,
    color: colors.textPrimary,
    marginBottom: spacing[3],
  },
  storeList: { marginBottom: spacing[3] },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 2,
    paddingVertical: spacing[3],
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  radio: {
    width: 18, height: 18, borderRadius: radius.full,
    borderWidth: 2, borderColor: colors.checkboxBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.green, backgroundColor: colors.green },
  radioDot: { width: 6, height: 6, borderRadius: radius.full, backgroundColor: colors.cream },
  addStoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 2,
    paddingVertical: spacing[3],
    minHeight: 44,
  },
  inlineRow: { flexDirection: 'row', gap: spacing[2] },
  qtyRow: { flexDirection: 'row', gap: spacing[1] },
  unitBtn: {
    backgroundColor: colors.cream,
    borderRadius: radius.sm + 3,
    paddingHorizontal: spacing[3],
    minWidth: 56,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    marginBottom: spacing[3],
  },
  saveBtn: {
    backgroundColor: colors.green,
    borderRadius: radius.full,
    paddingVertical: spacing[3],
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
});
