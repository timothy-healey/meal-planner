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
import { useRecipes } from '../../hooks/useRecipes';
import { useFoodNutrition } from '../../hooks/useFoodNutrition';
import { useRecipeIngredients } from '../../hooks/useRecipeIngredients';
import { rollupMacros } from '../../lib/rollupMacros';
import { formatAmount } from '../../lib/amount';
import { formatCookTime } from '../../lib/format';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../constants/tokens';
import * as Haptics from 'expo-haptics';
import type { FoodNutritionRow } from '../../types/db';
import type { FoodNutritionData } from '../../hooks/useFoodNutrition';
import type { Ingredient } from '../../meal_plan.types';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipes } = useRecipes();
  const recipe = recipes.find((r) => r.id === id) ?? null;
  const { upsert, linkIngredient, getLinksForRecipe } = useFoodNutrition();
  const { updateIngredient, addIngredient, deleteIngredient } = useRecipeIngredients();

  type SheetState =
    | { mode: 'edit'; index: number }
    | { mode: 'add' }
    | null;

  const [copied, setCopied] = useState(false);
  const [links, setLinks] = useState<Record<number, FoodNutritionRow>>({});
  const [sheet, setSheet] = useState<SheetState>(null);
  const [linksKey, setLinksKey] = useState(0);

  useEffect(() => {
    if (!recipe?.id) return;
    getLinksForRecipe(recipe.id).then(setLinks);
  }, [recipe?.id, linksKey, getLinksForRecipe]);

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
    foodNutritionId,
  }: {
    ingredient: Ingredient;
    nutrition: FoodNutritionData | null;
    foodNutritionId: string | null;
  }) {
    if (!sheet) return;

    if (sheet.mode === 'edit') {
      await updateIngredient(recipe!.id, sheet.index, ingredient);
      if (nutrition) {
        const existingId = foodNutritionId ?? links[sheet.index]?.id;
        const upsertedId = await upsert({ ...nutrition, id: existingId });
        await linkIngredient(recipe!.id, sheet.index, upsertedId);
      }
    } else {
      const newIndex = await addIngredient(recipe!.id, ingredient);
      if (nutrition) {
        const upsertedId = await upsert({ ...nutrition, id: foodNutritionId ?? undefined });
        await linkIngredient(recipe!.id, newIndex, upsertedId);
      }
    }
    setLinksKey(k => k + 1);
    setSheet(null);
  }

  async function handleSheetDelete() {
    if (sheet?.mode !== 'edit') return;
    await deleteIngredient(recipe!.id, sheet.index);
    setLinksKey(k => k + 1);
    setSheet(null);
  }

  const handleCopy = async () => {
    const text = [
      recipe.title,
      `Serves ${recipe.servings} | ${recipe.calories_per_serve} cal | ${recipe.protein_per_serve_g}g protein | ${recipe.cook_method} | ${timeLabel}`,
      '',
      'Ingredients:',
      ...recipe.ingredients.map((i) => `- ${formatAmount(i.amount)} ${i.item}`),
      '',
      'Method:',
      ...recipe.method_steps.map((s, idx) => `${idx + 1}. ${s}`),
    ].join('\n');
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={styles.container}>
      <GreenHeader>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back to Recipes"
          >
            <AppText weight="bold" color="onGreenSubtle" size="sm">‹ Recipes</AppText>
          </TouchableOpacity>
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
            <View style={styles.pill}>
              <AppText weight="bold" size="2xs" color="onGreen">Serves {recipe.servings}</AppText>
            </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cream },
  headerContent: { paddingBottom: spacing[1], gap: spacing[2] },
  backBtn: {
    paddingVertical: spacing[4], paddingRight: spacing[4],
    alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center',
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  pill: {
    backgroundColor: colors.headerPill,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
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
