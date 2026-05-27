import type { MealPlan, Recipe, Ingredient, Amount } from '../../meal_plan.types';
import type { RecipeRow, WeeklyPlanRow, ShoppingItemRow } from '../../types/db';
import { parseAmountString } from '../amount';

interface TransformResult {
  weeklyPlan: WeeklyPlanRow;
  recipes: RecipeRow[];
  shoppingItems: ShoppingItemRow[];
}

// At the import boundary the incoming JSON may still be v1.1 with a string `amount`.
// Loosen the type here so callers can pass either shape; we narrow before storing.
type IngredientInput = { item: string; amount: string | Amount };
type RecipeInput = Omit<Recipe, 'ingredients'> & { ingredients: IngredientInput[] };
type MealPlanInput = Omit<MealPlan, 'recipes'> & { recipes: RecipeInput[] };

function coerceAmount(amount: string | Amount): Amount {
  return typeof amount === 'string' ? parseAmountString(amount) : amount;
}

function coerceIngredient(ing: IngredientInput): Ingredient {
  return { item: ing.item, amount: coerceAmount(ing.amount) };
}

export function transformPlan(plan: MealPlanInput): TransformResult {
  const now = new Date().toISOString();

  const weeklyPlan: WeeklyPlanRow = {
    id: plan.meta.week_starting,
    week_starting: plan.meta.week_starting,
    is_active: 1,
    meta_json: JSON.stringify(plan.meta),
    strategy_json: JSON.stringify(plan.strategy),
    days_json: JSON.stringify(plan.meal_plan),
    batch_plan_json: JSON.stringify(plan.sunday_batch_plan),
    created_at: now,
  };

  const recipes: RecipeRow[] = plan.recipes.map((r) => ({
    id: r.id,
    title: r.title,
    meal_type: r.meal_type,
    servings: r.servings,
    calories_per_serve: r.calories_per_serve,
    protein_per_serve_g: r.protein_per_serve_g,
    cook_method: r.cook_method,
    prep_minutes: r.prep_minutes,
    cook_minutes: r.cook_minutes,
    ingredients_json: JSON.stringify(r.ingredients.map(coerceIngredient)),
    method_steps_json: JSON.stringify(
      r.method_steps ?? (r.method ? [r.method] : [])
    ),
    is_favourite: 0,
    source: 'imported',
    created_at: now,
  }));

  const shoppingItems: ShoppingItemRow[] = plan.shopping_list.categories.flatMap(
    (cat, catIdx) =>
      cat.items.map((item, itemIdx) => ({
        id: `${plan.meta.week_starting}_${catIdx}_${itemIdx}`,
        plan_id: plan.meta.week_starting,
        category: cat.name,
        category_order: catIdx,
        item_order: itemIdx,
        name: item.item,
        qty: item.qty,
        estimated_price: item.price,
        is_oneoff: cat.is_oneoff ? 1 : 0,
        note: item.note || null,
        is_checked: 0,
      }))
  );

  return { weeklyPlan, recipes, shoppingItems };
}
