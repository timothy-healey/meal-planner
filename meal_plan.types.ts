// Auto-generated types for meal_plan.json (schema v1.0)
// Use: import type { MealPlan } from './meal_plan.types';

export interface MealPlan {
  schema_version: string;
  meta: Meta;
  daily_targets: DailyTarget[];
  strategy: Strategy;
  meal_plan: DayPlan[];
  sunday_batch_plan: BatchStep[];
  recipes: Recipe[];
  assumed_pantry: PantryStaple[];
  shopping_list: ShoppingList;
  store_choice: StoreChoice;
}

export interface Meta {
  title: string;
  week_starting: string; // ISO date "YYYY-MM-DD"
  currency: string;
  store: string;
  region: string;
  weekly_budget: number;
  cooking_style: string;
  dinners_per_batch: number;
  notes: string;
}

export interface DailyTarget {
  day: Day;
  calories: number;
  protein_g: number;
  note: string;
}

export interface Strategy {
  breakfast: string;
  lunch: string;
  dinner: string;
  snacks: string;
  weekend: string;
  drinks: string;
}

export interface DayPlan {
  day: Day;
  calories: number;
  protein_g: number;
  meals: {
    breakfast: Meal;
    lunch: Meal;
    dinner: Meal;
    snacks: SnackMeal;
  };
}

export interface Meal {
  name: string;
  calories: number;
  protein_g: number;
  serving_size: string;
  components?: string[];
  batch_ref?: RecipeId;     // Links to recipes[].id for batch-cooked meals
  portion?: number;         // Which portion (1, 2, or 3) of the batch
  flexible?: boolean;       // True for "eat out OR..." meals
}

export interface SnackMeal {
  items: string[];
  calories: number;
  protein_g: number;
}

export interface BatchStep {
  time: string;   // "HH:MM"
  task: string;
}

export interface Recipe {
  id: RecipeId;
  image_slug: string;             // Stable slug for asset folder lookup
  title: string;
  servings: number;
  meal_type: 'breakfast' | 'lunch' | 'dinner';
  protein_per_serve_g: number;
  calories_per_serve: number;
  cook_method: string;
  prep_minutes: number;
  cook_minutes: number;
  ingredients: Ingredient[];
  method: string;
}

export interface Ingredient {
  item: string;
  amount: string;
}

export interface PantryStaple {
  item: string;
  note: string;
}

export interface ShoppingList {
  priced_at: string;              // ISO date "YYYY-MM-DD"
  categories: ShoppingCategory[];
}

export interface ShoppingCategory {
  name: string;
  is_oneoff?: boolean;            // True for pantry one-offs that last weeks/months
  items: ShoppingItem[];
}

export interface ShoppingItem {
  item: string;
  qty: string;
  price: number;
  note: string;
}

export interface StoreChoice {
  store: string;
  reason: string;
  tip: string;
}

// Discriminated unions for safer code
export type Day =
  | 'Sunday'
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday';

export type RecipeId =
  | 'beef_stew'
  | 'honey_soy_chicken'
  | 'beef_burrito'
  | 'chicken_caesar_wrap'
  | 'overnight_oats';

// Helper: compute weekly totals from the plan
export function computeTotals(plan: MealPlan) {
  let recurring = 0;
  let oneoff = 0;
  for (const cat of plan.shopping_list.categories) {
    const subtotal = cat.items.reduce((sum, i) => sum + i.price, 0);
    if (cat.is_oneoff) oneoff += subtotal;
    else recurring += subtotal;
  }
  return {
    recurring,
    oneoff,
    week_one: recurring + oneoff,
    variance_vs_budget: plan.meta.weekly_budget - recurring,
  };
}
