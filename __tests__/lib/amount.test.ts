import {
  parseAmountString,
  formatAmount,
  amountToBasis,
  amountMultiplier,
} from '../../lib/amount';

describe('parseAmountString', () => {
  it('parses grams', () => {
    expect(parseAmountString('200g')).toEqual({ kind: 'measured', value: 200, unit: 'g' });
    expect(parseAmountString('200 g')).toEqual({ kind: 'measured', value: 200, unit: 'g' });
    expect(parseAmountString('1.5g')).toEqual({ kind: 'measured', value: 1.5, unit: 'g' });
  });

  it('parses kg and L verbatim (no conversion)', () => {
    expect(parseAmountString('1.5kg')).toEqual({ kind: 'measured', value: 1.5, unit: 'kg' });
    expect(parseAmountString('1 L')).toEqual({ kind: 'measured', value: 1, unit: 'L' });
  });

  it('parses mL', () => {
    expect(parseAmountString('250mL')).toEqual({ kind: 'measured', value: 250, unit: 'mL' });
    expect(parseAmountString('250 ml')).toEqual({ kind: 'measured', value: 250, unit: 'mL' });
  });

  it('converts oz/lb to grams (legacy import only)', () => {
    expect(parseAmountString('1 oz')).toEqual({ kind: 'measured', value: 28.35, unit: 'g' });
    expect(parseAmountString('1 lb')).toEqual({ kind: 'measured', value: 453.6, unit: 'g' });
    expect(parseAmountString('2 lbs')).toEqual({ kind: 'measured', value: 907.2, unit: 'g' });
  });

  it('converts cup/tbsp/tsp to mL (legacy import only)', () => {
    expect(parseAmountString('1 cup')).toEqual({ kind: 'measured', value: 240, unit: 'mL' });
    expect(parseAmountString('1 tbsp')).toEqual({ kind: 'measured', value: 15, unit: 'mL' });
    expect(parseAmountString('2 tsp')).toEqual({ kind: 'measured', value: 10, unit: 'mL' });
  });

  it('parses fractions and mixed numbers', () => {
    expect(parseAmountString('1/2 cup')).toEqual({ kind: 'measured', value: 120, unit: 'mL' });
    expect(parseAmountString('1 1/2 cups')).toEqual({ kind: 'measured', value: 360, unit: 'mL' });
  });

  it('treats numeric-only as measured unit', () => {
    expect(parseAmountString('3')).toEqual({ kind: 'measured', value: 3, unit: 'unit' });
  });

  it('treats number + unknown words as custom', () => {
    expect(parseAmountString('3 cloves garlic')).toEqual({ kind: 'custom', value: 3, unit: 'cloves garlic' });
    expect(parseAmountString('2 slices')).toEqual({ kind: 'custom', value: 2, unit: 'slices' });
  });

  it('treats non-numeric strings as notes', () => {
    expect(parseAmountString('to taste')).toEqual({ kind: 'note', text: 'to taste' });
    expect(parseAmountString('a pinch')).toEqual({ kind: 'note', text: 'a pinch' });
    expect(parseAmountString('')).toEqual({ kind: 'note', text: '' });
  });
});

describe('formatAmount', () => {
  it('formats measured with unit', () => {
    expect(formatAmount({ kind: 'measured', value: 200, unit: 'g' })).toBe('200 g');
    expect(formatAmount({ kind: 'measured', value: 1.5, unit: 'kg' })).toBe('1.5 kg');
  });

  it('formats measured "unit" without a unit suffix', () => {
    expect(formatAmount({ kind: 'measured', value: 2, unit: 'unit' })).toBe('2');
  });

  it('formats custom with the freeform unit', () => {
    expect(formatAmount({ kind: 'custom', value: 3, unit: 'cloves' })).toBe('3 cloves');
  });

  it('formats note as the bare text', () => {
    expect(formatAmount({ kind: 'note', text: 'to taste' })).toBe('to taste');
  });

  it('drops trailing zeros from decimals', () => {
    expect(formatAmount({ kind: 'measured', value: 1.5, unit: 'kg' })).toBe('1.5 kg');
    expect(formatAmount({ kind: 'measured', value: 28.35, unit: 'g' })).toBe('28.35 g');
  });
});

describe('amountToBasis', () => {
  it('maps weight units to per_100g', () => {
    expect(amountToBasis({ kind: 'measured', value: 200, unit: 'g' })).toBe('per_100g');
    expect(amountToBasis({ kind: 'measured', value: 1, unit: 'kg' })).toBe('per_100g');
  });

  it('maps volume units to per_100mL', () => {
    expect(amountToBasis({ kind: 'measured', value: 250, unit: 'mL' })).toBe('per_100mL');
    expect(amountToBasis({ kind: 'measured', value: 1, unit: 'L' })).toBe('per_100mL');
  });

  it('maps count, custom, and note to per_unit', () => {
    expect(amountToBasis({ kind: 'measured', value: 3, unit: 'unit' })).toBe('per_unit');
    expect(amountToBasis({ kind: 'custom', value: 3, unit: 'cloves' })).toBe('per_unit');
    expect(amountToBasis({ kind: 'note', text: 'to taste' })).toBe('per_unit');
  });
});

describe('amountMultiplier', () => {
  it('per_100g: g / 100', () => {
    expect(amountMultiplier({ kind: 'measured', value: 200, unit: 'g' }, 'per_100g')).toBe(2);
  });

  it('per_100g: kg * 1000 / 100', () => {
    expect(amountMultiplier({ kind: 'measured', value: 1.5, unit: 'kg' }, 'per_100g')).toBe(15);
  });

  it('per_100mL: mL / 100', () => {
    expect(amountMultiplier({ kind: 'measured', value: 250, unit: 'mL' }, 'per_100mL')).toBe(2.5);
  });

  it('per_100mL: L * 1000 / 100', () => {
    expect(amountMultiplier({ kind: 'measured', value: 1, unit: 'L' }, 'per_100mL')).toBe(10);
  });

  it('per_unit: value for measured unit', () => {
    expect(amountMultiplier({ kind: 'measured', value: 2, unit: 'unit' }, 'per_unit')).toBe(2);
  });

  it('per_unit: value for custom (the unit string is display-only)', () => {
    expect(amountMultiplier({ kind: 'custom', value: 3, unit: 'cloves' }, 'per_unit')).toBe(3);
  });

  it('returns 0 on basis-unit mismatch', () => {
    expect(amountMultiplier({ kind: 'measured', value: 50, unit: 'mL' }, 'per_100g')).toBe(0);
    expect(amountMultiplier({ kind: 'measured', value: 200, unit: 'g' }, 'per_100mL')).toBe(0);
    expect(amountMultiplier({ kind: 'custom', value: 3, unit: 'cloves' }, 'per_100g')).toBe(0);
  });

  it('returns 0 for note', () => {
    expect(amountMultiplier({ kind: 'note', text: 'to taste' }, 'per_100g')).toBe(0);
    expect(amountMultiplier({ kind: 'note', text: 'to taste' }, 'per_unit')).toBe(0);
  });
});
