import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../../components/ui/AppText';
import { GreenHeader } from '../../components/ui/GreenHeader';
import { PriceHistoryChart } from '../../components/PriceHistoryChart';
import { IngredientSheet } from '../../components/IngredientSheet';
import { MergeProductSheet } from '../../components/MergeProductSheet';
import { useProducts } from '../../hooks/useProducts';
import { useRecipes } from '../../hooks/useRecipes';
import { useDb, usePlanVersion } from '../../providers/DatabaseProvider';
import { colors, font, radius, spacing } from '../../constants/tokens';
import { formatPrice, formatRelativeTime } from '../../lib/format';
import type { ProductRow, PurchaseHistoryRow } from '../../types/db';
import type { Ingredient } from '../../meal_plan.types';
import type { ProductInput } from '../../hooks/useProducts';

type MenuAction = 'rename' | 'merge' | 'delete' | null;

type PurchaseDetail = PurchaseHistoryRow & { chain: string | null };

export default function CatalogDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getById, getAll, upsert, deleteProduct, mergeProduct } = useProducts();
  const { recipes } = useRecipes();
  const db = useDb();
  const { bumpPlanVersion } = usePlanVersion();

  const [product, setProduct] = useState<ProductRow | null>(null);
  const [allProducts, setAllProducts] = useState<ProductRow[]>([]);
  const [purchasesForProduct, setPurchasesForProduct] = useState<PurchaseDetail[]>([]);
  const [editVisible, setEditVisible] = useState(false);
  const [mergeVisible, setMergeVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    getById(id).then(setProduct);
    getAll().then(setAllProducts);
  }, [id, getById, getAll, reloadKey]);

  useEffect(() => {
    if (!product) return;
    db.getAllAsync<PurchaseDetail>(
      `SELECT ph.*, s.chain
       FROM purchase_history ph
       LEFT JOIN stores s ON s.id = ph.store_id
       WHERE ph.product_id = ? AND ph.status = 'confirmed'
       ORDER BY ph.purchased_at DESC`,
      [product.id],
    ).then(setPurchasesForProduct);
  }, [product, db, reloadKey]);

  if (!product) {
    return (
      <View style={styles.notFound}>
        <AppText weight="semibold" color="textSecondary">Product not found.</AppText>
      </View>
    );
  }

  const recipesUsingProduct = recipes.filter(r =>
    r.ingredients.some(ing => ing.product_id === product.id),
  );

  const hasAnyMacro = product.cal_per_basis != null || product.protein_per_basis != null ||
                      product.carbs_per_basis != null || product.fat_per_basis != null;

  async function handleEditSave({ nutrition }: { ingredient: Ingredient; nutrition: ProductInput | null }) {
    if (nutrition) await upsert(nutrition);
    setEditVisible(false);
    bumpPlanVersion();
    setReloadKey(k => k + 1);
  }

  function handleMenuAction(action: MenuAction) {
    setMenuOpen(false);
    if (action === 'rename') setEditVisible(true);
    else if (action === 'merge') setMergeVisible(true);
    else if (action === 'delete') confirmDelete();
  }

  function confirmDelete() {
    if (!product) return;
    Alert.alert(
      `Delete ${product.brand ? `${product.brand} ${product.product_name}` : product.product_name}?`,
      'All references in recipes and purchases will be cleared.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteProduct(product.id);
            bumpPlanVersion();
            router.back();
          },
        },
      ],
    );
  }

  async function handleMerge(targetId: string) {
    if (!product) return;
    await mergeProduct(product.id, targetId);
    setMergeVisible(false);
    bumpPlanVersion();
    router.back();
  }

  const brandLabel = product.brand === '' ? 'GENERIC' : product.brand.toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <GreenHeader>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={22} color={colors.onGreen} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMenuOpen(true)}
            accessibilityLabel="Product actions"
            style={styles.menuBtn}
          >
            <Ionicons name="ellipsis-vertical" size={22} color={colors.onGreen} />
          </TouchableOpacity>
        </View>
        <View style={styles.brandPill}>
          <AppText weight="bold" size="2xs" color="onGreen">{brandLabel}</AppText>
        </View>
        <AppText weight="extrabold" size="2xl" color="onGreen" style={styles.productName}>
          {product.product_name}
        </AppText>
        <AppText weight="medium" size="sm" color="onGreenSubtle" style={styles.itemName}>
          {product.item_name}
        </AppText>
      </GreenHeader>

      <ScrollView
        contentContainerStyle={{ padding: spacing[3], paddingBottom: insets.bottom + spacing[6] }}
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <AppText weight="bold" size="xs" color="terracotta" style={styles.cardTitle}>NUTRITION</AppText>
            <TouchableOpacity onPress={() => setEditVisible(true)} accessibilityLabel="Edit nutrition">
              <AppText weight="semibold" size="sm" color="textSecondary">✎ Edit</AppText>
            </TouchableOpacity>
          </View>
          {hasAnyMacro ? (
            <View>
              <View style={styles.macroGrid}>
                <MacroCell label="KCAL" value={product.cal_per_basis} unit="" />
                <MacroCell label="PROTEIN" value={product.protein_per_basis} unit="g" />
                <MacroCell label="CARBS" value={product.carbs_per_basis} unit="g" />
                <MacroCell label="FAT" value={product.fat_per_basis} unit="g" />
              </View>
              <View style={styles.basisPill}>
                <AppText weight="bold" size="2xs" color="terracotta">
                  per {product.basis === 'per_100g' ? '100g' : product.basis === 'per_100mL' ? '100mL' : 'unit'}
                </AppText>
              </View>
            </View>
          ) : (
            <View style={styles.emptyNutrition}>
              <AppText weight="semibold" size="md" color="textTertiary" style={{ marginBottom: spacing[2] }}>
                No nutrition on file
              </AppText>
              <TouchableOpacity onPress={() => setEditVisible(true)} style={styles.addCta}>
                <AppText weight="bold" size="sm" color="onGreen">Add macros</AppText>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <AppText weight="bold" size="xs" color="terracotta" style={styles.cardTitle}>
              PURCHASE HISTORY · {purchasesForProduct.length}
            </AppText>
          </View>
          {purchasesForProduct.length > 0 ? (
            <View>
              <PriceHistoryChart itemName={product.item_name} />
              <View style={{ marginTop: spacing[3] }}>
                {purchasesForProduct.slice(0, 5).map(p => (
                  <View key={p.id} style={styles.purchaseRow}>
                    <View style={{ flex: 1 }}>
                      <AppText weight="semibold" size="sm" color="textPrimary">
                        {formatRelativeTime(p.purchased_at)}
                      </AppText>
                      <AppText weight="medium" size="xs" color="textTertiary">
                        {(p.chain ?? 'Unknown store')}{p.qty_amount != null && p.qty_unit ? ` · ${p.qty_amount}${p.qty_unit}` : ''}
                      </AppText>
                    </View>
                    {p.price != null && (
                      <AppText weight="extrabold" size="md" color="orange">{formatPrice(p.price)}</AppText>
                    )}
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <AppText weight="medium" size="sm" color="textTertiary">No purchases yet.</AppText>
          )}
        </View>

        {recipesUsingProduct.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <AppText weight="bold" size="xs" color="terracotta" style={styles.cardTitle}>
                USED IN · {recipesUsingProduct.length} {recipesUsingProduct.length === 1 ? 'RECIPE' : 'RECIPES'}
              </AppText>
            </View>
            {recipesUsingProduct.map(r => (
              <TouchableOpacity
                key={r.id}
                style={styles.recipeRow}
                onPress={() => router.push(`/recipe/${r.id}`)}
              >
                <AppText weight="semibold" size="md" color="textPrimary" style={{ flex: 1 }}>{r.title}</AppText>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {menuOpen && (
        <View style={styles.menuOverlay}>
          <TouchableOpacity style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} />
          <View style={styles.menuSheet}>
            <TouchableOpacity
              accessibilityLabel="Rename product"
              style={styles.menuItem}
              onPress={() => handleMenuAction('rename')}
            >
              <AppText weight="semibold" size="md" color="textPrimary">Rename product</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="Merge into another product"
              style={styles.menuItem}
              onPress={() => handleMenuAction('merge')}
            >
              <AppText weight="semibold" size="md" color="textPrimary">Merge into another product</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="Delete product"
              style={styles.menuItem}
              onPress={() => handleMenuAction('delete')}
            >
              <AppText weight="semibold" size="md" color="terracotta">Delete product</AppText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <IngredientSheet
        visible={editVisible}
        mode="edit"
        initialIngredient={{ item: product.item_name, amount: { kind: 'measured', value: 100, unit: 'g' } }}
        existingEntry={product}
        onSave={handleEditSave}
        onClose={() => setEditVisible(false)}
      />

      <MergeProductSheet
        visible={mergeVisible}
        source={product}
        candidates={allProducts}
        onClose={() => setMergeVisible(false)}
        onMerge={handleMerge}
      />
    </View>
  );
}

function MacroCell({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <View style={styles.macroCell}>
      <AppText weight="bold" size="2xs" color="textTertiary">{label}</AppText>
      <AppText weight="extrabold" size="xl" color="orange" style={styles.macroValue}>
        {value != null ? String(value) : '—'}
      </AppText>
      {unit && <AppText weight="semibold" size="2xs" color="textTertiary">{unit}</AppText>}
    </View>
  );
}

const styles = StyleSheet.create({
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[2] },
  menuBtn: { padding: spacing[1] },
  brandPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.headerPill,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2] + 2,
    paddingVertical: 2,
    marginBottom: spacing[1],
  },
  productName: { lineHeight: 28 },
  itemName: { marginTop: 2, opacity: 0.85 },
  card: {
    backgroundColor: colors.card, borderRadius: radius.md,
    padding: spacing[3] + 2, marginBottom: spacing[3],
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[2] },
  cardTitle: { letterSpacing: font.tracking.category },
  macroGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  macroCell: { flex: 1, alignItems: 'center' },
  macroValue: { lineHeight: 22 },
  basisPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.cream,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    marginTop: spacing[2],
  },
  emptyNutrition: { alignItems: 'center', paddingVertical: spacing[3] },
  addCta: {
    backgroundColor: colors.green,
    borderRadius: radius.full,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2] + 2,
  },
  purchaseRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  recipeRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing[2] + 2,
  },
  menuOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'flex-end',
  },
  menuBackdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.scrim,
  },
  menuSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingVertical: spacing[2], paddingBottom: spacing[8],
  },
  menuItem: {
    paddingVertical: spacing[3] + 2,
    paddingHorizontal: spacing[4],
  },
});
