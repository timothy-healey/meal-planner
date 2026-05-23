import { formatCookTime, formatWeekOf, formatPrice, formatItemCount } from '../../lib/format';

describe('formatCookTime', () => {
  it('returns hours when cook_minutes >= 60', () => {
    expect(formatCookTime(0, 120)).toBe('2h');
    expect(formatCookTime(10, 60)).toBe('1h');
    expect(formatCookTime(0, 480)).toBe('8h');
  });

  it('returns total minutes when cook_minutes < 60', () => {
    expect(formatCookTime(10, 20)).toBe('30 min');
    expect(formatCookTime(5, 10)).toBe('15 min');
    expect(formatCookTime(0, 0)).toBe('0 min');
  });
});

describe('formatWeekOf', () => {
  it('formats ISO date as "DD MMM"', () => {
    expect(formatWeekOf('2026-05-24')).toBe('24 May');
    expect(formatWeekOf('2026-01-05')).toBe('5 Jan');
  });
});

describe('formatPrice', () => {
  it('formats number as $X.XX', () => {
    expect(formatPrice(12.5)).toBe('$12.50');
    expect(formatPrice(0)).toBe('$0.00');
    expect(formatPrice(140)).toBe('$140.00');
  });
});

describe('formatItemCount', () => {
  it('returns checked and total counts', () => {
    expect(formatItemCount(3, 10)).toBe('✓ 3 / 10');
    expect(formatItemCount(0, 5)).toBe('✓ 0 / 5');
  });
});
