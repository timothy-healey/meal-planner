import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { EmptyState } from '../../components/ui/EmptyState';
import { CategoryHeader } from '../../components/ui/CategoryHeader';
import { RecipeCard } from '../../components/RecipeCard';
import { BatchPlanBanner } from '../../components/BatchPlanBanner';
import { usePlan } from '../../hooks/usePlan';
import { useRecipes } from '../../hooks/useRecipes';
import { colors, spacing } from '../../constants/tokens';

const MEAL_TYPE_ORDER = ['dinner', 'lunch', 'breakfast', 'snack'];

export default function RecipesScreen() {
  const { plan } = usePlan();
  const { recipes } = useRecipes();

  if (!plan || recipes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <EmptyState onImport={() => router.push('/settings')} />
      </View>
    );
  }

  // plan.batchSteps is already a BatchStep[] — no JSON.parse needed
  const batchSteps = plan.batchSteps;

  // Group recipes by meal_type in display order
  const groups = MEAL_TYPE_ORDER.flatMap((mealType) => {
    const group = recipes.filter((r) => r.meal_type === mealType);
    return group.length > 0 ? [{ mealType, recipes: group }] : [];
  });
  // Append any unlisted meal types
  const knownTypes = new Set(MEAL_TYPE_ORDER);
  const extraGroups = Object.entries(
    recipes
      .filter((r) => !knownTypes.has(r.meal_type))
      .reduce<Record<string, typeof recipes>>((acc, r) => {
        (acc[r.meal_type] = acc[r.meal_type] ?? []).push(r);
        return acc;
      }, {})
  ).map(([mealType, recs]) => ({ mealType, recipes: recs }));

  const allGroups = [...groups, ...extraGroups];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {batchSteps.length > 0 && (
        <BatchPlanBanner
          steps={batchSteps}
          onPress={() => router.push('/batch-plan')}
        />
      )}

      {allGroups.map(({ mealType, recipes: groupRecipes }) => (
        <View key={mealType} style={styles.group}>
          <CategoryHeader label={mealType} isOneoff={false} />
          <View style={styles.cards}>
            {groupRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onPress={() => router.push(`/recipe/${recipe.id}`)}
              />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { paddingBottom: spacing[10] },
  emptyContainer: { flex: 1, backgroundColor: colors.cream },
  group: { marginTop: spacing[4] },
  cards: { gap: spacing[3], paddingHorizontal: spacing[4], paddingTop: spacing[2] },
});
