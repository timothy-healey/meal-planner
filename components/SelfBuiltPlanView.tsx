import React, { useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GreenHeader } from './ui/GreenHeader';
import { AppText } from './ui/AppText';
import { Row } from './ui/Row';
import { PlanRecipeList, type PlanRecipeEntryView } from './PlanRecipeList';
import { RecipePickerSheet, type PickableRecipe } from './RecipePickerSheet';
import { usePlanRecipes } from '../hooks/usePlanRecipes';
import { useRecipes } from '../hooks/useRecipes';
import { useShoppingItems } from '../hooks/useShoppingItems';
import { colors, spacing } from '../constants/tokens';

interface Props {
  planId: string;
}

export function SelfBuiltPlanView({ planId }: Props) {
  const insets = useSafeAreaInsets();
  const { rows, addRecipe, setServes, removeRecipe } = usePlanRecipes(planId);
  const { recipes } = useRecipes();
  const { items } = useShoppingItems(planId);
  const [pickerVisible, setPickerVisible] = useState(false);

  const entries = useMemo<PlanRecipeEntryView[]>(() => {
    const byId = new Map(recipes.map((r) => [r.id, r]));
    return rows.map((pr) => {
      const recipe = byId.get(pr.recipe_id);
      return {
        recipeId: pr.recipe_id,
        // FKs are not enforced, so the recipe may be gone.
        title: recipe?.title ?? 'Deleted recipe',
        recipeServings: recipe?.servings ?? null,
        targetServes: pr.target_serves,
      };
    });
  }, [rows, recipes]);

  const totalServes = entries.reduce((sum, e) => sum + e.targetServes, 0);

  const pickable = useMemo<PickableRecipe[]>(
    () => recipes.map((r) => ({
      id: r.id, title: r.title, meal_type: r.meal_type, servings: r.servings,
    })),
    [recipes],
  );

  return (
    <View style={styles.container}>
      <GreenHeader>
        <View style={{ gap: spacing[1] }}>
          <AppText weight="bold" size="xs" color="onGreenSubtle">MY PLAN</AppText>
          <AppText weight="extrabold" size="2xl" color="onGreen">This week</AppText>
        </View>
      </GreenHeader>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, { paddingBottom: insets.bottom + spacing[10] }]}
      >
        <PlanRecipeList
          entries={entries}
          onSetServes={setServes}
          onRemove={removeRecipe}
          onAdd={() => setPickerVisible(true)}
        />

        <Row gap={2} justify="center">
          <AppText weight="semibold" size="sm" color="textTertiary">
            {`${totalServes} serve${totalServes === 1 ? '' : 's'} · ${items.length} shopping line${items.length === 1 ? '' : 's'}`}
          </AppText>
        </Row>
      </ScrollView>

      <RecipePickerSheet
        visible={pickerVisible}
        recipes={pickable}
        alreadyInPlan={rows.map((r) => r.recipe_id)}
        onPick={(recipeId, defaultServes) => {
          addRecipe(recipeId, defaultServes);
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  body: { flex: 1 },
  bodyContent: { paddingTop: spacing[3], gap: spacing[4] },
});
