import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { GreenHeader } from '../../components/ui/GreenHeader';
import { AppText } from '../../components/ui/AppText';
import { CategoryHeader } from '../../components/ui/CategoryHeader';
import { StepList } from '../../components/ui/StepList';
import { IngredientRow } from '../../components/IngredientRow';
import { useRecipes } from '../../hooks/useRecipes';
import { formatCookTime } from '../../lib/format';
import { colors, spacing, radius } from '../../constants/tokens';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipes } = useRecipes();
  const recipe = recipes.find((r) => r.id === id) ?? null;
  const [copied, setCopied] = useState(false);

  if (!recipe) {
    return (
      <View style={styles.notFound}>
        <AppText weight="semibold" color="textSecondary">Recipe not found.</AppText>
      </View>
    );
  }

  const timeLabel = formatCookTime(recipe.prep_minutes, recipe.cook_minutes);
  const buildCopyText = () =>
    [
      recipe.title,
      `Serves ${recipe.servings} | ${recipe.calories_per_serve} cal | ${recipe.protein_per_serve_g}g protein | ${recipe.cook_method} | ${timeLabel}`,
      '',
      'Ingredients:',
      ...recipe.ingredients.map((i) => `- ${i.amount} ${i.item}`),
      '',
      'Method:',
      ...recipe.method_steps.map((s, idx) => `${idx + 1}. ${s}`),
    ].join('\n');

  const handleCopy = async () => {
    await Clipboard.setStringAsync(buildCopyText());
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
        </View>
      </GreenHeader>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.inlineStats}>
          <AppText weight="bold" color="orange" size="lg">{recipe.calories_per_serve} cal</AppText>
          <AppText weight="regular" color="textTertiary" size="lg"> · </AppText>
          <AppText weight="semibold" color="textSecondary" size="lg">{recipe.protein_per_serve_g}g protein</AppText>
          <AppText weight="regular" color="textTertiary" size="lg"> · </AppText>
          <AppText weight="semibold" color="textSecondary" size="lg">Serves {recipe.servings}</AppText>
          <AppText weight="regular" color="textTertiary" size="lg"> · </AppText>
          <AppText weight="regular" color="textTertiary" size="lg">{timeLabel}</AppText>
        </View>

        <View style={styles.section}>
          <CategoryHeader label="Ingredients" isOneoff={false} />
          <View style={styles.card}>
            {recipe.ingredients.map((ing, idx) => (
              <IngredientRow key={idx} ingredient={ing} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.methodHeader}>
            <CategoryHeader label="Method" isOneoff={false} />
            <TouchableOpacity
              onPress={handleCopy}
              style={styles.copyBtn}
              accessibilityRole="button"
              accessibilityLabel="Copy recipe to clipboard"
            >
              <AppText weight="bold" color="onGreen" size="2xs">
                {copied ? 'Copied!' : '📋 Copy recipe'}
              </AppText>
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            <View style={styles.stepListWrapper}>
              <StepList steps={recipe.method_steps} />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cream },
  headerContent: { paddingBottom: spacing[4], gap: spacing[2] },
  backBtn: { paddingVertical: spacing[4], paddingRight: spacing[4], alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  body: { flex: 1 },
  bodyContent: { paddingTop: spacing[2], paddingBottom: spacing[10], gap: spacing[4] },
  inlineStats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingHorizontal: spacing[4] },
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
  stepListWrapper: { padding: spacing[4] },
});
