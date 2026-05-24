import { normalisePrice } from '../../lib/normalisePrice';

describe('normalisePrice', () => {
  it('g: price / qty * 100', () => {
    expect(normalisePrice(4.50, 1000, 'g')).toBeCloseTo(0.45);
    expect(normalisePrice(3.00, 500, 'g')).toBeCloseTo(0.60);
  });

  it('kg: converts to g first', () => {
    expect(normalisePrice(4.50, 1, 'kg')).toBeCloseTo(0.45);
    expect(normalisePrice(3.00, 0.5, 'kg')).toBeCloseTo(0.60);
  });

  it('mL: price / qty * 100', () => {
    expect(normalisePrice(2.80, 1000, 'mL')).toBeCloseTo(0.28);
  });

  it('L: converts to mL first', () => {
    expect(normalisePrice(2.80, 1, 'L')).toBeCloseTo(0.28);
  });

  it('units: returns price as-is (total, not per-100g)', () => {
    expect(normalisePrice(12.00, 1, 'units')).toBe(12.00);
  });
});
