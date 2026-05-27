import {
  filterByTimeRange,
  buildYScale,
  buildXScale,
  getStoreColor,
} from '../../lib/chartLayout';
import { storeSeries as STORE_COLORS } from '../../constants/tokens';
import type { PricePoint } from '../../types/db';

const makePoint = (chain: string, purchasedAt: string, normalisedPrice: number, isOnSale = false): PricePoint => ({
  chain, purchasedAt, normalisedPrice, isOnSale,
});

describe('filterByTimeRange', () => {
  const now = new Date('2026-05-24T00:00:00Z');

  it('All returns all points', () => {
    const pts = [makePoint('Coles', '2020-01-01T00:00:00Z', 0.5)];
    expect(filterByTimeRange(pts, 'All', now)).toHaveLength(1);
  });

  it('3M filters out points older than 3 months', () => {
    const pts = [
      makePoint('Coles', '2026-05-01T00:00:00Z', 0.5),  // in range
      makePoint('Coles', '2025-01-01T00:00:00Z', 0.5),  // out of range
    ];
    const result = filterByTimeRange(pts, '3M', now);
    expect(result).toHaveLength(1);
    expect(result[0].purchasedAt).toBe('2026-05-01T00:00:00Z');
  });

  it('6M keeps 6-month-old points', () => {
    const sixMonthsAgo = new Date('2025-11-24T00:00:00Z').toISOString();
    const pts = [makePoint('Coles', sixMonthsAgo, 0.5)];
    expect(filterByTimeRange(pts, '6M', now)).toHaveLength(1);
  });
});

describe('buildYScale', () => {
  it('starts at 0.20 minimum and rounds up to next 0.10 tick', () => {
    const scale = buildYScale([0.35, 0.42, 0.38], 100);
    expect(scale.min).toBe(0.20);
    expect(scale.max).toBeGreaterThanOrEqual(0.50);
    expect(scale.ticks.length).toBeGreaterThanOrEqual(5);
  });

  it('maps a value to a y coordinate (higher value = lower y)', () => {
    const scale = buildYScale([0.40], 100);
    const y040 = scale.toY(0.40);
    const y050 = scale.toY(0.50);
    // Higher value = more expensive = higher on chart = lower y coordinate
    expect(y050).toBeLessThan(y040);
  });
});

describe('buildXScale', () => {
  it('maps a date to an x coordinate within chartWidth', () => {
    const dates = ['2026-01-01T00:00:00Z', '2026-06-01T00:00:00Z'];
    const scale = buildXScale(dates, 200);
    expect(scale.toX('2026-01-01T00:00:00Z')).toBeCloseTo(0, 0);
    expect(scale.toX('2026-06-01T00:00:00Z')).toBeCloseTo(200, 0);
  });
});

describe('getStoreColor', () => {
  it('returns consistent colour for the same index', () => {
    expect(getStoreColor(0)).toBe(STORE_COLORS[0]);
    expect(getStoreColor(1)).toBe(STORE_COLORS[1]);
  });

  it('wraps around when index exceeds palette length', () => {
    expect(getStoreColor(STORE_COLORS.length)).toBe(STORE_COLORS[0]);
  });
});
