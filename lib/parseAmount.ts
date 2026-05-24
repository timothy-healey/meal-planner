export type ParsedAmount =
  | { type: 'grams'; value: number }
  | { type: 'mL'; value: number }
  | { type: 'units'; value: number }
  | null;

function parseLeadingNumber(s: string): { value: number; rest: string } | null {
  // Mixed number: "1 1/2", "2 3/4"
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)(.*)/);
  if (mixed) {
    const den = parseInt(mixed[3]);
    if (den === 0) return null;
    return { value: parseInt(mixed[1]) + parseInt(mixed[2]) / den, rest: mixed[4].trim() };
  }

  // Simple fraction: "1/3", "2/3"
  const fraction = s.match(/^(\d+)\/(\d+)(.*)/);
  if (fraction) {
    const den = parseInt(fraction[2]);
    if (den === 0) return null;
    return { value: parseInt(fraction[1]) / den, rest: fraction[3].trim() };
  }

  // Decimal or integer: "1.5", "200"
  const decimal = s.match(/^([\d.]+)(.*)/);
  if (decimal) {
    const value = parseFloat(decimal[1]);
    if (isNaN(value)) return null;
    return { value, rest: decimal[2].trim() };
  }

  return null;
}

export function parseAmount(amount: string): ParsedAmount {
  const s = amount.trim().toLowerCase();
  if (!s) return null;

  const leading = parseLeadingNumber(s);
  if (!leading) return null;

  const { value, rest } = leading;
  const unit = rest.split(/\s/)[0];

  if (!unit) return { type: 'units', value };

  if (unit === 'kg') return { type: 'grams', value: value * 1000 };
  if (unit === 'g') return { type: 'grams', value };
  if (unit === 'oz') return { type: 'grams', value: value * 28.35 };
  if (unit === 'lb' || unit === 'lbs') return { type: 'grams', value: value * 453.6 };

  if (unit === 'l') return { type: 'mL', value: value * 1000 };
  if (unit === 'ml') return { type: 'mL', value };
  if (unit === 'cup' || unit === 'cups') return { type: 'mL', value: value * 240 };
  if (unit === 'tbsp') return { type: 'mL', value: value * 15 };
  if (unit === 'tsp') return { type: 'mL', value: value * 5 };

  // Anything else (e.g. "2 eggs", "3 cloves garlic") → unit count
  return { type: 'units', value };
}
