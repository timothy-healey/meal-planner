import { scaleAmount, aggregateAmounts } from '../../../lib/plan/aggregate';
import type { Amount } from '../../../meal_plan.types';

const g = (value: number): Amount => ({ kind: 'measured', value, unit: 'g' });
const kg = (value: number): Amount => ({ kind: 'measured', value, unit: 'kg' });
const mL = (value: number): Amount => ({ kind: 'measured', value, unit: 'mL' });
const unit = (value: number): Amount => ({ kind: 'measured', value, unit: 'unit' });
const custom = (value: number, u: string): Amount => ({ kind: 'custom', value, unit: u });
const note = (text: string): Amount => ({ kind: 'note', text });

describe('scaleAmount', () => {
  it('scales a measured value', () => {
    expect(scaleAmount(g(500), 1.5)).toEqual(g(750));
  });

  it('scales a custom value', () => {
    expect(scaleAmount(custom(2, 'cloves'), 3)).toEqual(custom(6, 'cloves'));
  });

  it('passes a note through unscaled — a note cannot be multiplied', () => {
    expect(scaleAmount(note('to taste'), 4)).toEqual(note('to taste'));
  });
});

describe('aggregateAmounts', () => {
  it('sums grams', () => {
    expect(aggregateAmounts([g(300), g(450)]).qty).toBe('750 g');
  });

  it('normalises kg into the gram total', () => {
    expect(aggregateAmounts([g(300), kg(1)]).qty).toBe('1.3 kg');
  });

  it('renders as kg once the total reaches 1000 g', () => {
    expect(aggregateAmounts([g(600), g(400)]).qty).toBe('1 kg');
  });

  it('sums millilitres and renders as L past 1000', () => {
    expect(aggregateAmounts([mL(750), mL(500)]).qty).toBe('1.25 L');
  });

  it('sums counts', () => {
    expect(aggregateAmounts([unit(2), unit(3)]).qty).toBe('5');
  });

  it('sums custom units only on an exact match', () => {
    expect(aggregateAmounts([custom(2, 'cloves'), custom(3, 'cloves')]).qty).toBe('5 cloves');
  });

  it('treats differing custom units as incompatible', () => {
    expect(aggregateAmounts([custom(2, 'cloves'), custom(1, 'bunch')]).qty)
      .toBe('1 bunch + 2 cloves');
  });

  it('joins incompatible families with " + " rather than guessing', () => {
    expect(aggregateAmounts([g(150), unit(2)]).qty).toBe('150 g + 2');
  });

  it('attaches notes to the note field, not as extra lines', () => {
    const result = aggregateAmounts([mL(30), note('to drizzle')]);
    expect(result.qty).toBe('30 mL');
    expect(result.note).toBe('to drizzle');
  });

  it('uses the note text as qty when there is nothing summable', () => {
    const result = aggregateAmounts([note('to taste')]);
    expect(result.qty).toBe('to taste');
    expect(result.note).toBeNull();
  });

  it('joins multiple notes', () => {
    expect(aggregateAmounts([note('to taste'), note('optional')]).qty)
      .toBe('to taste, optional');
  });

  it('rounds away floating-point noise from scaling', () => {
    expect(aggregateAmounts([scaleAmount(g(100), 1 / 3)]).qty).toBe('33.33 g');
  });

  it('returns an empty quantity for no amounts at all', () => {
    expect(aggregateAmounts([])).toEqual({ qty: '', note: null });
  });

  it('ignores a blank note rather than emitting a stray separator', () => {
    expect(aggregateAmounts([g(100), note('   ')]).note).toBeNull();
  });

  it('is case-insensitive when matching custom units', () => {
    expect(aggregateAmounts([custom(2, 'Cloves'), custom(3, 'cloves')]).qty).toBe('5 Cloves');
  });
});
