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

  it('converts cups/tbsp/tsp to mL', () => {
    expect(parseAmount('1 cup')).toEqual({ type: 'mL', value: 240 });
    expect(parseAmount('2 cups')).toEqual({ type: 'mL', value: 480 });
    expect(parseAmount('1 tbsp')).toEqual({ type: 'mL', value: 15 });
    expect(parseAmount('2 tsp')).toEqual({ type: 'mL', value: 10 });
  });

  it('converts oz/lb to grams', () => {
    expect(parseAmount('1 oz')).toEqual({ type: 'grams', value: 28.35 });
    expect(parseAmount('1 lb')).toEqual({ type: 'grams', value: 453.6 });
    expect(parseAmount('2 lbs')).toEqual({ type: 'grams', value: 907.2 });
  });

  it('parses fractions', () => {
    expect(parseAmount('1/3 cup')).toEqual({ type: 'mL', value: 80 });
    expect(parseAmount('1/2 cup')).toEqual({ type: 'mL', value: 120 });
    expect(parseAmount('1 1/2 cups')).toEqual({ type: 'mL', value: 360 });
    expect(parseAmount('1/3')).toEqual({ type: 'units', value: 1 / 3 });
  });

  it('returns null for non-numeric strings', () => {
    expect(parseAmount('a handful')).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('to taste')).toBeNull();
  });
});
