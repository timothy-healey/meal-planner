import { router } from "expo-router";
import { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BatchPlanBanner } from "../../components/BatchPlanBanner";
import { RecipeCard } from "../../components/RecipeCard";
import { CategoryHeader } from "../../components/ui/CategoryHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { RecipesSkeleton } from "../../components/ui/RecipesSkeleton";
import { colors, spacing } from "../../constants/tokens";
import { usePlan } from "../../hooks/usePlan";
import { useRecipes } from "../../hooks/useRecipes";
import { useInPlanRecipes } from "../../hooks/useInPlanRecipes";

// Dinner first — the batch-plan-led week. Snacks last because they're optional.
const MEAL_TYPE_ORDER = ["dinner", "lunch", "breakfast", "snack"];
const KNOWN_MEAL_TYPES = new Set(MEAL_TYPE_ORDER);

export default function RecipesScreen() {
  const insets = useSafeAreaInsets();
  const { plan, loading: planLoading } = usePlan();
  const { recipes, loading: recipesLoading } = useRecipes();
  const inPlanIds = useInPlanRecipes(plan);

  const { batchSteps, allGroups } = useMemo(() => {
    if (recipes.length === 0) return { batchSteps: [], allGroups: [] };

    const groups = MEAL_TYPE_ORDER.flatMap((mealType) => {
      const group = recipes.filter((r) => r.meal_type === mealType);
      return group.length > 0 ? [{ mealType, recipes: group }] : [];
    });
    const extraGroups = Object.entries(
      recipes
        .filter((r) => !KNOWN_MEAL_TYPES.has(r.meal_type))
        .reduce<Record<string, typeof recipes>>((acc, r) => {
          (acc[r.meal_type] = acc[r.meal_type] ?? []).push(r);
          return acc;
        }, {}),
    ).map(([mealType, recs]) => ({ mealType, recipes: recs }));

    return {
      batchSteps: plan?.batchSteps ?? [],
      allGroups: [...groups, ...extraGroups],
    };
  }, [plan, recipes]);

  if (planLoading || recipesLoading) {
    return (
      <View style={styles.outerContainer}>
        <RecipesSkeleton />
      </View>
    );
  }

  // The library is worth showing with no active plan — those recipes still
  // exist. Only a genuinely empty library gets the empty state.
  if (recipes.length === 0) {
    return (
      <View style={styles.outerContainer}>
        <View style={[styles.emptyContainer, { marginTop: insets.top }]}>
          <EmptyState onImport={() => router.push("/settings")} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.outerContainer}>
      <ScrollView
        style={[styles.container, { marginTop: insets.top }]}
        contentContainerStyle={styles.content}
      >
        {batchSteps.length > 0 && (
          <BatchPlanBanner
            steps={batchSteps}
            onPress={() => router.push("/batch-plan")}
          />
        )}

        {allGroups.map(({ mealType, recipes: groupRecipes }, groupIdx) => (
          <Animated.View
            key={mealType}
            entering={FadeIn.duration(180).delay(groupIdx * 40)}
            style={styles.group}
          >
            <CategoryHeader label={mealType} isOneoff={false} />
            <View style={styles.cards}>
              {groupRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  inPlan={inPlanIds.has(recipe.id)}
                  onPress={() => router.push(`/recipe/${recipe.id}`)}
                />
              ))}
            </View>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: colors.green },
  container: { flex: 1, backgroundColor: colors.cream },
  content: { paddingTop: spacing[2], paddingBottom: spacing[10] },
  emptyContainer: { flex: 1, backgroundColor: colors.cream },
  group: { marginTop: spacing[4], paddingHorizontal: spacing[4] },
  cards: { gap: spacing[3], paddingTop: spacing[2] },
});
