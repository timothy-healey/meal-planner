import type { Amount } from '../../meal_plan.types';
import { formatAmount } from '../amount';

export interface AggregatedAmount {
  qty: string;
  note: string | null;
}

/** Scaling a note is meaningless — "to taste" doesn't double. */
export function scaleAmount(a: Amount, factor: number): Amount {
  if (a.kind === 'note') return a;
  return { ...a, value: a.value * factor };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Sum a bucket's amounts into one displayable quantity.
 *
 * Amounts only combine within a compatible unit family. Anything left over
 * joins with " + " — "150 g + 2" for 150g of onion plus 2 onions. That reads
 * oddly, which is the point: it's visibly unresolved rather than silently wrong.
 *
 * Formatting goes through `formatAmount` so derived lines read like every other
 * quantity in the app.
 */
export function aggregateAmounts(amounts: Amount[]): AggregatedAmount {
  let grams = 0;
  let millilitres = 0;
  let counts = 0;
  const customs = new Map<string, { unit: string; value: number }>();
  const notes: string[] = [];

  for (const a of amounts) {
    if (a.kind === 'note') {
      if (a.text.trim()) notes.push(a.text.trim());
      continue;
    }
    if (a.kind === 'custom') {
      const key = a.unit.trim().toLowerCase();
      const entry = customs.get(key);
      // First spelling seen wins the label; later ones only add their value.
      if (entry) entry.value += a.value;
      else customs.set(key, { unit: a.unit.trim(), value: a.value });
      continue;
    }
    switch (a.unit) {
      case 'g':    grams += a.value; break;
      case 'kg':   grams += a.value * 1000; break;
      case 'mL':   millilitres += a.value; break;
      case 'L':    millilitres += a.value * 1000; break;
      case 'unit': counts += a.value; break;
    }
  }

  const parts: string[] = [];

  if (grams > 0) {
    parts.push(grams >= 1000
      ? formatAmount({ kind: 'measured', value: round2(grams / 1000), unit: 'kg' })
      : formatAmount({ kind: 'measured', value: round2(grams), unit: 'g' }));
  }
  if (millilitres > 0) {
    parts.push(millilitres >= 1000
      ? formatAmount({ kind: 'measured', value: round2(millilitres / 1000), unit: 'L' })
      : formatAmount({ kind: 'measured', value: round2(millilitres), unit: 'mL' }));
  }
  if (counts > 0) {
    parts.push(formatAmount({ kind: 'measured', value: round2(counts), unit: 'unit' }));
  }
  for (const key of [...customs.keys()].sort()) {
    const c = customs.get(key)!;
    parts.push(formatAmount({ kind: 'custom', value: round2(c.value), unit: c.unit }));
  }

  const joinedNotes = notes.join(', ');

  // Nothing summable: the note *is* the quantity.
  if (parts.length === 0) {
    return { qty: joinedNotes, note: null };
  }
  return { qty: parts.join(' + '), note: joinedNotes || null };
}
