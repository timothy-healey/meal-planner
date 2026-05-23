export interface RecipeRow {
  id: string;
  title: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  servings: number;
  calories_per_serve: number;
  protein_per_serve_g: number;
  cook_method: string;
  prep_minutes: number;
  cook_minutes: number;
  ingredients_json: string;
  method_steps_json: string;
  is_favourite: 0 | 1;
  source: 'imported' | 'user';
  created_at: string;
}

export interface WeeklyPlanRow {
  id: string;
  week_starting: string;
  is_active: 0 | 1;
  meta_json: string;
  strategy_json: string;
  days_json: string;
  batch_plan_json: string;
  created_at: string;
}

export interface ShoppingItemRow {
  id: string;
  plan_id: string;
  category: string;
  category_order: number;
  item_order: number;
  name: string;
  qty: string;
  estimated_price: number;
  is_oneoff: 0 | 1;
  note: string | null;
  is_checked: 0 | 1;
  actual_price: number | null;
  store: string | null;
}

export interface StoreRow {
  id: string;
  chain: string;
  branch: string;
  created_at: string;
}
