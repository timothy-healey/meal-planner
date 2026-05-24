import { parseAmount } from '../../lib/parseAmount';

describe('parseAmount', () => {
  it('parses grams', () => {
    expect(parseAmount('200g')).toEqual({ type: 'grams', value: 200 });
    expect(parseAmount('200 g')).toEqual({ type: 'grams', value: 200 });
    expect(parseAmount('1.5g')).toEqual({ type: 'grams', value: 1.5 });
  });

  it('parses kg to grams', () => {
    expect(parseAmount('1.5kg')).toEqual({ type: 'grams', value: 1500 });
    expect(parseAmount('1 kg')).toEqual({ type: 'grams', value: 1000 });
  });

  it('parses mL', () => {
    expect(parseAmount('250mL')).toEqual({ type: 'mL', value: 250 });
    expect(parseAmount('250 ml')).toEqual({ type: 'mL', value: 250 });
  });

  it('parses L to mL', () => {
    expect(parseAmount('1L')).toEqual({ type: 'mL', value: 1000 });
    expect(parseAmount('1.5 l')).toEqual({ type: 'mL', value: 1500 });
  });

  it('parses unit counts from leading number', () => {
    expect(parseAmount('2 eggs')).toEqual({ type: 'units', value: 2 });
    expect(parseAmount('3')).toEqual({ type: 'units', value: 3 });
    expect(parseAmount('4 cloves garlic')).toEqual({ type: 'units', value: 4 });
  });

  it('returns null for recognised-but-unsupported measurement units', () => {
    expect(parseAmount('1 tbsp')).toBeNull();
    expect(parseAmount('2 tsp')).toBeNull();
    expect(parseAmount('1 cup')).toBeNull();
    expect(parseAmount('2 cups')).toBeNull();
  });

  it('returns null for non-numeric strings', () => {
    expect(parseAmount('a handful')).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('to taste')).toBeNull();
  });
});
