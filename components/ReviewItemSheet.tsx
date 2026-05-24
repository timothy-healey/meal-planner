import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { colors, font, radius, spacing } from "../constants/tokens";
import type { AddPurchaseData } from "../hooks/usePurchaseHistory";
import type { ScanResult } from "../lib/barcodeScanResult";
import { formatPrice } from "../lib/format";
import type { PurchaseHistoryRow, QtyUnit, ShoppingItemRow } from "../types/db";
import { PriceHistoryChart } from "./PriceHistoryChart";
import { AppText } from "./ui/AppText";

const QTY_UNITS: QtyUnit[] = ["g", "kg", "mL", "L", "units"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

interface Props {
  visible: boolean;
  item: ShoppingItemRow | null;
  store: string;          // chain
  branch: string;         // may be ''
  latestRecord: PurchaseHistoryRow | null;
  pendingRow: PurchaseHistoryRow | null;
  pendingScan: ScanResult | null;
  onSave: (data: AddPurchaseData, pendingRowId: string | null) => void;
  onClose: () => void;
  onPendingScanConsumed: () => void;
}

export function ReviewItemSheet({
  visible,
  item,
  store,
  branch,
  latestRecord,
  pendingRow,
  pendingScan,
  onSave,
  onClose,
  onPendingScanConsumed,
}: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const [brand, setBrand] = useState("");
  const [productName, setProductName] = useState("");
  const [qtyAmount, setQtyAmount] = useState("");
  const [qtyUnit, setQtyUnit] = useState<QtyUnit>("g");
  const [price, setPrice] = useState("");
  const [isSale, setIsSale] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);

  const baselinePrice =
    latestRecord && !latestRecord.is_sale ? latestRecord.price : null;

  useEffect(() => {
    if (!visible) return;
    setUnitPickerOpen(false);
    const source = pendingRow ?? latestRecord;
    if (source) {
      setBrand(source.brand ?? "");
      setProductName(source.product_name ?? "");
      setQtyAmount(source.qty_amount != null ? String(source.qty_amount) : "");
      setQtyUnit(source.qty_unit ?? "g");
      setPrice(source.price != null ? String(source.price) : "");
      setIsSale(pendingRow ? source.is_sale === 1 : false);
      setBarcode(source.barcode ?? "");
    } else {
      setBrand("");
      setProductName("");
      setQtyAmount("");
      setQtyUnit("g");
      setPrice("");
      setIsSale(false);
      setBarcode("");
    }
  }, [visible, latestRecord, pendingRow]);

  useEffect(() => {
    if (!pendingScan) return;
    setBarcode(pendingScan.barcode);
    if (pendingScan.record) {
      setBrand(pendingScan.record.brand ?? "");
      setProductName(pendingScan.record.product_name ?? "");
      setQtyAmount(
        pendingScan.record.qty_amount != null
          ? String(pendingScan.record.qty_amount)
          : "",
      );
      setQtyUnit(pendingScan.record.qty_unit ?? "g");
      setPrice(
        pendingScan.record.price != null
          ? String(pendingScan.record.price)
          : "",
      );
    }
    onPendingScanConsumed();
  }, [pendingScan]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave() {
    if (!item) return;
    onSave(
      {
        plan_id: item.plan_id,
        item_name: item.name,
        store,
        branch,
        brand: brand.trim() || null,
        product_name: productName.trim() || null,
        qty_amount: qtyAmount ? parseFloat(qtyAmount) : null,
        qty_unit: qtyUnit,
        price: price ? parseFloat(price) : null,
        is_sale: isSale ? 1 : 0,
        barcode: barcode.trim() || null,
        purchased_at: pendingRow?.purchased_at ?? new Date().toISOString(),
      },
      pendingRow?.id ?? null,
    );
  }

  if (!item) return null;

  const hasPrefill = !!latestRecord;
  const showSaleNote = isSale && baselinePrice != null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity
          style={styles.backdrop}
          onPress={onClose}
          activeOpacity={1}
        />
        <View style={[styles.sheet, { height: windowHeight * 0.8 }]}>
          <View style={styles.handle} />

          <AppText
            weight="extrabold"
            size="2xl"
            color="textPrimary"
            style={styles.heading}
          >
            {item.name}
          </AppText>

          {!pendingRow && hasPrefill && latestRecord && (
            <View style={styles.prefillBadge}>
              <AppText weight="semibold" size="sm" color="textSecondary">
                {`↩ Last bought ${formatDate(latestRecord.purchased_at)}${latestRecord.price != null ? ` · ${formatPrice(latestRecord.price)}` : ""}`}
              </AppText>
            </View>
          )}

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.fields}
            keyboardShouldPersistTaps="handled"
          >
            {/* Brand */}
            <FieldLabel>BRAND</FieldLabel>
            <TextInput
              style={styles.input}
              value={brand}
              onChangeText={setBrand}
              placeholder="e.g. Coles, Macro, Lilydale"
              placeholderTextColor={colors.textTertiary}
            />

            {/* Product name */}
            <FieldLabel top>PRODUCT NAME</FieldLabel>
            <TextInput
              style={styles.input}
              value={productName}
              onChangeText={setProductName}
              placeholder="e.g. RSPCA Chicken Breast"
              placeholderTextColor={colors.textTertiary}
            />

            {/* Qty + Price row */}
            <View style={styles.twoCol}>
              <View style={styles.colFlex}>
                <FieldLabel top>QTY / SIZE</FieldLabel>
                {/* Split input: number on left, unit selector on right */}
                <View style={styles.qtyBox}>
                  <TextInput
                    style={styles.qtyNumber}
                    value={qtyAmount}
                    onChangeText={setQtyAmount}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                  />
                  <View style={styles.qtyDivider} />
                  <TouchableOpacity
                    style={styles.unitBtn}
                    onPress={() => setUnitPickerOpen((v) => !v)}
                    activeOpacity={0.7}
                  >
                    <AppText weight="bold" size="md" color="textPrimary">
                      {qtyUnit}
                    </AppText>
                    <Ionicons
                      name={unitPickerOpen ? "chevron-up" : "chevron-down"}
                      size={12}
                      color={colors.textTertiary}
                      style={{ marginLeft: 2 }}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.colFlex}>
                <FieldLabel top>PRICE PAID</FieldLabel>
                <TextInput
                  style={styles.input}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                  placeholder="$0.00"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            </View>

            {/* Unit dropdown (appears below qty+price row when open) */}
            {unitPickerOpen && (
              <View style={styles.unitDropdown}>
                {QTY_UNITS.map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[
                      styles.unitOption,
                      qtyUnit === u && styles.unitOptionSelected,
                    ]}
                    onPress={() => {
                      setQtyUnit(u);
                      setUnitPickerOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <AppText
                      weight="semibold"
                      size="md"
                      color={qtyUnit === u ? "onGreen" : "textPrimary"}
                    >
                      {u}
                    </AppText>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Sale toggle */}
            <View style={styles.saleRow}>
              <Switch
                value={isSale}
                onValueChange={setIsSale}
                trackColor={{
                  false: colors.checkboxBorder,
                  true: colors.orange,
                }}
                thumbColor="white"
              />
              <AppText
                weight="semibold"
                size="sm"
                color={isSale ? "orange" : "textTertiary"}
              >
                Sale price
              </AppText>
              {showSaleNote && (
                <AppText weight="medium" size="sm" color="textNote">
                  {` — baseline stays ${formatPrice(baselinePrice!)}`}
                </AppText>
              )}
            </View>

            {/* Barcode */}
            <FieldLabel top>BARCODE</FieldLabel>
            <View style={styles.barcodeRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={barcode}
                onChangeText={setBarcode}
                placeholder="— or scan →"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={styles.scanBtn}
                onPress={() => router.push("/barcode-scanner")}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="camera-outline"
                  size={16}
                  color={colors.onGreen}
                />
                <AppText weight="bold" size="sm" color="onGreen">
                  {" "}
                  Scan
                </AppText>
              </TouchableOpacity>
            </View>

            {brand.trim() && productName.trim() && (
              <View style={{ marginTop: spacing[4], marginHorizontal: -spacing[4] }}>
                <PriceHistoryChart
                  brand={brand.trim()}
                  productName={productName.trim()}
                />
              </View>
            )}

            <View style={{ height: spacing[3] }} />
          </ScrollView>

          <TouchableOpacity
            style={styles.doneBtn}
            onPress={handleSave}
            activeOpacity={0.85}
          >
            <AppText weight="extrabold" size="lg" color="onGreen">
              Done
            </AppText>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FieldLabel({ children, top }: { children: string; top?: boolean }) {
  return (
    <AppText
      weight="bold"
      size="xs"
      color="textTertiary"
      style={{
        letterSpacing: 0.8,
        marginBottom: spacing[1],
        marginTop: top ? spacing[4] : 0,
      }}
    >
      {children}
    </AppText>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg + 4,
    borderTopRightRadius: radius.lg + 4,
    paddingTop: spacing[2],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[6],
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.divider,
    alignSelf: "center",
    marginBottom: spacing[4],
  },
  heading: { marginBottom: spacing[3] },
  prefillBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.divider,
  },
  fields: { flex: 1 },
  input: {
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontFamily: font.family.semibold,
    fontSize: font.size.lg,
    color: colors.textPrimary,
  },
  twoCol: { flexDirection: "row", gap: spacing[3] },
  colFlex: { flex: 1 },
  qtyBox: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  qtyNumber: {
    flex: 1,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontFamily: font.family.semibold,
    fontSize: font.size.lg,
    color: colors.textPrimary,
    minWidth: 0,
  },
  qtyDivider: { width: 1.5, backgroundColor: colors.divider },
  unitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    minWidth: 52,
  },
  unitDropdown: {
    marginTop: spacing[1],
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: radius.md,
    overflow: "hidden",
    marginBottom: spacing[1],
  },
  unitOption: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  unitOptionSelected: { backgroundColor: colors.green },
  saleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginTop: spacing[3],
  },
  barcodeRow: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  doneBtn: {
    backgroundColor: colors.orange,
    borderRadius: radius.full,
    paddingVertical: spacing[3] + 2,
    alignItems: "center",
    marginTop: spacing[3],
  },
});
