import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { KeyboardAvoidingView, KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, radius, shadow, spacing } from "../constants/tokens";
import type { FoodNutritionData } from "../hooks/useFoodNutrition";
import { useFoodNutrition } from "../hooks/useFoodNutrition";
import { useIngredientSuggestions } from "../hooks/useIngredientSuggestions";
import type { FoodNutritionRow } from "../types/db";
import type { Ingredient, Unit } from "../meal_plan.types";
import type { Suggestion } from "../lib/suggestions/types";
import { amountToBasis } from "../lib/amount";
import { AppText } from "./ui/AppText";
import { PriceHistoryChart } from "./PriceHistoryChart";
import { SuggestionDropdown } from "./SuggestionDropdown";

type Basis = "per_100g" | "per_100mL" | "per_unit";

const BASIS_LABELS: { value: Basis; label: string }[] = [
  { value: "per_100g", label: "100g" },
  { value: "per_100mL", label: "100mL" },
  { value: "per_unit", label: "unit" },
];

interface Props {
  visible: boolean;
  mode: 'add' | 'edit';
  initialIngredient: Ingredient | null;
  existingEntry: FoodNutritionRow | null;
  onSave: (data: { ingredient: Ingredient; nutrition: FoodNutritionData | null }) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function IngredientSheet({
  visible,
  mode,
  initialIngredient,
  existingEntry,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const [name, setName] = useState("");
  const [amountValue, setAmountValue] = useState("");
  const [unit, setUnit] = useState<Unit>('g');
  const [customUnitMode, setCustomUnitMode] = useState(false);
  const [customUnit, setCustomUnit] = useState("");
  const [noteMode, setNoteMode] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [unitPickerVisible, setUnitPickerVisible] = useState(false);
  const [basis, setBasis] = useState<Basis>("per_100g");
  const [brand, setBrand] = useState("");
  const [productName, setProductName] = useState("");
  const [cal, setCal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  // tracks whether the current cal value was auto-calculated (so macros can update it)
  const calIsAuto = useRef(false);

  const { query: querySuggestions, invalidate: invalidateSuggestions } = useIngredientSuggestions();
  const { getById: getFoodNutritionById } = useFoodNutrition();
  const [brandFocused, setBrandFocused] = useState(false);
  const [productFocused, setProductFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [dropdownHeight, setDropdownHeight] = useState(0);
  // id from a chosen has-nutrition suggestion (add mode) or the existing row (edit mode);
  // cleared in add mode whenever the user edits brand or product after picking
  const autofilledFoodNutritionId = useRef<string | null>(existingEntry?.id ?? null);

  useEffect(() => {
    if (!visible) { setSuggestions([]); return; }
    if (name.trim().length === 0) { setSuggestions([]); return; }
    if (!brandFocused && !productFocused) { setSuggestions([]); return; }

    let cancelled = false;
    const field = brandFocused ? 'brand' : 'product';
    const text = field === 'brand' ? brand : productName;
    const brandFilter = field === 'product' ? brand : undefined;

    querySuggestions({ field, text, ingredientName: name, brandFilter }).then(s => {
      if (!cancelled) setSuggestions(s);
    });
    return () => { cancelled = true; };
  }, [visible, brandFocused, productFocused, name, brand, productName, querySuggestions]);

  useEffect(() => {
    if (!visible) return;
    calIsAuto.current = false;
    setName(initialIngredient?.item ?? "");

    // Seed amount/unit/customUnit/note from initialIngredient
    if (initialIngredient) {
      const a = initialIngredient.amount;
      if (a.kind === 'note') {
        setNoteMode(true);
        setNoteText(a.text);
        setAmountValue("");
        setUnit('g');
        setCustomUnitMode(false);
        setCustomUnit("");
      } else if (a.kind === 'custom') {
        setNoteMode(false);
        setNoteText("");
        setCustomUnitMode(true);
        setCustomUnit(a.unit);
        setAmountValue(String(a.value));
        setUnit('unit');
      } else {
        setNoteMode(false);
        setNoteText("");
        setCustomUnitMode(false);
        setCustomUnit("");
        setAmountValue(String(a.value));
        setUnit(a.unit);
      }
    } else {
      setNoteMode(false);
      setNoteText("");
      setCustomUnitMode(false);
      setCustomUnit("");
      setAmountValue("");
      setUnit('g');
    }

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
      setBasis(initialIngredient ? amountToBasis(initialIngredient.amount) : "per_100g");
      setBrand("");
      setProductName("");
      setCal("");
      setProtein("");
      setCarbs("");
      setFat("");
    }
  }, [visible, existingEntry, initialIngredient]);

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
    const trimmedName = name.trim();
    if (!trimmedName) return;

    let amount: Ingredient['amount'];
    if (noteMode) {
      amount = { kind: 'note', text: noteText.trim() };
    } else {
      const value = parseFloat(amountValue);
      if (isNaN(value) || value <= 0) return;
      if (customUnitMode) {
        const u = customUnit.trim();
        if (!u) return;
        amount = { kind: 'custom', value, unit: u };
      } else {
        amount = { kind: 'measured', value, unit };
      }
    }

    const hasNutritionInput =
      brand.trim() !== "" ||
      productName.trim() !== "" ||
      cal !== "" || protein !== "" || carbs !== "" || fat !== "";

    const nutrition: FoodNutritionData | null = hasNutritionInput
      ? {
          item_name: trimmedName.toLowerCase(),
          brand: brand.trim() || null,
          product_name: productName.trim() || null,
          basis,
          cal_per_basis:     cal     ? parseFloat(cal)     : null,
          protein_per_basis: protein ? parseFloat(protein) : null,
          carbs_per_basis:   carbs   ? parseFloat(carbs)   : null,
          fat_per_basis:     fat     ? parseFloat(fat)     : null,
        }
      : null;

    onSave({ ingredient: { item: trimmedName, amount }, nutrition });
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
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder="Ingredient name"
              placeholderTextColor={colors.textTertiary}
            />
            {mode === 'edit' && onDelete && (
              <TouchableOpacity
                style={styles.trashBtn}
                onPress={() => {
                  Alert.alert(
                    `Remove ${initialIngredient?.item ?? 'ingredient'}?`,
                    undefined,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: onDelete },
                    ],
                  );
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={20} color={colors.terracotta} />
              </TouchableOpacity>
            )}
          </View>

          {!noteMode && (
          <View style={styles.amtRow}>
            <TextInput
              style={styles.amtInput}
              value={amountValue}
              onChangeText={setAmountValue}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
            />
            {customUnitMode ? (
              <View style={styles.customUnitWrap}>
                <TextInput
                  style={styles.customUnitInput}
                  value={customUnit}
                  onChangeText={setCustomUnit}
                  placeholder="cloves"
                  placeholderTextColor={colors.textTertiary}
                />
                <TouchableOpacity
                  onPress={() => { setCustomUnitMode(false); setCustomUnit(""); setUnit('g'); }}
                  style={styles.customUnitClear}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.unitSelect}
                onPress={() => setUnitPickerVisible(true)}
                activeOpacity={0.7}
              >
                <AppText weight="semibold" size="md" color="textPrimary">{unitLabel(unit)}</AppText>
                <Ionicons name="chevron-down" size={14} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
          )}

          {noteMode && (
            <View style={styles.noteWrap}>
              <TextInput
                style={styles.input}
                value={noteText}
                onChangeText={setNoteText}
                placeholder="to taste"
                placeholderTextColor={colors.textTertiary}
              />
              <TouchableOpacity
                style={styles.noteToMeasured}
                onPress={() => { setNoteMode(false); setNoteText(""); setAmountValue("0"); setUnit('g'); }}
                activeOpacity={0.7}
              >
                <AppText weight="bold" size="xs" color="green" style={{ letterSpacing: font.tracking.label }}>
                  Add measurement
                </AppText>
              </TouchableOpacity>
            </View>
          )}

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
              onFocus={() => { setBrandFocused(true); setProductFocused(false); }}
              onBlur={() => setBrandFocused(false)}
            />
            {brandFocused && (
              <SuggestionDropdown
                suggestions={suggestions}
                showBrandInSecondary={false}
                onPick={() => { /* wired in next task */ }}
                onLayoutHeight={setDropdownHeight}
              />
            )}

            <FieldLabel top>PRODUCT NAME</FieldLabel>
            <TextInput
              style={styles.input}
              value={productName}
              onChangeText={setProductName}
              placeholder="e.g. Oat Milk Barista"
              placeholderTextColor={colors.textTertiary}
              onFocus={() => { setProductFocused(true); setBrandFocused(false); }}
              onBlur={() => setProductFocused(false)}
            />
            {productFocused && (
              <SuggestionDropdown
                suggestions={suggestions}
                showBrandInSecondary={brand.trim() === ''}
                onPick={() => { /* wired in next task */ }}
                onLayoutHeight={setDropdownHeight}
              />
            )}

            <View style={styles.basisRow}>
              <AppText weight="bold" size="xs" color="textTertiary" style={{ letterSpacing: font.tracking.caps }}>
                NUTRITION PER
              </AppText>
              <View style={styles.unitToggle}>
                {BASIS_LABELS.map(({ value, label }) => (
                  <TouchableOpacity
                    key={value}
                    style={[styles.unitOpt, basis === value && styles.unitOptActive]}
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

            <FieldLabel>CALORIES</FieldLabel>
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

      <Modal
        visible={unitPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUnitPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.pickerScrim}
          activeOpacity={1}
          onPress={() => setUnitPickerVisible(false)}
        >
          <View style={styles.pickerCard}>
            {(['g', 'kg', 'mL', 'L', 'unit'] as const).map((u) => (
              <TouchableOpacity
                key={u}
                style={styles.pickerOpt}
                onPress={() => { setUnit(u); setUnitPickerVisible(false); }}
                activeOpacity={0.7}
              >
                <AppText weight={unit === u ? 'bold' : 'semibold'} size="md" color="textPrimary">
                  {unitLabel(u)}
                </AppText>
                {unit === u && <Ionicons name="checkmark" size={18} color={colors.green} />}
              </TouchableOpacity>
            ))}
            <View style={styles.pickerDivider} />
            <TouchableOpacity
              style={styles.pickerOpt}
              onPress={() => { setNoteMode(true); setUnitPickerVisible(false); }}
              activeOpacity={0.7}
            >
              <AppText weight="semibold" size="md" color="green">Note (no measurement)</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.pickerOpt}
              onPress={() => { setCustomUnitMode(true); setUnit('unit'); setUnitPickerVisible(false); }}
              activeOpacity={0.7}
            >
              <AppText weight="semibold" size="md" color="green">Custom…</AppText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}

function unitLabel(u: Unit): string {
  switch (u) {
    case 'g':    return 'grams (g)';
    case 'kg':   return 'kilograms (kg)';
    case 'mL':   return 'millilitres (mL)';
    case 'L':    return 'litres (L)';
    case 'unit': return 'count (unit)';
  }
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
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  nameInput: {
    flex: 1,
    height: 44,
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3] + 2,
    paddingVertical: 0,
    fontFamily: font.family.bold,
    fontSize: font.size.lg,
    color: colors.textPrimary,
  },
  trashBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.divider,
    alignItems: "center",
    justifyContent: "center",
  },
  amtRow: {
    flexDirection: "row",
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  amtInput: {
    flexBasis: 110,
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3] + 2,
    paddingVertical: 10,
    fontFamily: font.family.semibold,
    fontSize: font.size.lg,
    color: colors.textPrimary,
    textAlign: 'right',
  },
  unitSelect: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3] + 2,
    paddingVertical: 10,
  },
  customUnitWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3] + 2,
  },
  customUnitInput: {
    flex: 1,
    paddingVertical: 10,
    fontFamily: font.family.semibold,
    fontSize: font.size.lg,
    color: colors.textPrimary,
  },
  customUnitClear: {
    paddingHorizontal: spacing[1],
  },
  noteWrap: {
    marginBottom: spacing[3],
    gap: spacing[2],
  },
  noteToMeasured: {
    alignSelf: 'flex-start',
    paddingVertical: spacing[1],
  },
  basisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[3],
    marginBottom: spacing[2],
  },
  pickerScrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: spacing[2],
    width: 260,
    ...shadow.sheet,
  },
  pickerOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: 44,
  },
  pickerDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing[1],
  },
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
