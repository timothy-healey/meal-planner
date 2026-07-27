import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { GreenHeader } from '../../components/ui/GreenHeader';
import { AppText } from '../../components/ui/AppText';
import { CategoryHeader } from '../../components/ui/CategoryHeader';
import { StepList } from '../../components/ui/StepList';
import { IngredientRow } from '../../components/IngredientRow';
import { IngredientSheet } from '../../components/IngredientSheet';
import { AddIngredientRow } from '../../components/AddIngredientRow';
import { RecipeNotesSheet } from '../../components/RecipeNotesSheet';
import { ServesSheet } from '../../components/ServesSheet';
import { useRecipes } from '../../hooks/useRecipes';
import { useProducts } from '../../hooks/useProducts';
import { useRecipeIngredients } from '../../hooks/useRecipeIngredients';
import { rollupMacros } from '../../lib/rollupMacros';
import { formatAmount } from '../../lib/amount';
import { formatCookTime } from '../../lib/format';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../constants/tokens';
import * as Haptics from 'expo-haptics';
import type { ProductRow } from '../../types/db';
import type { ProductInput } from '../../hooks/useProducts';
import type { Ingredient } from '../../meal_plan.types';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipes, updateNotes, updateServings } = useRecipes();
  const recipe = recipes.find((r) => r.id === id) ?? null;
  const { upsert, getNutritionForIngredients } = useProducts();
  const { updateIngredient, addIngredient, deleteIngredient } = useRecipeIngredients();

  type SheetState =
    | { mode: 'edit'; index: number }
    | { mode: 'add' }
    | null;

  const [copied, setCopied] = useState(false);
  const [links, setLinks] = useState<Record<number, ProductRow>>({});
  const [sheet, setSheet] = useState<SheetState>(null);
  const [notesSheetVisible, setNotesSheetVisible] = useState(false);
  const [servesSheetVisible, setServesSheetVisible] = useState(false);

  useEffect(() => {
    if (!recipe) { setLinks({}); return; }
    getNutritionForIngredients(recipe.ingredients).then(setLinks);
  }, [recipe?.id, recipe?.ingredients, getNutritionForIngredients]);

  if (!recipe) {
    return (
      <View style={styles.notFound}>
        <AppText weight="semibold" color="textSecondary">Recipe not found.</AppText>
      </View>
    );
  }

  const timeLabel = formatCookTime(recipe.prep_minutes, recipe.cook_minutes);
  const rollup = rollupMacros(recipe.ingredients, links, recipe.servings);
  const prefix = rollup?.isPartial ? '~' : '';

  const editingIngredient =
    sheet?.mode === 'edit' ? recipe.ingredients[sheet.index] ?? null : null;
  const existingEntry =
    sheet?.mode === 'edit' ? (links[sheet.index] ?? null) : null;

  async function handleSheetSave({
    ingredient,
    nutrition,
  }: {
    ingredient: Ingredient;
    nutrition: ProductInput | null;
  }) {
    if (!sheet) return;
    let nextIngredient: Ingredient = ingredient;
    if (nutrition) {
      const productId = await upsert(nutrition);
      nextIngredient = { ...ingredient, product_id: productId };
    }
    if (sheet.mode === 'edit') {
      await updateIngredient(recipe!.id, sheet.index, nextIngredient);
    } else {
      await addIngredient(recipe!.id, nextIngredient);
    }
    setSheet(null);
  }

  async function handleSheetDelete() {
    if (sheet?.mode !== 'edit') return;
    await deleteIngredient(recipe!.id, sheet.index);
    setSheet(null);
  }

  async function handleNotesSave(nextNotes: string | null) {
    if (!recipe) return;
    await updateNotes(recipe.id, nextNotes);
  }

  function openNotesSheet() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNotesSheetVisible(true);
  }

  function openServesSheet() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setServesSheetVisible(true);
  }

  async function handleServesSave(nextServings: number) {
    if (!recipe) return;
    await updateServings(recipe.id, nextServings);
    setServesSheetVisible(false);
  }

  const handleCopy = async () => {
    const macroStr = rollup
      ? `Serves ${recipe.servings} | ${prefix}${Math.round(rollup.perServe.cal)} kcal | P ${prefix}${Math.round(rollup.perServe.protein_g)}g | C ${prefix}${Math.round(rollup.perServe.carbs_g)}g | F ${prefix}${Math.round(rollup.perServe.fat_g)}g | ${recipe.cook_method} | ${timeLabel}`
      : `Serves ${recipe.servings} | ${recipe.calories_per_serve} kcal | P ${recipe.protein_per_serve_g}g | ${recipe.cook_method} | ${timeLabel}`;

    const trimmedNotes = recipe.notes?.trim();
    const notesBlock = trimmedNotes ? `\n\nNotes:\n${trimmedNotes}` : '';

    const text = [
      recipe.title,
      macroStr,
      '',
      'Ingredients:',
      ...recipe.ingredients.map((i, idx) => {
        const line = `- ${formatAmount(i.amount)} ${i.item}`;
        // Contributions are whole-recipe totals for that ingredient, matching
        // the chips on IngredientRow. Unlinked ingredients have none.
        const c = rollup?.contributions[idx];
        if (!c) return line;
        return `${line} | ${Math.round(c.cal)} kcal | P ${Math.round(c.protein_g)}g | C ${Math.round(c.carbs_g)}g | F ${Math.round(c.fat_g)}g`;
      }),
      '',
      'Method:',
      ...recipe.method_steps.map((s, idx) => `${idx + 1}. ${s}`),
    ].join('\n') + notesBlock;

    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={styles.container}>
      <GreenHeader>
        <View style={styles.headerContent}>
          <View style={styles.topRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Back to Recipes"
            >
              <AppText weight="bold" color="onGreenSubtle" size="sm">‹ Recipes</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openNotesSheet}
              style={styles.notesPill}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={recipe.notes && recipe.notes.trim() ? 'Edit notes' : 'Add notes'}
            >
              <AppText weight="bold" color="onGreen" size="xs">
                {recipe.notes && recipe.notes.trim() ? '✎ Note' : '+ Note'}
              </AppText>
            </TouchableOpacity>
          </View>
          <AppText weight="extrabold" color="onGreen" size="2xl" numberOfLines={2}>
            {recipe.title}
          </AppText>
          <View style={styles.pillRow}>
            {rollup ? (
              <>
                <View style={styles.pill}>
                  <AppText weight="bold" size="2xs" color="onGreen">
                    {prefix}{Math.round(rollup.perServe.cal)} kcal
                  </AppText>
                </View>
                <View style={styles.pill}>
                  <AppText weight="bold" size="2xs" color="onGreen">
                    P {prefix}{Math.round(rollup.perServe.protein_g)}g
                  </AppText>
                </View>
                <View style={styles.pill}>
                  <AppText weight="bold" size="2xs" color="onGreen">
                    C {prefix}{Math.round(rollup.perServe.carbs_g)}g
                  </AppText>
                </View>
                <View style={styles.pill}>
                  <AppText weight="bold" size="2xs" color="onGreen">
                    F {prefix}{Math.round(rollup.perServe.fat_g)}g
                  </AppText>
                </View>
              </>
            ) : (
              <>
                <View style={styles.pill}>
                  <AppText weight="bold" size="2xs" color="onGreen">
                    {recipe.calories_per_serve} kcal
                  </AppText>
                </View>
                <View style={styles.pill}>
                  <AppText weight="bold" size="2xs" color="onGreen">
                    P {recipe.protein_per_serve_g}g
                  </AppText>
                </View>
              </>
            )}
            <TouchableOpacity
              style={[styles.pill, styles.servesPill]}
              onPress={openServesSheet}
              activeOpacity={0.7}
              // The pill row is deliberately compact; extend the touch target
              // instead of the box so it stays aligned with its siblings.
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel={`Edit serves, currently ${recipe.servings}`}
            >
              <AppText weight="bold" size="2xs" color="onGreen">Serves {recipe.servings}</AppText>
              <Ionicons name="chevron-down" size={10} color={colors.onGreen} />
            </TouchableOpacity>
            <View style={styles.pill}>
              <AppText weight="bold" size="2xs" color="onGreen">{timeLabel}</AppText>
            </View>
          </View>
        </View>
      </GreenHeader>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.section}>
          <CategoryHeader label="Ingredients" isOneoff={false} />
          <View style={styles.card}>
            {recipe.ingredients.map((ing, idx) => (
              <IngredientRow
                key={idx}
                ingredient={ing}
                nutrition={rollup?.contributions[idx] ?? null}
                onPress={() => setSheet({ mode: 'edit', index: idx })}
              />
            ))}
            <AddIngredientRow onPress={() => setSheet({ mode: 'add' })} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.methodHeader}>
            <CategoryHeader label="Method" isOneoff={false} />
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleCopy(); }}
              style={styles.copyBtn}
              accessibilityRole="button"
              accessibilityLabel="Copy recipe to clipboard"
            >
              <View style={styles.copyBtnContent}>
                {!copied && <Ionicons name="clipboard-outline" size={12} color={colors.onGreen} />}
                <AppText weight="bold" color="onGreen" size="2xs">
                  {copied ? 'Copied!' : ' Copy recipe'}
                </AppText>
              </View>
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            <View style={styles.stepListWrapper}>
              <StepList steps={recipe.method_steps} />
            </View>
          </View>
        </View>

        {recipe.notes && recipe.notes.trim() && (
          <View style={styles.section}>
            <CategoryHeader label="Notes" isOneoff={false} />
            <TouchableOpacity
              style={styles.card}
              onPress={openNotesSheet}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Tap to edit notes"
            >
              <View style={styles.notesBody}>
                <AppText weight="regular" color="textPrimary" size="md">
                  {recipe.notes}
                </AppText>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <IngredientSheet
        visible={sheet !== null}
        mode={sheet?.mode ?? 'add'}
        initialIngredient={editingIngredient}
        existingEntry={existingEntry}
        onSave={handleSheetSave}
        onDelete={sheet?.mode === 'edit' ? handleSheetDelete : undefined}
        onClose={() => setSheet(null)}
      />

      <ServesSheet
        visible={servesSheetVisible}
        servings={recipe.servings}
        caloriesPerServe={rollup ? rollup.perServe.cal : recipe.calories_per_serve}
        isApproximate={rollup?.isPartial ?? false}
        onSave={handleServesSave}
        onClose={() => setServesSheetVisible(false)}
      />

      <RecipeNotesSheet
        visible={notesSheetVisible}
        recipeTitle={recipe.title}
        initialNotes={recipe.notes}
        onSave={handleNotesSave}
        onClose={() => setNotesSheetVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cream },
  headerContent: { paddingBottom: spacing[1], gap: spacing[2] },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    paddingVertical: spacing[4], paddingRight: spacing[4],
    alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center',
  },
  notesPill: {
    backgroundColor: colors.headerPill,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notesBody: {
    padding: spacing[4],
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  pill: {
    backgroundColor: colors.headerPill,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  servesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingRight: spacing[2],
  },
  body: { flex: 1 },
  bodyContent: { paddingTop: spacing[2], paddingBottom: spacing[10], gap: spacing[4] },
  section: { gap: spacing[2], paddingHorizontal: spacing[4] },
  card: { backgroundColor: colors.card, borderRadius: radius.md, overflow: 'hidden' },
  methodHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  copyBtn: {
    backgroundColor: colors.green,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.xl,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copyBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  stepListWrapper: { padding: spacing[4] },
});
