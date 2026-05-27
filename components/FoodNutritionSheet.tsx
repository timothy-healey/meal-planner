import { useEffect, useRef, useState } from "react";
import {
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { KeyboardAvoidingView, KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { colors, font, radius, shadow, spacing } from "../constants/tokens";
import type { FoodNutritionData } from "../hooks/useFoodNutrition";
import { parseAmountString, amountToBasis } from "../lib/amount";
import type { FoodNutritionRow } from "../types/db";
import { AppText } from "./ui/AppText";
import { PriceHistoryChart } from "./PriceHistoryChart";

type Basis = "per_100g" | "per_100mL" | "per_unit";

const BASIS_LABELS: { value: Basis; label: string }[] = [
  { value: "per_100g", label: "100g" },
  { value: "per_100mL", label: "100mL" },
  { value: "per_unit", label: "unit" },
];

interface Props {
  visible: boolean;
  ingredientName: string;
  ingredientAmount: string;
  existingEntry: FoodNutritionRow | null;
  onSave: (data: FoodNutritionData) => void;
  onClose: () => void;
}

export function FoodNutritionSheet({
  visible,
  ingredientName,
  ingredientAmount,
  existingEntry,
  onSave,
  onClose,
}: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const [basis, setBasis] = useState<Basis>("per_100g");
  const [brand, setBrand] = useState("");
  const [productName, setProductName] = useState("");
  const [cal, setCal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  // tracks whether the current cal value was auto-calculated (so macros can update it)
  const calIsAuto = useRef(false);

  useEffect(() => {
    if (!visible) return;
    calIsAuto.current = false;
    if (existingEntry) {
      setBasis(existingEntry.basis);
      setBrand(existingEntry.brand ?? "");
      setProductName(existingEntry.product_name ?? "");
      setCal(
        existingEntry.cal_per_basis != null
          ? String(existingEntry.cal_per_basis)
          : "",
      );
      setProtein(
        existingEntry.protein_per_basis != null
          ? String(existingEntry.protein_per_basis)
          : "",
      );
      setCarbs(
        existingEntry.carbs_per_basis != null
          ? String(existingEntry.carbs_per_basis)
          : "",
      );
      setFat(
        existingEntry.fat_per_basis != null
          ? String(existingEntry.fat_per_basis)
          : "",
      );
    } else {
      setBasis(amountToBasis(parseAmountString(ingredientAmount)));
      setBrand("");
      setProductName("");
      setCal("");
      setProtein("");
      setCarbs("");
      setFat("");
    }
  }, [visible, existingEntry, ingredientAmount]);

  useEffect(() => {
    const p = parseFloat(protein);
    const c = parseFloat(carbs);
    const f = parseFloat(fat);
    if (
      !isNaN(p) &&
      !isNaN(c) &&
      !isNaN(f) &&
      (cal === "" || calIsAuto.current)
    ) {
      const computed = Math.round(p * 4 + c * 4 + f * 9);
      calIsAuto.current = true;
      setCal(String(computed));
    }
  }, [protein, carbs, fat]);

  function handleSave() {
    onSave({
      item_name: ingredientName.toLowerCase().trim(),
      brand: brand.trim() || null,
      product_name: productName.trim() || null,
      basis,
      cal_per_basis: cal ? parseFloat(cal) : null,
      protein_per_basis: protein ? parseFloat(protein) : null,
      carbs_per_basis: carbs ? parseFloat(carbs) : null,
      fat_per_basis: fat ? parseFloat(fat) : null,
    });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior="padding"
      >
        <TouchableOpacity
          style={styles.backdrop}
          onPress={onClose}
          activeOpacity={1}
        />
        <View style={[styles.sheet, { height: windowHeight * 0.8 }]}>
          <View style={styles.handle} />

          <View style={styles.nameRow}>
            <AppText
              weight="extrabold"
              size="2xl"
              color="textPrimary"
              style={styles.nameText}
            >
              {ingredientName}
            </AppText>
            <View style={styles.unitToggle}>
              {BASIS_LABELS.map(({ value, label }) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.unitOpt,
                    basis === value && styles.unitOptActive,
                  ]}
                  onPress={() => setBasis(value)}
                  activeOpacity={0.7}
                >
                  <AppText
                    weight={basis === value ? "bold" : "semibold"}
                    size="2xs"
                    color={basis === value ? "green" : "textTertiary"}
                  >
                    {label}
                  </AppText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <KeyboardAwareScrollView
            style={styles.fields}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <FieldLabel>BRAND</FieldLabel>
            <TextInput
              style={styles.input}
              value={brand}
              onChangeText={setBrand}
              placeholder="e.g. Vitasoy"
              placeholderTextColor={colors.textTertiary}
            />

            <FieldLabel top>PRODUCT NAME</FieldLabel>
            <TextInput
              style={styles.input}
              value={productName}
              onChangeText={setProductName}
              placeholder="e.g. Oat Milk Barista"
              placeholderTextColor={colors.textTertiary}
            />

            <FieldLabel top>CALORIES</FieldLabel>
            <TextInput
              style={styles.input}
              value={cal}
              onChangeText={(v) => {
                calIsAuto.current = false;
                setCal(v);
              }}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
            />

            <View style={[styles.twoCol, { marginTop: spacing[4] }]}>
              <View style={styles.colFlex}>
                <FieldLabel>PROTEIN</FieldLabel>
                <TextInput
                  style={styles.input}
                  value={protein}
                  onChangeText={setProtein}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
              <View style={styles.colFlex}>
                <FieldLabel>CARBS</FieldLabel>
                <TextInput
                  style={styles.input}
                  value={carbs}
                  onChangeText={setCarbs}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
              <View style={styles.colFlex}>
                <FieldLabel>FAT</FieldLabel>
                <TextInput
                  style={styles.input}
                  value={fat}
                  onChangeText={setFat}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            </View>

            <View style={{ height: spacing[3] }} />

            {existingEntry?.brand && existingEntry?.product_name && (
              <PriceHistoryChart
                brand={existingEntry.brand}
                productName={existingEntry.product_name}
              />
            )}

            <View style={{ height: spacing[4] }} />
          </KeyboardAwareScrollView>

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
        letterSpacing: font.tracking.caps,
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
    backgroundColor: colors.scrim,
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
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  nameText: { flex: 1 },
  unitToggle: {
    flexDirection: "row",
    backgroundColor: colors.divider,
    borderRadius: radius.full,
    padding: 2,
    gap: 2,
    flexShrink: 0,
  },
  unitOpt: {
    borderRadius: radius.full,
    paddingHorizontal: spacing[2] + 1,
    paddingVertical: 5,
  },
  unitOptActive: {
    backgroundColor: colors.card,
    ...shadow.pill,
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
  doneBtn: {
    backgroundColor: colors.orange,
    borderRadius: radius.full,
    paddingVertical: spacing[3] + 2,
    alignItems: "center",
    marginTop: spacing[3],
  },
});
