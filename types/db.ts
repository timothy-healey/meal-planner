/**
 * `weekly_plans.source` and `recipes.source` share a column name but not a
 * vocabulary — 'imported' means the same in both while the second value
 * differs. Named unions so a crossed literal is a type error rather than a
 * string that happens to parse.
 */
export type PlanSource = 'imported' | 'self_built';
export type RecipeSource = 'imported' | 'user';

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
  source: RecipeSource;
  notes: string | null;
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
  source: PlanSource;
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
  /** NULL means hand-added — the projection never touches it. */
  item_key: string | null;
  /** What the plan's recipes currently call for; see item_key. */
  planned_qty: string | null;
}

export interface PlanRecipeRow {
  id: string;
  plan_id: string;
  recipe_id: string;
  target_serves: number;
  sort_order: number;
}

export interface ItemCategoryMapRow {
  item_key: string;
  category: string;
  updated_at: string;
}

export type QtyUnit = 'g' | 'kg' | 'mL' | 'L' | 'units';

export interface PurchaseHistoryRow {
  id: string;
  plan_id: string | null;
  item_name: string;
  store_id: string | null;
  product_id: string | null;
  qty_amount: number | null;
  qty_unit: QtyUnit | null;
  price: number | null;
  is_sale: 0 | 1;
  barcode: string | null;
  purchased_at: string;
  status: 'pending' | 'confirmed';
}

export interface PurchaseHistoryRowWithProduct extends PurchaseHistoryRow {
  brand: string | null;
  product_name: string | null;
}

export interface PricePoint {
  chain: string;
  purchasedAt: string;
  normalisedPrice: number;
  isOnSale: boolean;
}

export interface ProductPricePoint extends PricePoint {
  productId: string;
  brand: string;
  productName: string;
}

export interface StoreRow {
  id: string;
  chain: string;
  branch: string;
  created_at: string;
}

export interface ProductRow {
  id: string;
  brand: string;
  product_name: string;
  item_name: string;
  basis: 'per_100g' | 'per_100mL' | 'per_unit';
  cal_per_basis: number | null;
  protein_per_basis: number | null;
  carbs_per_basis: number | null;
  fat_per_basis: number | null;
  updated_at: string;
}
