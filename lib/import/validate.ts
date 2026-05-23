import type { MealPlan } from '../../meal_plan.types';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const REQUIRED_KEYS: (keyof MealPlan)[] = [
  'schema_version',
  'meta',
  'meal_plan',
  'recipes',
  'shopping_list',
  'sunday_batch_plan',
];

export function validatePlan(data: unknown): true {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new ValidationError('Plan must be a JSON object');
  }
  for (const key of REQUIRED_KEYS) {
    if (!(key in (data as object))) {
      throw new ValidationError(`Missing \`${key}\``);
    }
  }
  return true;
}
