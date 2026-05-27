import type { Amount, Unit } from '../meal_plan.types';

type Basis = 'per_100g' | 'per_100mL' | 'per_unit';

function parseLeadingNumber(s: string): { value: number; rest: string } | null {
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)(.*)/);
  if (mixed) {
    const den = parseInt(mixed[3]);
    if (den === 0) return null;
    return { value: parseInt(mixed[1]) + parseInt(mixed[2]) / den, rest: mixed[4].trim() };
  }
  const fraction = s.match(/^(\d+)\/(\d+)(.*)/);
  if (fraction) {
    const den = parseInt(fraction[2]);
    if (den === 0) return null;
    return { value: parseInt(fraction[1]) / den, rest: fraction[3].trim() };
  }
  const decimal = s.match(/^([\d.]+)(.*)/);
  if (decimal) {
    const value = parseFloat(decimal[1]);
    if (isNaN(value)) return null;
    return { value, rest: decimal[2].trim() };
  }
  return null;
}

export function parseAmountString(input: string): Amount {
  const trimmed = input.trim();
  if (!trimmed) return { kind: 'note', text: input };

  const leading = parseLeadingNumber(trimmed.toLowerCase());
  if (!leading) return { kind: 'note', text: input };

  const { value, rest } = leading;
  if (!rest) return { kind: 'measured', value, unit: 'unit' };

  const unit = rest.split(/\s/)[0];

  if (unit === 'g')  return { kind: 'measured', value, unit: 'g' };
  if (unit === 'kg') return { kind: 'measured', value, unit: 'kg' };
  if (unit === 'oz') return { kind: 'measured', value: round2(value * 28.35), unit: 'g' };
  if (unit === 'lb' || unit === 'lbs') return { kind: 'measured', value: round2(value * 453.6), unit: 'g' };

  if (unit === 'ml') return { kind: 'measured', value, unit: 'mL' };
  if (unit === 'l')  return { kind: 'measured', value, unit: 'L' };
  if (unit === 'cup' || unit === 'cups') return { kind: 'measured', value: value * 240, unit: 'mL' };
  if (unit === 'tbsp') return { kind: 'measured', value: value * 15, unit: 'mL' };
  if (unit === 'tsp')  return { kind: 'measured', value: value * 5,  unit: 'mL' };

  // Number + unknown word(s) → custom
  return { kind: 'custom', value, unit: rest };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatAmount(amount: Amount): string {
  if (amount.kind === 'note') return amount.text;
  const value = formatValue(amount.value);
  if (amount.kind === 'measured' && amount.unit === 'unit') return value;
  return `${value} ${amount.unit}`;
}

function formatValue(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return String(Number(v.toFixed(2)));
}

export function amountToBasis(amount: Amount): Basis {
  if (amount.kind === 'measured') {
    if (amount.unit === 'g' || amount.unit === 'kg') return 'per_100g';
    if (amount.unit === 'mL' || amount.unit === 'L') return 'per_100mL';
  }
  return 'per_unit';
}

export function amountMultiplier(amount: Amount, basis: Basis): number {
  if (amount.kind === 'note') return 0;
  if (amount.kind === 'custom') {
    return basis === 'per_unit' ? amount.value : 0;
  }
  // measured
  if (basis === 'per_100g') {
    if (amount.unit === 'g')  return amount.value / 100;
    if (amount.unit === 'kg') return (amount.value * 1000) / 100;
    return 0;
  }
  if (basis === 'per_100mL') {
    if (amount.unit === 'mL') return amount.value / 100;
    if (amount.unit === 'L')  return (amount.value * 1000) / 100;
    return 0;
  }
  // per_unit
  return amount.unit === 'unit' ? amount.value : 0;
}

export type { Amount, Unit };
