import { validatePlan, ValidationError } from '../../../lib/import/validate';
import type { MealPlan } from '../../../meal_plan.types';

const VALID: Partial<MealPlan> = {
  schema_version: '1.0',
  meta: { week_starting: '2026-05-24' } as any,
  meal_plan: [],
  recipes: [],
  shopping_list: { priced_at: '2026-05-24', categories: [] },
  sunday_batch_plan: [],
};

describe('validatePlan', () => {
  it('returns true for a valid plan', () => {
    expect(validatePlan(VALID)).toBe(true);
  });

  it('throws ValidationError for missing schema_version', () => {
    const bad = { ...VALID };
    delete (bad as any).schema_version;
    expect(() => validatePlan(bad)).toThrow(ValidationError);
    expect(() => validatePlan(bad)).toThrow('Missing `schema_version`');
  });

  it('throws for missing top-level keys', () => {
    (['meta', 'meal_plan', 'recipes', 'shopping_list', 'sunday_batch_plan'] as const)
      .forEach((key) => {
        const bad = { ...VALID };
        delete (bad as any)[key];
        expect(() => validatePlan(bad)).toThrow(ValidationError);
      });
  });

  it('throws for non-object input', () => {
    expect(() => validatePlan(null)).toThrow(ValidationError);
    expect(() => validatePlan('string')).toThrow(ValidationError);
  });
});
