import React, { useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../components/ui/AppText';
import { ReceiptRow } from '../components/ReceiptRow';
import { ReviewItemSheet } from '../components/ReviewItemSheet';
import { usePlan } from '../hooks/usePlan';
import { usePurchaseHistory } from '../hooks/usePurchaseHistory';
import { useShoppingMode } from '../hooks/useShoppingMode';
import { useShoppingItems } from '../hooks/useShoppingItems';
import { colors, spacing, radius } from '../constants/tokens';
import { formatPrice } from '../lib/format';
import type { AddPurchaseData } from '../hooks/usePurchaseHistory';
import type { PurchaseHistoryRowWithProduct, ShoppingItemRow } from '../types/db';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const dd = d.getDate();
  const mmm = MONTHS[d.getMonth()];
  const yyyy = d.getFullYear();
  const hh = String(d.getHours() % 12 || 12);
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ampm = d.getHours() < 12 ? 'AM' : 'PM';
  return `${dd} ${mmm} ${yyyy} · ${hh}:${mm} ${ampm}`;
}

function formatQty(amount: number, unit: PurchaseHistoryRowWithProduct['qty_unit']): string {
  if (unit === 'units') return amount === 1 ? '1 unit' : `${amount} units`;
  return `${amount}${unit}`;
}

function rowSubtitle(row: PurchaseHistoryRowWithProduct): string | null {
  const parts: string[] = [];
  if (row.qty_amount != null && row.qty_unit != null) {
    parts.push(formatQty(row.qty_amount, row.qty_unit));
  }
  if (row.brand) parts.push(row.brand);
  if (row.product_name && row.product_name !== row.brand) parts.push(row.product_name);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export default function ShopReceiptScreen() {
  const insets = useSafeAreaInsets();
  const { plan } = usePlan();
  const planId = plan?.row.id ?? null;
  const { activeStore, setMode } = useShoppingMode(planId);
  const { items, toggleItem } = useShoppingItems(planId);
  const {
    pendingRecords,
    deletePending,
    updatePending,
    confirmShop,
  } = usePurchaseHistory(planId);

  const [editing, setEditing] = useState<PurchaseHistoryRowWithProduct | null>(null);

  const earliestPurchasedAt = useMemo(() => {
    if (pendingRecords.length === 0) return new Date().toISOString();
    return pendingRecords[0].purchased_at;
  }, [pendingRecords]);

  const total = useMemo(
    () => pendingRecords.reduce((sum, r) => sum + (r.price ?? 0), 0),
    [pendingRecords],
  );

  const chain = activeStore?.chain ?? '';
  const branch = activeStore?.branch ?? '';
  const isEmpty = pendingRecords.length === 0;

  function findItemFor(row: PurchaseHistoryRowWithProduct): ShoppingItemRow | undefined {
    return items.find(
      i => i.name.toLowerCase() === row.item_name.toLowerCase(),
    );
  }

  async function handleRemove(row: PurchaseHistoryRowWithProduct) {
    if (!planId) return;
    const item = findItemFor(row);
    await deletePending(planId, row.item_name);
    if (item && item.is_checked === 1) {
      await toggleItem(item.id);
    }
  }

  async function handleSaveEdit(data: AddPurchaseData, pendingRowId: string | null) {
    if (pendingRowId) {
      await updatePending(pendingRowId, data);
    }
    setEditing(null);
  }

  async function handleConfirm() {
    if (!planId || isEmpty) return;
    await confirmShop(planId);
    await setMode('quick');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <TouchableOpacity
          style={styles.close}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close receipt"
        >
          <Ionicons name="close" size={26} color={colors.onGreen} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AppText weight="extrabold" size="xl" color="onGreen">Done shopping</AppText>
          {!isEmpty && (
            <AppText weight="semibold" size="xs" color="onGreenSubtle">
              Tap a line to edit · swipe to remove
            </AppText>
          )}
        </View>
      </View>

      {isEmpty ? (
        <View style={styles.empty}>
          <AppText weight="bold" size="lg" color="textPrimary" style={styles.emptyText}>
            Nothing left — shop again?
          </AppText>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.back()}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Close receipt"
          >
            <AppText weight="extrabold" size="md" color="onGreen">Close</AppText>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView style={styles.paper} contentContainerStyle={styles.paperContent}>
            <AppText weight="extrabold" size="xl" color="green" style={styles.storeLine}>
              {chain.toUpperCase()}
            </AppText>
            {branch ? (
              <AppText weight="bold" size="sm" color="green" style={styles.branchLine}>
                {branch.toUpperCase()}
              </AppText>
            ) : null}
            <AppText weight="semibold" size="xs" color="textTertiary" style={styles.dateLine}>
              {formatDateTime(earliestPurchasedAt)}
            </AppText>

            <View style={styles.dashed} />

            {pendingRecords.map((row) => (
              <ReceiptRow
                key={row.id}
                name={row.item_name}
                subtitle={rowSubtitle(row)}
                price={row.price}
                onTap={() => setEditing(row)}
                onRemove={() => handleRemove(row)}
              />
            ))}

            <View style={styles.dashed} />

            <AppText weight="bold" size="xs" color="textTertiary" style={styles.itemCount}>
              — {pendingRecords.length} item{pendingRecords.length === 1 ? '' : 's'} —
            </AppText>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[3] }]}>
            <View style={styles.totalLine}>
              <AppText weight="extrabold" size="2xl" color="green">TOTAL</AppText>
              <AppText weight="extrabold" size="2xl" color="orange" style={styles.totalAmount}>
                {formatPrice(total)}
              </AppText>
            </View>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={handleConfirm}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Confirm shop"
            >
              <AppText weight="extrabold" size="md" color="onGreen">Confirm</AppText>
            </TouchableOpacity>
          </View>
        </>
      )}

      <ReviewItemSheet
        visible={editing !== null}
        item={editing ? {
          id: editing.id,
          plan_id: editing.plan_id ?? '',
          name: editing.item_name,
          category: '',
          category_order: 0,
          item_order: 0,
          qty: '',
          estimated_price: 0,
          is_oneoff: 0,
          note: null,
          is_checked: 1,
          item_key: null,
          planned_qty: null,
        } : null}
        store={chain}
        branch={branch}
        latestRecord={null}
        pendingRow={editing}
        pendingScan={null}
        onSave={handleSaveEdit}
        onClose={() => setEditing(null)}
        onPendingScanConsumed={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  header: {
    backgroundColor: colors.green,
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing[3],
  },
  close: { padding: spacing[1] },
  paper: { flex: 1 },
  paperContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: 150,
  },
  storeLine: { textAlign: 'center', letterSpacing: 1.8 },
  branchLine: { textAlign: 'center', letterSpacing: 1, opacity: 0.75, marginTop: 2 },
  dateLine: { textAlign: 'center', marginTop: spacing[1] + 2 },
  dashed: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.paperDivider,
    marginVertical: spacing[3] + 2,
  },
  itemCount: { textAlign: 'center', letterSpacing: 0.5 },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.paperDivider,
    borderStyle: 'dashed',
  },
  totalLine: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  totalAmount: { fontVariant: ['tabular-nums'] },
  confirmBtn: {
    backgroundColor: colors.orange, borderRadius: radius.full,
    paddingVertical: spacing[3] + 2, alignItems: 'center',
  },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing[5], gap: spacing[5],
  },
  emptyText: { textAlign: 'center' },
  emptyBtn: {
    backgroundColor: colors.green, borderRadius: radius.full,
    paddingHorizontal: spacing[6], paddingVertical: spacing[3],
  },
});
