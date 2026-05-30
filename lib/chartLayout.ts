import { storeSeries } from '../constants/tokens';
import type { PricePoint } from '../types/db';

export type TimeRange = '3M' | '6M' | '1Y' | 'All';
export type ChartUnit = 'per100' | 'total';

export const CHART_MARGINS = { left: 34, right: 8, top: 8, bottom: 22 } as const;
export const DOT_RADIUS = 3.5;
export const SALE_RING_RADIUS = 6.5;

export function getStoreColor(index: number): string {
  return storeSeries[index % storeSeries.length];
}

export function filterByTimeRange<P extends Pick<PricePoint, 'purchasedAt'>>(
  points: P[],
  range: TimeRange,
  now = new Date(),
): P[] {
  if (range === 'All') return points;
  const months = range === '3M' ? 3 : range === '6M' ? 6 : 12;
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);
  return points.filter(p => new Date(p.purchasedAt) >= cutoff);
}

export interface YScale {
  min: number;
  max: number;
  ticks: Array<{ value: number; y: number; label: string }>;
  toY: (value: number) => number;
}

export function buildYScale(values: number[], chartAreaHeight: number): YScale {
  const rawMax = Math.max(...values, 0.20);
  const min = 0.20;
  // Round up to next 0.10 tick, ensure at least 5 ticks (0.20 to 0.60)
  const max = Math.max(Math.ceil(rawMax * 10) / 10, 0.60);
  const range = max - min;

  const toY = (value: number): number =>
    chartAreaHeight - ((value - min) / range) * chartAreaHeight;

  const tickCount = Math.round((max - min) / 0.10) + 1;
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const value = min + i * 0.10;
    return {
      value,
      y: toY(value),
      label: `${Math.round(value * 100)}¢`,
    };
  });

  return { min, max, ticks, toY };
}

export interface XScale {
  toX: (isoDate: string) => number;
  monthLabels: Array<{ label: string; x: number }>;
}

export function buildXScale(isoDates: string[], chartAreaWidth: number): XScale {
  if (isoDates.length === 0) {
    return { toX: () => 0, monthLabels: [] };
  }

  const timestamps = isoDates.map(d => new Date(d).getTime());
  const minT = Math.min(...timestamps);
  const maxT = Math.max(...timestamps);
  const span = maxT - minT || 1;

  const toX = (isoDate: string): number => {
    const t = new Date(isoDate).getTime();
    return ((t - minT) / span) * chartAreaWidth;
  };

  // Build month labels at first-of-month boundaries
  const start = new Date(minT);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(maxT);
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const monthLabels: Array<{ label: string; x: number }> = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const x = toX(cursor.toISOString());
    if (x >= 0 && x <= chartAreaWidth) {
      monthLabels.push({ label: MONTHS[cursor.getMonth()], x });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return { toX, monthLabels };
}
