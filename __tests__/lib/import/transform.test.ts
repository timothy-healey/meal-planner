import { transformPlan } from '../../../lib/import/transform';
import type { MealPlan } from '../../../meal_plan.types';

const PLAN: MealPlan = {
  schema_version: '1.1',
  meta: {
    title: 'Week 1',
    week_starting: '2026-05-24',
    currency: 'AUD',
    store: 'Woolworths',
    region: 'Adelaide',
    weekly_budget: 140,
    cooking_style: 'crockpot',
    dinners_per_batch: 2,
    notes: '',
  },
  daily_targets: [],
  strategy: { breakfast: '', lunch: '', dinner: '', snacks: '', weekend: '', drinks: '' },
  meal_plan: [],
  sunday_batch_plan: [{ time: '08:00', task: 'Prep veg' }],
  recipes: [
    {
      id: 'beef_stew',
      image_slug: 'beef_stew',
      title: 'Beef Stew',
      servings: 3,
      meal_type: 'dinner',
      protein_per_serve_g: 48,
      calories_per_serve: 650,
      cook_method: 'Crockpot',
      prep_minutes: 20,
      cook_minutes: 480,
      ingredients: [{ item: 'beef', amount: { kind: 'measured', value: 800, unit: 'g' } }],
      method_steps: ['Prep everything.', 'Cook everything.'],
    },
  ],
  assumed_pantry: [],
  shopping_list: {
    priced_at: '2026-05-24',
    categories: [
      {
        name: 'Meat & Seafood',
        is_oneoff: false,
        items: [{ item: 'Beef chuck', qty: '800g', price: 14, note: '' }],
      },
    ],
  },
  store_choice: { store: 'Woolworths', reason: '', tip: '' },
};

describe('transformPlan', () => {
  it('produces a weeklyPlan row with correct id and is_active', () => {
    const { weeklyPlan } = transformPlan(PLAN);
    expect(weeklyPlan.id).toBe('2026-05-24');
    expect(weeklyPlan.week_starting).toBe('2026-05-24');
    expect(weeklyPlan.is_active).toBe(1);
  });

  it('serialises batch_plan_json as JSON array', () => {
    const { weeklyPlan } = transformPlan(PLAN);
    const parsed = JSON.parse(weeklyPlan.batch_plan_json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].task).toBe('Prep veg');
  });

  it('produces a recipe row with method_steps_json', () => {
    const { recipes } = transformPlan(PLAN);
    expect(recipes).toHaveLength(1);
    expect(recipes[0].id).toBe('beef_stew');
    const steps = JSON.parse(recipes[0].method_steps_json);
    expect(Array.isArray(steps)).toBe(true);
  });

  it('produces shopping item rows with correct category_order and item_order', () => {
    const { shoppingItems } = transformPlan(PLAN);
    expect(shoppingItems).toHaveLength(1);
    expect(shoppingItems[0].name).toBe('Beef chuck');
    expect(shoppingItems[0].category).toBe('Meat & Seafood');
    expect(shoppingItems[0].category_order).toBe(0);
    expect(shoppingItems[0].item_order).toBe(0);
    expect(shoppingItems[0].is_oneoff).toBe(0);
  });

  it('generates stable unique ids for shopping items', () => {
    const { shoppingItems } = transformPlan(PLAN);
    expect(typeof shoppingItems[0].id).toBe('string');
    expect(shoppingItems[0].id.length).toBeGreaterThan(0);
  });

  it('coerces v1.1 string amounts to structured Amount on import', () => {
    const plan: any = {
      ...PLAN,
      recipes: [{
        ...PLAN.recipes[0],
        ingredients: [
          { item: 'beef', amount: '800g' },
          { item: 'oat milk', amount: '250mL' },
          { item: 'garlic', amount: '3 cloves' },
          { item: 'salt', amount: 'to taste' },
        ],
      }],
    };
    const { recipes } = transformPlan(plan);
    const ings = JSON.parse(recipes[0].ingredients_json);
    expect(ings[0].amount).toEqual({ kind: 'measured', value: 800, unit: 'g' });
    expect(ings[1].amount).toEqual({ kind: 'measured', value: 250, unit: 'mL' });
    expect(ings[2].amount).toEqual({ kind: 'custom', value: 3, unit: 'cloves' });
    expect(ings[3].amount).toEqual({ kind: 'note', text: 'to taste' });
  });

  it('passes v1.2 object amounts through unchanged', () => {
    const plan: any = {
      ...PLAN,
      recipes: [{
        ...PLAN.recipes[0],
        ingredients: [
          { item: 'beef', amount: { kind: 'measured', value: 800, unit: 'g' } },
        ],
      }],
    };
    const { recipes } = transformPlan(plan);
    const ings = JSON.parse(recipes[0].ingredients_json);
    expect(ings[0].amount).toEqual({ kind: 'measured', value: 800, unit: 'g' });
  });

  it('preserves product_id on ingredients when present in the input', () => {
    const plan: any = {
      ...PLAN,
      recipes: [{
        ...PLAN.recipes[0],
        ingredients: [
          { item: 'beef', amount: { kind: 'measured', value: 800, unit: 'g' }, product_id: 'prod-123' },
          { item: 'salt', amount: { kind: 'measured', value: 5, unit: 'g' } },
        ],
      }],
    };
    const { recipes } = transformPlan(plan);
    const ings = JSON.parse(recipes[0].ingredients_json);
    expect(ings[0].product_id).toBe('prod-123');
    expect(ings[1].product_id).toBeUndefined();
  });
});
