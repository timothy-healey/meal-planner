import { formatCookTime, formatWeekOf, formatPrice, formatItemCount, formatRelativeTime } from '../../lib/format';

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

describe('formatRelativeTime', () => {
  const NOW = Date.parse('2026-05-27T12:00:00Z');

  it('returns "today" within the last day', () => {
    expect(formatRelativeTime('2026-05-27T08:00:00Z', NOW)).toBe('today');
  });

  it('returns "{n}d ago" for 1-6 days', () => {
    expect(formatRelativeTime('2026-05-26T12:00:00Z', NOW)).toBe('1d ago');
    expect(formatRelativeTime('2026-05-22T12:00:00Z', NOW)).toBe('5d ago');
  });

  it('returns "last week" between 7 and 13 days', () => {
    expect(formatRelativeTime('2026-05-20T12:00:00Z', NOW)).toBe('last week');
  });

  it('returns "{n}w ago" between 14 and 29 days', () => {
    expect(formatRelativeTime('2026-05-13T12:00:00Z', NOW)).toBe('2w ago');
  });

  it('returns "{n}mo ago" between ~30 days and a year', () => {
    expect(formatRelativeTime('2026-03-27T12:00:00Z', NOW)).toBe('2mo ago');
  });

  it('returns "{n}y ago" for older than a year', () => {
    expect(formatRelativeTime('2024-05-27T12:00:00Z', NOW)).toBe('2y ago');
  });
});
