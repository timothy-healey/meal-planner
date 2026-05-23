import type { MealPlan, Recipe } from '../../meal_plan.types';
import type { RecipeRow, WeeklyPlanRow, ShoppingItemRow } from '../../types/db';

interface TransformResult {
  weeklyPlan: WeeklyPlanRow;
  recipes: RecipeRow[];
  shoppingItems: ShoppingItemRow[];
}

export function transformPlan(plan: MealPlan): TransformResult {
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

  const recipes: RecipeRow[] = plan.recipes.map((r: Recipe) => ({
    id: r.id,
    title: r.title,
    meal_type: r.meal_type,
    servings: r.servings,
    calories_per_serve: r.calories_per_serve,
    protein_per_serve_g: r.protein_per_serve_g,
    cook_method: r.cook_method,
    prep_minutes: r.prep_minutes,
    cook_minutes: r.cook_minutes,
    ingredients_json: JSON.stringify(r.ingredients),
    method_steps_json: JSON.stringify(
      (r as any).method_steps ?? (r.method ? [r.method] : [])
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
        actual_price: null,
        store: null,
      }))
  );

  return { weeklyPlan, recipes, shoppingItems };
}
