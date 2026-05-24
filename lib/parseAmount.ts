export type ParsedAmount =
  | { type: 'grams'; value: number }
  | { type: 'mL'; value: number }
  | { type: 'units'; value: number }
  | null;

export function parseAmount(amount: string): ParsedAmount {
  const s = amount.trim().toLowerCase();
  if (!s) return null;

  const kgMatch = s.match(/^([\d.]+)\s*kg$/);
  if (kgMatch) return { type: 'grams', value: parseFloat(kgMatch[1]) * 1000 };

  const gMatch = s.match(/^([\d.]+)\s*g$/);
  if (gMatch) return { type: 'grams', value: parseFloat(gMatch[1]) };

  const lMatch = s.match(/^([\d.]+)\s*l$/);
  if (lMatch) return { type: 'mL', value: parseFloat(lMatch[1]) * 1000 };

  const mlMatch = s.match(/^([\d.]+)\s*ml$/);
  if (mlMatch) return { type: 'mL', value: parseFloat(mlMatch[1]) };

  // Return null for common cooking measurements we can't convert to grams/mL
  if (/^[\d.]+\s*(tsp|tbsp|cup|cups|oz|lb|lbs)\b/.test(s)) return null;

  // Leading number → unit count (e.g. "2 eggs", "3", "4 cloves garlic")
  const unitMatch = s.match(/^([\d.]+)/);
  if (unitMatch) return { type: 'units', value: parseFloat(unitMatch[1]) };

  return null;
}
