import React, { useState, useEffect } from 'react';
import {
  View, Modal, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './ui/AppText';
import { colors, spacing, radius } from '../constants/tokens';
import { formatPrice } from '../lib/format';
import type { ShoppingItemRow, PurchaseHistoryRow, QtyUnit } from '../types/db';
import type { AddPurchaseData } from '../hooks/usePurchaseHistory';
import type { ScanResult } from '../lib/barcodeScanResult';

const QTY_UNITS: QtyUnit[] = ['g', 'kg', 'mL', 'L', 'units'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

interface Props {
  visible: boolean;
  item: ShoppingItemRow | null;
  store: string;
  latestRecord: PurchaseHistoryRow | null;
  pendingScan: ScanResult | null;
  onSave: (data: AddPurchaseData) => void;
  onClose: () => void;
  onPendingScanConsumed: () => void;
}

export function ReviewItemSheet({
  visible, item, store, latestRecord, pendingScan,
  onSave, onClose, onPendingScanConsumed,
}: Props) {
  const [brand, setBrand] = useState('');
  const [productName, setProductName] = useState('');
  const [qtyAmount, setQtyAmount] = useState('');
  const [qtyUnit, setQtyUnit] = useState<QtyUnit>('g');
  const [price, setPrice] = useState('');
  const [isSale, setIsSale] = useState(false);
  const [barcode, setBarcode] = useState('');

  const baselinePrice = latestRecord && !latestRecord.is_sale ? latestRecord.price : null;

  // Pre-fill from history when sheet opens
  useEffect(() => {
    if (!visible) return;
    if (latestRecord) {
      setBrand(latestRecord.brand ?? '');
      setProductName(latestRecord.product_name ?? '');
      setQtyAmount(latestRecord.qty_amount != null ? String(latestRecord.qty_amount) : '');
      setQtyUnit(latestRecord.qty_unit ?? 'g');
      setPrice(latestRecord.price != null ? String(latestRecord.price) : '');
      setIsSale(false);
      setBarcode(latestRecord.barcode ?? '');
    } else {
      setBrand(''); setProductName(''); setQtyAmount('');
      setQtyUnit('g'); setPrice(''); setIsSale(false); setBarcode('');
    }
  }, [visible, latestRecord]);

  // Apply scan result when returning from scanner
  useEffect(() => {
    if (!pendingScan) return;
    setBarcode(pendingScan.barcode);
    if (pendingScan.record) {
      setBrand(pendingScan.record.brand ?? '');
      setProductName(pendingScan.record.product_name ?? '');
      setQtyAmount(pendingScan.record.qty_amount != null ? String(pendingScan.record.qty_amount) : '');
      setQtyUnit(pendingScan.record.qty_unit ?? 'g');
      setPrice(pendingScan.record.price != null ? String(pendingScan.record.price) : '');
    }
    onPendingScanConsumed();
  }, [pendingScan]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave() {
    if (!item) return;
    onSave({
      plan_id: item.plan_id,
      item_name: item.name,
      store,
      brand: brand.trim() || null,
      product_name: productName.trim() || null,
      qty_amount: qtyAmount ? parseFloat(qtyAmount) : null,
      qty_unit: qtyUnit,
      price: price ? parseFloat(price) : null,
      is_sale: isSale ? 1 : 0,
      barcode: barcode.trim() || null,
      purchased_at: new Date().toISOString(),
    });
  }

  if (!item) return null;

  const hasPrefill = !!latestRecord;
  const showSaleNote = isSale && baselinePrice != null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <AppText weight="extrabold" size="xl" color="textPrimary" style={styles.heading}>
            {item.name}
          </AppText>

          {hasPrefill && latestRecord && (
            <View style={styles.prefillBadge}>
              <AppText weight="semibold" size="2xs" color="green">
                {`↩ Last bought ${formatDate(latestRecord.purchased_at)}${latestRecord.price != null ? ` · ${formatPrice(latestRecord.price)}` : ''}`}
              </AppText>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} style={styles.fields}>
            <FieldWrap label="Brand">
              <TextInput
                style={styles.input}
                value={brand}
                onChangeText={setBrand}
                placeholder="e.g. Coles, Macro, Lilydale"
                placeholderTextColor={colors.textTertiary}
              />
            </FieldWrap>

            <FieldWrap label="Product name">
              <TextInput
                style={styles.input}
                value={productName}
                onChangeText={setProductName}
                placeholder="e.g. RSPCA Chicken Breast"
                placeholderTextColor={colors.textTertiary}
              />
            </FieldWrap>

            <View style={styles.twoCol}>
              <View style={styles.colFlex}>
                <AppText weight="bold" size="2xs" color="textTertiary" style={styles.fieldLabel}>
                  QTY / SIZE
                </AppText>
                <View style={styles.qtyRow}>
                  <TextInput
                    style={[styles.input, styles.qtyInput]}
                    value={qtyAmount}
                    onChangeText={setQtyAmount}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                  />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.unitScroll}
                    contentContainerStyle={styles.unitScrollContent}
                  >
                    {QTY_UNITS.map((u) => (
                      <TouchableOpacity
                        key={u}
                        style={[styles.unitChip, qtyUnit === u && styles.unitChipSelected]}
                        onPress={() => setQtyUnit(u)}
                        activeOpacity={0.7}
                      >
                        <AppText
                          weight="bold"
                          size="2xs"
                          color={qtyUnit === u ? 'onGreen' : 'textTertiary'}
                        >
                          {u}
                        </AppText>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <View style={styles.colFlex}>
                <AppText weight="bold" size="2xs" color="textTertiary" style={styles.fieldLabel}>
                  PRICE PAID
                </AppText>
                <View style={styles.priceRow}>
                  <TextInput
                    style={[styles.input, styles.priceInput]}
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="decimal-pad"
                    placeholder="$0.00"
                    placeholderTextColor={colors.textTertiary}
                  />
                  <View style={styles.saleToggle}>
                    <Switch
                      value={isSale}
                      onValueChange={setIsSale}
                      trackColor={{ false: colors.checkboxBorder, true: colors.orange }}
                      thumbColor="white"
                      style={styles.switch}
                    />
                    <AppText
                      weight="bold"
                      size="2xs"
                      color={isSale ? 'orange' : 'textTertiary'}
                    >
                      Sale
                    </AppText>
                  </View>
                </View>
                {showSaleNote && (
                  <AppText weight="medium" size="2xs" color="textNote" style={styles.saleNote}>
                    {`Sale price — baseline stays ${formatPrice(baselinePrice!)}`}
                  </AppText>
                )}
              </View>
            </View>

            <AppText weight="bold" size="2xs" color="textTertiary" style={styles.fieldLabel}>
              BARCODE
            </AppText>
            <View style={styles.barcodeRow}>
              <TextInput
                style={[styles.input, styles.barcodeInput]}
                value={barcode}
                onChangeText={setBarcode}
                placeholder="— or scan →"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={styles.scanBtn}
                onPress={() => router.push('/barcode-scanner')}
                activeOpacity={0.85}
              >
                <Ionicons name="camera-outline" size={15} color={colors.onGreen} />
                <AppText weight="bold" size="sm" color="onGreen"> Scan</AppText>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.doneBtn} onPress={handleSave} activeOpacity={0.85}>
            <AppText weight="extrabold" size="md" color="onGreen">Done</AppText>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FieldWrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={fieldStyles.wrap}>
      <AppText weight="bold" size="2xs" color="textTertiary" style={fieldStyles.label}>
        {label.toUpperCase()}
      </AppText>
      {children}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { marginBottom: spacing[3] },
  label: { marginBottom: spacing[1], letterSpacing: 0.8 },
});

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.card, borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg, padding: spacing[4],
    paddingBottom: spacing[8], maxHeight: '90%',
  },
  handle: {
    width: 32, height: 4, borderRadius: radius.full,
    backgroundColor: colors.divider, alignSelf: 'center', marginBottom: spacing[3],
  },
  heading: { marginBottom: spacing[2] },
  prefillBadge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(28,69,60,0.07)',
    borderRadius: radius.xs, paddingHorizontal: spacing[2],
    paddingVertical: spacing[1], marginBottom: spacing[3],
  },
  fields: { flex: 1 },
  fieldLabel: { marginBottom: spacing[1], letterSpacing: 0.8 },
  input: {
    backgroundColor: colors.cream, borderWidth: 1.5, borderColor: colors.divider,
    borderRadius: radius.sm + 2, paddingHorizontal: spacing[3],
    paddingVertical: spacing[2], fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13, color: colors.textPrimary,
  },
  twoCol: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },
  colFlex: { flex: 1 },
  qtyRow: { flexDirection: 'row', gap: spacing[1], alignItems: 'center' },
  qtyInput: { width: 64 },
  unitScroll: { flex: 1 },
  unitScrollContent: { gap: spacing[1], alignItems: 'center' },
  unitChip: {
    paddingHorizontal: spacing[2], paddingVertical: spacing[1],
    borderRadius: radius.full, backgroundColor: colors.cream,
    borderWidth: 1.5, borderColor: colors.divider,
  },
  unitChipSelected: { backgroundColor: colors.green, borderColor: colors.green },
  priceRow: { flexDirection: 'row', gap: spacing[1], alignItems: 'center' },
  priceInput: { flex: 1 },
  saleToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  switch: { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] },
  saleNote: { marginTop: spacing[1] },
  barcodeRow: { flexDirection: 'row', gap: spacing[2], alignItems: 'center', marginBottom: spacing[4] },
  barcodeInput: { flex: 1 },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.green,
    borderRadius: radius.sm + 2, paddingHorizontal: spacing[3],
    paddingVertical: spacing[2] + 1,
  },
  doneBtn: {
    backgroundColor: colors.orange, borderRadius: radius.full,
    paddingVertical: spacing[3], alignItems: 'center', marginTop: spacing[2],
  },
});
