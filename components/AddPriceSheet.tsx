import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Switch,
  StyleSheet, Modal, ScrollView, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
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

  // Default to first store when sheet opens
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
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Log a price</Text>

          {/* Store selection */}
          <Text style={styles.fieldLabel}>STORE</Text>
          <View style={styles.storeList}>
            {stores.map(store => (
              <TouchableOpacity
                key={store.id}
                style={styles.storeRow}
                onPress={() => { setSelectedChain(store.chain); setAddingNewStore(false); }}
              >
                <View style={[styles.radio, selectedChain === store.chain && !addingNewStore && styles.radioSelected]}>
                  {selectedChain === store.chain && !addingNewStore && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.storeName}>{store.chain}</Text>
              </TouchableOpacity>
            ))}
            {addingNewStore ? (
              <TextInput
                style={[styles.fieldInput, { marginTop: spacing[1] }]}
                placeholder="New store name"
                placeholderTextColor={colors.textTertiary}
                value={newStoreName}
                onChangeText={setNewStoreName}
                autoFocus
              />
            ) : (
              <TouchableOpacity
                style={styles.addStoreRow}
                onPress={() => { setAddingNewStore(true); setSelectedChain(''); }}
              >
                <View style={styles.addStoreIcon}>
                  <Text style={styles.addStoreIconText}>+</Text>
                </View>
                <Text style={styles.addStoreLabel}>Add new store…</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Price + Qty */}
          <View style={styles.inlineRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>PRICE</Text>
              <TextInput
                style={styles.fieldInput}
                value={price}
                onChangeText={setPrice}
                placeholder="$0.00"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>QTY</Text>
              <View style={styles.qtyRow}>
                <TextInput
                  style={[styles.fieldInput, { flex: 1 }]}
                  value={qtyAmount}
                  onChangeText={setQtyAmount}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity
                  style={styles.unitBtn}
                  onPress={() => {
                    const units: QtyUnit[] = ['g', 'kg', 'mL', 'L', 'units'];
                    const next = units[(units.indexOf(qtyUnit) + 1) % units.length];
                    setQtyUnit(next);
                  }}
                >
                  <Text style={styles.unitBtnText}>{qtyUnit}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Date */}
          <Text style={styles.fieldLabel}>DATE</Text>
          <TouchableOpacity
            style={styles.fieldInput}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={{ fontFamily: font.family.semibold, fontSize: font.size.md, color: colors.textPrimary }}>
              {formatDate(date)}
            </Text>
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
            <Text style={styles.toggleLabel}>Sale price</Text>
            <Switch
              value={isOnSale}
              onValueChange={setIsOnSale}
              trackColor={{ false: colors.divider, true: colors.orange }}
              thumbColor="#fff"
            />
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave || saving}
          >
            <Text style={styles.saveBtnText}>Save price</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
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
    borderRadius: 9999,
    backgroundColor: colors.divider,
    alignSelf: 'center',
    marginVertical: spacing[3],
  },
  title: {
    fontFamily: font.family.bold,
    fontSize: font.size.xl,
    color: colors.textPrimary,
    marginBottom: spacing[4],
  },
  fieldLabel: {
    fontFamily: font.family.bold,
    fontSize: font.size.sm,
    color: colors.textTertiary,
    letterSpacing: font.tracking.label,
    marginBottom: spacing[1],
  },
  fieldInput: {
    backgroundColor: colors.cream,
    borderRadius: radius.sm + 3,
    padding: spacing[2] + 2,
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
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  radio: {
    width: 16, height: 16, borderRadius: 9999,
    borderWidth: 2, borderColor: colors.divider,
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.green, backgroundColor: colors.green },
  radioDot: { width: 6, height: 6, borderRadius: 9999, backgroundColor: '#fff' },
  storeName: { fontFamily: font.family.semibold, fontSize: font.size.md, color: colors.textPrimary },
  addStoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 2,
    paddingVertical: spacing[2],
  },
  addStoreIcon: {
    width: 16, height: 16, borderRadius: 9999,
    borderWidth: 2, borderColor: colors.textTertiary,
    alignItems: 'center', justifyContent: 'center',
  },
  addStoreIconText: { fontSize: 11, color: colors.textTertiary, lineHeight: 13 },
  addStoreLabel: { fontFamily: font.family.semibold, fontSize: font.size.md, color: colors.textTertiary },
  inlineRow: { flexDirection: 'row', gap: spacing[2] },
  qtyRow: { flexDirection: 'row', gap: spacing[1] },
  unitBtn: {
    backgroundColor: colors.cream,
    borderRadius: radius.sm + 3,
    paddingHorizontal: spacing[2] + 2,
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  unitBtnText: { fontFamily: font.family.bold, fontSize: font.size.md, color: colors.green },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  toggleLabel: { fontFamily: font.family.semibold, fontSize: font.size.md, color: colors.textSecondary },
  saveBtn: {
    backgroundColor: colors.green,
    borderRadius: 9999,
    paddingVertical: spacing[2] + 2,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontFamily: font.family.bold, fontSize: font.size.md, color: colors.onGreen },
});
