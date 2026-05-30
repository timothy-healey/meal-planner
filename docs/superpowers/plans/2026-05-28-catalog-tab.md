# Catalog Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Catalog tab — a fourth top-level destination for browsing every product in the catalog with audit affordances, plus a per-item-name product detail view with merge/delete actions. Refactor the price-history chart from per-product to per-item-name category-wide while we're at it.

**Architecture:** Five new files (landing screen, detail screen, useCatalog hook, findDuplicates helper, CatalogRow component, MergeProductSheet component) plus targeted modifications to `usePriceHistory` / `PriceHistoryChart` / `useProducts` / the three chart callers / the tab bar. Phase 1 lands the data-layer changes (helpers, hooks, chart refactor) with their callers fixed; Phase 2 builds the new UI components; Phase 3 wires the new screens and the tab bar entry.

**Tech Stack:** Expo SDK 56, React Native, expo-router, expo-sqlite (with JSON1 extension), Jest + @testing-library/react-native, Fuse.js (already a dep, used by ingredient suggestions).

**Spec:** [2026-05-28-catalog-tab-design.md](../specs/2026-05-28-catalog-tab-design.md)

---

## File Structure

**Create:**
- `lib/catalog/findDuplicates.ts` — pure helper (Fuse.js-based duplicate detection)
- `hooks/useCatalog.ts` — landing-screen data hook
- `components/CatalogRow.tsx` — single row in the catalog list (clean and problem variants)
- `components/MergeProductSheet.tsx` — merge picker with fuzzy auto-suggest
- `app/(tabs)/catalog.tsx` — landing screen
- `app/catalog/[id].tsx` — push-navigated detail screen
- `__tests__/lib/catalog/findDuplicates.test.ts`
- `__tests__/hooks/useCatalog.test.ts`
- `__tests__/components/CatalogRow.test.tsx`
- `__tests__/components/MergeProductSheet.test.tsx`
- `__tests__/screens/catalog.test.tsx`
- `__tests__/screens/catalog-detail.test.tsx`

**Modify:**
- `types/db.ts` — add `ProductPricePoint`
- `hooks/usePriceHistory.ts` — signature change to `itemName`
- `components/PriceHistoryChart.tsx` — group by `(brand, product_name)`; signature change
- `components/IngredientSheet.tsx` — pass `itemName` instead of `productId`
- `components/ReviewItemSheet.tsx` — pass `itemName` instead of `productId`
- `hooks/useProducts.ts` — add `getAll`, `deleteProduct`, `mergeProduct`
- `app/(tabs)/_layout.tsx` — add Catalog tab
- `__tests__/hooks/usePriceHistory.test.ts` — update for new signature
- `__tests__/hooks/useProducts.test.ts` — tests for new methods
- `__tests__/components/IngredientSheet.test.tsx` — chart prop adjustment if asserted
- `__tests__/components/ReviewItemSheet.test.tsx` — same

---

## Task 1: `findDuplicates` pure helper + tests

**Files:**
- Create: `lib/catalog/findDuplicates.ts`
- Create: `__tests__/lib/catalog/findDuplicates.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/lib/catalog/findDuplicates.test.ts
import { findDuplicateMatches } from '../../../lib/catalog/findDuplicates';
import type { ProductRow } from '../../../types/db';

function p(overrides: Partial<ProductRow>): ProductRow {
  return {
    id: 'id', brand: '', product_name: 'product', item_name: 'item',
    basis: 'per_100g',
    cal_per_basis: null, protein_per_basis: null, carbs_per_basis: null, fat_per_basis: null,
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('findDuplicateMatches', () => {
  it('returns an empty map for empty input', () => {
    expect(findDuplicateMatches([]).size).toBe(0);
  });

  it('returns an empty map when no two products share an item_name', () => {
    const result = findDuplicateMatches([
      p({ id: '1', item_name: 'chicken breast', product_name: 'Coles Chicken Breast Fillets' }),
      p({ id: '2', item_name: 'eggs',           product_name: 'Coles Eggs 12pk' }),
    ]);
    expect(result.size).toBe(0);
  });

  it('surfaces near-spelling twins within the same item_name', () => {
    const a = p({ id: '1', item_name: 'chicken breast', product_name: 'Coles Chicken Breast Fillet' });
    const b = p({ id: '2', item_name: 'chicken breast', product_name: 'Coles Chicken Breast Fillets' });
    const result = findDuplicateMatches([a, b]);
    expect(result.size).toBe(2);
    expect(result.get('1')?.twin.id).toBe('2');
    expect(result.get('2')?.twin.id).toBe('1');
  });

  it('does not match products whose product_name is too distant', () => {
    const a = p({ id: '1', item_name: 'meat', product_name: 'Chicken Breast' });
    const b = p({ id: '2', item_name: 'meat', product_name: 'Lamb Shoulder' });
    expect(findDuplicateMatches([a, b]).size).toBe(0);
  });

  it('item_name grouping is case- and whitespace-insensitive', () => {
    const a = p({ id: '1', item_name: 'Chicken Breast', product_name: 'Coles Fillet' });
    const b = p({ id: '2', item_name: 'chicken breast ', product_name: 'Coles Fillets' });
    expect(findDuplicateMatches([a, b]).size).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/catalog/findDuplicates.test.ts`
Expected: FAIL — `findDuplicateMatches` not defined.

- [ ] **Step 3: Implement the helper**

```ts
// lib/catalog/findDuplicates.ts
import Fuse from 'fuse.js';
import type { ProductRow } from '../../types/db';

export interface DuplicateMatch {
  product: ProductRow;
  twin: ProductRow;
}

function normaliseItemName(s: string): string {
  return s.trim().toLowerCase();
}

export function findDuplicateMatches(
  products: ProductRow[],
): Map<string, DuplicateMatch> {
  const result = new Map<string, DuplicateMatch>();

  // Group products by normalised item_name. Only groups with 2+ members can have duplicates.
  const byItemName = new Map<string, ProductRow[]>();
  for (const p of products) {
    const key = normaliseItemName(p.item_name);
    if (!byItemName.has(key)) byItemName.set(key, []);
    byItemName.get(key)!.push(p);
  }

  for (const group of byItemName.values()) {
    if (group.length < 2) continue;
    const fuse = new Fuse(group, {
      keys: ['product_name'],
      threshold: 0.4,
      ignoreLocation: true,
    });
    for (const product of group) {
      const hits = fuse
        .search(product.product_name)
        .filter(h => h.item.id !== product.id);
      if (hits.length > 0) {
        result.set(product.id, { product, twin: hits[0].item });
      }
    }
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/catalog/findDuplicates.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/catalog/findDuplicates.ts __tests__/lib/catalog/findDuplicates.test.ts
git commit -m "feat(catalog): findDuplicateMatches helper with Fuse.js-based detection"
```

---

## Task 2: `ProductPricePoint` type + `usePriceHistory` signature change

**Files:**
- Modify: `types/db.ts`
- Modify: `hooks/usePriceHistory.ts`
- Modify: `__tests__/hooks/usePriceHistory.test.ts`

- [ ] **Step 1: Add `ProductPricePoint` to `types/db.ts`**

After the existing `PricePoint` interface, append:

```ts
export interface ProductPricePoint extends PricePoint {
  productId: string;
  brand: string;
  productName: string;
}
```

- [ ] **Step 2: Update `__tests__/hooks/usePriceHistory.test.ts`**

Replace the test file:

```ts
import { renderHook, waitFor } from '@testing-library/react-native';
import { usePriceHistory } from '../../hooks/usePriceHistory';

const mockDb = {
  getAllAsync: jest.fn().mockResolvedValue([]),
};

jest.mock('../../providers/DatabaseProvider', () => ({
  useDb: () => mockDb,
}));

const makeRow = (overrides = {}) => ({
  id: '1',
  plan_id: null,
  item_name: 'oats',
  store_id: 's1',
  product_id: 'prod-1',
  qty_amount: 1000,
  qty_unit: 'g',
  price: 4.50,
  is_sale: 0,
  barcode: null,
  purchased_at: '2026-01-15T10:00:00Z',
  status: 'confirmed',
  chain: 'Woolworths',
  brand: 'Woolworths',
  product_name: 'Rolled Oats 1kg',
  ...overrides,
});

describe('usePriceHistory', () => {
  beforeEach(() => {
    mockDb.getAllAsync.mockClear();
    mockDb.getAllAsync.mockResolvedValue([]);
  });

  it('returns empty array when itemName is null', async () => {
    const { result } = renderHook(() => usePriceHistory(null));
    await waitFor(() => expect(result.current.points).toEqual([]));
    expect(mockDb.getAllAsync).not.toHaveBeenCalled();
  });

  it('queries by item_name (case-insensitive)', async () => {
    mockDb.getAllAsync.mockResolvedValue([makeRow()]);
    const { result } = renderHook(() => usePriceHistory('oats'));
    await waitFor(() => expect(result.current.points).toHaveLength(1));
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('LOWER(p.item_name) = LOWER(?)'),
      ['oats'],
    );
  });

  it('normalises g price to ¢/100g', async () => {
    mockDb.getAllAsync.mockResolvedValue([makeRow({ price: 4.50, qty_amount: 1000, qty_unit: 'g' })]);
    const { result } = renderHook(() => usePriceHistory('oats'));
    await waitFor(() => expect(result.current.points).toHaveLength(1));
    expect(result.current.points[0].normalisedPrice).toBeCloseTo(0.45);
  });

  it('exposes brand, productName, productId on every point', async () => {
    mockDb.getAllAsync.mockResolvedValue([makeRow({ brand: 'Macro', product_name: 'Oats 500g' })]);
    const { result } = renderHook(() => usePriceHistory('oats'));
    await waitFor(() => expect(result.current.points).toHaveLength(1));
    expect(result.current.points[0]).toMatchObject({
      brand: 'Macro',
      productName: 'Oats 500g',
      productId: 'prod-1',
    });
  });

  it('maps isOnSale correctly', async () => {
    mockDb.getAllAsync.mockResolvedValue([makeRow({ is_sale: 1 })]);
    const { result } = renderHook(() => usePriceHistory('oats'));
    await waitFor(() => expect(result.current.points).toHaveLength(1));
    expect(result.current.points[0].isOnSale).toBe(true);
  });

  it('queries only confirmed purchase rows', async () => {
    const { result } = renderHook(() => usePriceHistory('oats'));
    await waitFor(() => expect(result.current.points).toEqual([]));
    const sqlCalls = mockDb.getAllAsync.mock.calls.map((c: any[]) => c[0] as string);
    expect(sqlCalls.some(s => /status = 'confirmed'/.test(s))).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest __tests__/hooks/usePriceHistory.test.ts`
Expected: FAIL — old hook still uses productId.

- [ ] **Step 4: Replace `hooks/usePriceHistory.ts`**

```ts
import { useState, useEffect, useCallback } from 'react';
import { useDb } from '../providers/DatabaseProvider';
import { normalisePrice } from '../lib/normalisePrice';
import type { ProductPricePoint, PurchaseHistoryRow, QtyUnit } from '../types/db';

type Row = PurchaseHistoryRow & {
  chain: string;
  brand: string;
  product_name: string;
};

export function usePriceHistory(
  itemName: string | null,
): { points: ProductPricePoint[]; reload: () => void } {
  const db = useDb();
  const [points, setPoints] = useState<ProductPricePoint[]>([]);

  const load = useCallback(async () => {
    if (!itemName) {
      setPoints([]);
      return;
    }
    const rows = await db.getAllAsync<Row>(
      `SELECT ph.*, s.chain, p.brand, p.product_name
       FROM purchase_history ph
       JOIN stores s ON ph.store_id = s.id
       JOIN products p ON p.id = ph.product_id
       WHERE LOWER(p.item_name) = LOWER(?)
         AND ph.price IS NOT NULL
         AND ph.qty_amount IS NOT NULL
         AND ph.qty_unit IS NOT NULL
         AND ph.status = 'confirmed'
       ORDER BY ph.purchased_at ASC`,
      [itemName],
    );
    setPoints(
      rows.map(row => ({
        chain: row.chain,
        purchasedAt: row.purchased_at,
        normalisedPrice: normalisePrice(
          row.price!,
          row.qty_amount!,
          row.qty_unit! as QtyUnit,
        ),
        isOnSale: row.is_sale === 1,
        productId: row.product_id!,
        brand: row.brand,
        productName: row.product_name,
      })),
    );
  }, [itemName, db]);

  useEffect(() => { load(); }, [load]);

  return { points, reload: load };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest __tests__/hooks/usePriceHistory.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add types/db.ts hooks/usePriceHistory.ts __tests__/hooks/usePriceHistory.test.ts
git commit -m "refactor(usePriceHistory): query by item_name; expose brand/productName per point"
```

---

## Task 3: `PriceHistoryChart` grouping refactor

**Files:**
- Modify: `components/PriceHistoryChart.tsx`

- [ ] **Step 1: Update props and grouping in `components/PriceHistoryChart.tsx`**

Replace the file with:

```tsx
import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Line, Polyline, Circle, Text as SvgText } from 'react-native-svg';
import { AppText } from './ui/AppText';
import { colors, font, spacing, radius, shadow } from '../constants/tokens';
import { usePriceHistory } from '../hooks/usePriceHistory';
import {
  filterByTimeRange,
  buildYScale,
  buildXScale,
  getStoreColor,
  CHART_MARGINS,
  DOT_RADIUS,
  SALE_RING_RADIUS,
  type TimeRange,
  type ChartUnit,
} from '../lib/chartLayout';
import type { ProductPricePoint } from '../types/db';
import { AddPriceSheet } from './AddPriceSheet';

interface Props {
  itemName: string;
}

const TIME_RANGES: TimeRange[] = ['3M', '6M', '1Y', 'All'];

function groupKey(p: ProductPricePoint): string {
  return `${p.brand} ${p.productName}`;
}

function groupLabel(p: ProductPricePoint): string {
  return p.brand ? `${p.brand} ${p.productName}` : p.productName;
}

export function PriceHistoryChart({ itemName }: Props) {
  const { points, reload } = usePriceHistory(itemName);
  const [timeRange, setTimeRange] = useState<TimeRange>('6M');
  const [unit, setUnit] = useState<ChartUnit>('per100');
  const [chartWidth, setChartWidth] = useState(0);
  const [addPriceVisible, setAddPriceVisible] = useState(false);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setChartWidth(e.nativeEvent.layout.width);
  }, []);

  const filtered = filterByTimeRange(points, timeRange);

  // Group by (brand, product_name) using a composite key. Each unique group gets a stable colour.
  const groups = [...new Set(filtered.map(groupKey))].sort();
  const groupMap = new Map<string, ProductPricePoint[]>();
  for (const k of groups) {
    groupMap.set(k, filtered.filter(p => groupKey(p) === k));
  }

  const displayValue = (p: ProductPricePoint) => p.normalisedPrice;

  const allValues = filtered.map(displayValue);
  const CHART_H = 130;
  const areaW = Math.max(chartWidth - CHART_MARGINS.left - CHART_MARGINS.right, 0);
  const areaH = CHART_H - CHART_MARGINS.top - CHART_MARGINS.bottom;

  const yScale = buildYScale(allValues.length ? allValues : [0.40], areaH);
  const xScale = buildXScale(filtered.map(p => p.purchasedAt), areaW);

  // Best value now: lowest most-recent normalised price per group.
  const bestValue: { label: string; value: number } | null = (() => {
    if (!groups.length) return null;
    let best: { label: string; value: number } | null = null;
    for (const k of groups) {
      const pts = groupMap.get(k)!;
      const last = pts[pts.length - 1];
      const v = displayValue(last);
      if (!best || v < best.value) best = { label: groupLabel(last), value: v };
    }
    return best;
  })();

  const toSvgX = (iso: string) => CHART_MARGINS.left + xScale.toX(iso);
  const toSvgY = (v: number) => CHART_MARGINS.top + yScale.toY(v);

  return (
    <View>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionDot} />
        <AppText weight="bold" size="sm" color="terracotta" style={styles.sectionTitle}>
          PRICE HISTORY
        </AppText>
        <TouchableOpacity
          onPress={() => setAddPriceVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Add price"
          disabled={filtered.length === 0}
        >
          <AppText weight="bold" size="sm" color={filtered.length === 0 ? 'textTertiary' : 'green'}>
            + Add price
          </AppText>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.toolbar}>
          <View style={styles.timeTabs}>
            {TIME_RANGES.map(r => (
              <TouchableOpacity
                key={r}
                onPress={() => setTimeRange(r)}
                style={[styles.timeTab, timeRange === r && styles.timeTabActive]}
              >
                <AppText
                  weight={timeRange === r ? 'bold' : 'semibold'}
                  size="sm"
                  color={timeRange === r ? 'green' : 'textTertiary'}
                >
                  {r}
                </AppText>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.unitToggle}>
            {(['total', 'per100'] as ChartUnit[]).map(u => (
              <TouchableOpacity
                key={u}
                onPress={() => setUnit(u)}
                style={[styles.unitOpt, unit === u && styles.unitOptActive]}
              >
                <AppText
                  weight={unit === u ? 'bold' : 'semibold'}
                  size="sm"
                  color={unit === u ? 'green' : 'textTertiary'}
                >
                  {u === 'per100' ? '/100g' : 'Total'}
                </AppText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <AppText weight="semibold" size="sm" color="textTertiary" style={styles.emptyText}>
              {'No price data yet.\nPrices are recorded when you log a purchase.'}
            </AppText>
          </View>
        ) : (
          <View onLayout={onLayout}>
            {chartWidth > 0 && (
              <Svg width={chartWidth} height={CHART_H}>
                <Line
                  x1={CHART_MARGINS.left} y1={CHART_MARGINS.top}
                  x2={CHART_MARGINS.left} y2={CHART_MARGINS.top + areaH}
                  stroke={colors.divider} strokeWidth={1}
                />
                <Line
                  x1={CHART_MARGINS.left} y1={CHART_MARGINS.top + areaH}
                  x2={chartWidth - CHART_MARGINS.right} y2={CHART_MARGINS.top + areaH}
                  stroke={colors.divider} strokeWidth={1}
                />
                {yScale.ticks.map(tick => (
                  <React.Fragment key={tick.value}>
                    <Line
                      x1={CHART_MARGINS.left}
                      y1={CHART_MARGINS.top + tick.y}
                      x2={chartWidth - CHART_MARGINS.right}
                      y2={CHART_MARGINS.top + tick.y}
                      stroke={colors.divider}
                      strokeWidth={0.8}
                      strokeDasharray="3,3"
                    />
                    <SvgText
                      x={CHART_MARGINS.left - 4}
                      y={CHART_MARGINS.top + tick.y + 3}
                      textAnchor="end"
                      fontSize={font.size['2xs']}
                      fontFamily={font.family.semibold}
                      fill={colors.textTertiary}
                    >
                      {tick.label}
                    </SvgText>
                  </React.Fragment>
                ))}
                {xScale.monthLabels.map(ml => (
                  <SvgText
                    key={ml.label + ml.x}
                    x={CHART_MARGINS.left + ml.x}
                    y={CHART_MARGINS.top + areaH + 14}
                    textAnchor="middle"
                    fontSize={font.size['2xs']}
                    fontFamily={font.family.semibold}
                    fill={colors.textTertiary}
                  >
                    {ml.label}
                  </SvgText>
                ))}

                {groups.map((k, idx) => {
                  const pts = groupMap.get(k)!;
                  const color = getStoreColor(idx);
                  const isSparse = pts.length < 3;
                  const regularPts = pts.filter(p => !p.isOnSale);
                  const salePts = pts.filter(p => p.isOnSale);

                  const regularCoords = regularPts
                    .map(p => `${toSvgX(p.purchasedAt)},${toSvgY(displayValue(p))}`)
                    .join(' ');

                  return (
                    <React.Fragment key={k}>
                      {regularPts.length > 1 && (
                        <Polyline
                          points={regularCoords}
                          fill="none"
                          stroke={color}
                          strokeWidth={2}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          strokeDasharray={isSparse ? '5,3' : undefined}
                          opacity={isSparse ? 0.8 : 1}
                        />
                      )}
                      {regularPts.map(p => (
                        <Circle
                          key={p.purchasedAt}
                          cx={toSvgX(p.purchasedAt)}
                          cy={toSvgY(displayValue(p))}
                          r={DOT_RADIUS}
                          fill={color}
                        />
                      ))}
                      {salePts.map(p => {
                        const sx = toSvgX(p.purchasedAt);
                        const sy = toSvgY(displayValue(p));
                        const prev = regularPts
                          .filter(r => r.purchasedAt < p.purchasedAt)
                          .at(-1);
                        const next = regularPts
                          .find(r => r.purchasedAt > p.purchasedAt);
                        return (
                          <React.Fragment key={'sale-' + p.purchasedAt}>
                            {prev && (
                              <Line
                                x1={toSvgX(prev.purchasedAt)}
                                y1={toSvgY(displayValue(prev))}
                                x2={sx} y2={sy}
                                stroke={color} strokeWidth={1.5}
                                strokeDasharray="3,2"
                              />
                            )}
                            {next && (
                              <Line
                                x1={sx} y1={sy}
                                x2={toSvgX(next.purchasedAt)}
                                y2={toSvgY(displayValue(next))}
                                stroke={color} strokeWidth={1.5}
                                strokeDasharray="3,2"
                              />
                            )}
                            <Circle cx={sx} cy={sy} r={DOT_RADIUS} fill={color} />
                            <Circle
                              cx={sx} cy={sy} r={SALE_RING_RADIUS}
                              fill="none" stroke={colors.orange} strokeWidth={2}
                            />
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </Svg>
            )}
          </View>
        )}

        {bestValue && (
          <View style={styles.bestValue}>
            <AppText weight="semibold" size="sm" color="textSecondary">Best value now</AppText>
            <AppText weight="extrabold" size="md" color="orange">
              {bestValue.label}
              <AppText weight="medium" size="sm" color="textTertiary">
                {` ${(bestValue.value * 100).toFixed(0)}¢/100g`}
              </AppText>
            </AppText>
          </View>
        )}

        <View style={styles.legend}>
          {groups.map((k, idx) => {
            const sample = groupMap.get(k)![0];
            return (
              <View key={k} style={styles.legendPill}>
                <View style={[styles.legendDot, { backgroundColor: getStoreColor(idx) }]} />
                <AppText weight="semibold" size="xs" color="textSecondary">{groupLabel(sample)}</AppText>
              </View>
            );
          })}
          {filtered.some(p => p.isOnSale) && (
            <View style={[styles.legendPill, styles.legendSale]}>
              <View style={styles.legendSaleIcon} />
              <AppText weight="semibold" size="xs" color="orange">Sale</AppText>
            </View>
          )}
        </View>
      </View>

      {filtered.length > 0 && (
        <AddPriceSheet
          visible={addPriceVisible}
          productId={filtered[filtered.length - 1].productId}
          onClose={() => setAddPriceVisible(false)}
          onSaved={() => { setAddPriceVisible(false); reload(); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 2,
  },
  sectionDot: {
    width: 7,
    height: 7,
    borderRadius: 9999,
    backgroundColor: colors.terracotta,
  },
  sectionTitle: {
    flex: 1,
    letterSpacing: font.tracking.category,
  },
  card: {
    marginHorizontal: spacing[3],
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing[3] + 2,
    ...shadow.card,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  timeTabs: { flexDirection: 'row', gap: 2 },
  timeTab: { paddingVertical: 3, paddingHorizontal: spacing[2] + 2, borderRadius: 9999 },
  timeTabActive: { backgroundColor: colors.chipSurface },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: colors.cream,
    borderRadius: 9999,
    padding: 2,
    gap: 2,
  },
  unitOpt: { paddingVertical: 3, paddingHorizontal: spacing[2] + 2, borderRadius: 9999 },
  unitOptActive: {
    backgroundColor: colors.card,
    ...shadow.pill,
  },
  empty: {
    paddingVertical: spacing[10],
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: 18,
  },
  bestValue: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[2] + 2,
    backgroundColor: colors.cream,
    borderRadius: radius.sm,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1] + 1,
    marginTop: spacing[2] + 1,
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.cream,
    borderRadius: radius.full,
    paddingVertical: 3,
    paddingHorizontal: spacing[2] + 1,
  },
  legendDot: { width: 7, height: 7, borderRadius: radius.full },
  legendSale: { backgroundColor: colors.saleTint },
  legendSaleIcon: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.orange,
  },
});
```

Note: the `AddPriceSheet` `productId` prop is satisfied by selecting the productId of the most recent point in the filtered set. This is a defensible default — the user can edit which SKU they're logging a price for inside the sheet (which currently only accepts a productId since Piece A; if you want a UX where the user picks which SKU from a dropdown, that's a future change).

- [ ] **Step 2: Run the suite — chart callers will fail typecheck, expected**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: errors in `components/IngredientSheet.tsx` and `components/ReviewItemSheet.tsx` (they still pass `productId`). Task 4 fixes them.

- [ ] **Step 3: Commit**

```bash
git add components/PriceHistoryChart.tsx
git commit -m "refactor(PriceHistoryChart): group lines by (brand, product_name) within item_name"
```

---

## Task 4: Update chart callers (`IngredientSheet`, `ReviewItemSheet`)

**Files:**
- Modify: `components/IngredientSheet.tsx`
- Modify: `components/ReviewItemSheet.tsx`

- [ ] **Step 1: Update `components/IngredientSheet.tsx`**

Find the `PriceHistoryChart` usage (currently `<PriceHistoryChart productId={existingEntry.id} />`) and change to pass `itemName`:

```tsx
{existingEntry?.item_name && (
  <PriceHistoryChart itemName={existingEntry.item_name} />
)}
```

(The fallback condition keeps the chart out of the DOM when there's no existing entry — i.e. brand-new ingredients with no nutrition yet. Existing entries always have `item_name` set in the new schema.)

- [ ] **Step 2: Update `components/ReviewItemSheet.tsx`**

The current Piece A wiring resolves a `productId` via a `useEffect` and renders the chart only when resolved. With the new signature, the chart only needs an `itemName` — which is just `item?.name` from the props. The resolve effect and `resolvedProductId` state become unused for the chart but `resolvedProductId` is still used to pre-check "does a product already exist" (i.e. to know whether to render the chart at all). Cleaner: just gate on `item?.name` directly.

Locate the price-chart render block (after Piece A):

```tsx
{resolvedProductId && (
  <View style={{ marginTop: spacing[4], marginHorizontal: -spacing[4] }}>
    <PriceHistoryChart productId={resolvedProductId} />
  </View>
)}
```

Replace with:

```tsx
{item?.name && (
  <View style={{ marginTop: spacing[4], marginHorizontal: -spacing[4] }}>
    <PriceHistoryChart itemName={item.name} />
  </View>
)}
```

Then delete the `resolvedProductId` state, the `getByKey` destructure, and the `useEffect` that maintains them — they're no longer needed (they were only feeding the chart and the chart no longer needs them).

Find these declarations near the top of the component body:

```ts
const { upsert, getByKey } = useProducts();
const [resolvedProductId, setResolvedProductId] = useState<string | null>(null);
```

Change to:

```ts
const { upsert } = useProducts();
```

And remove the `useEffect` that sets `resolvedProductId`:

```ts
useEffect(() => {
  const b = brand.trim();
  const p = productName.trim();
  if (!p) { setResolvedProductId(null); return; }
  let cancelled = false;
  getByKey(b, p).then(row => {
    if (!cancelled) setResolvedProductId(row?.id ?? null);
  });
  return () => { cancelled = true; };
}, [brand, productName, getByKey]);
```

(Delete entirely.)

- [ ] **Step 3: Re-run typecheck and tests**

Run: `npx tsc --noEmit`
Expected: zero errors.

Run: `npx jest __tests__/components/IngredientSheet.test.tsx __tests__/components/ReviewItemSheet.test.tsx`
Expected: PASS (test mocks for PriceHistoryChart stub it as `() => null`, so prop changes don't affect existing assertions).

- [ ] **Step 4: Commit**

```bash
git add components/IngredientSheet.tsx components/ReviewItemSheet.tsx
git commit -m "refactor(chart callers): pass itemName; drop resolvedProductId plumbing in ReviewItemSheet"
```

---

## Task 5: `useProducts` gains `getAll`, `deleteProduct`, `mergeProduct`

**Files:**
- Modify: `hooks/useProducts.ts`
- Modify: `__tests__/hooks/useProducts.test.ts`

- [ ] **Step 1: Append tests to `__tests__/hooks/useProducts.test.ts`**

After the existing `describe` blocks, append:

```ts
describe('useProducts.getAll', () => {
  it('returns all rows ordered by item_name then product_name', async () => {
    const rows = [
      { id: '1', brand: '', product_name: 'banana', item_name: 'banana', basis: 'per_unit',
        cal_per_basis: 105, protein_per_basis: 1.3, carbs_per_basis: 27, fat_per_basis: 0.4,
        updated_at: '2026-01-01T00:00:00Z' },
    ];
    mockDb.getAllAsync.mockResolvedValueOnce(rows);
    const { result } = renderHook(() => useProducts());
    const got = await result.current.getAll();
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM products'),
    );
    expect(got).toEqual(rows);
  });
});

describe('useProducts.deleteProduct', () => {
  it('clears recipe references, nulls purchase_history.product_id, then deletes the row', async () => {
    // recipes affected by this product
    mockDb.getAllAsync.mockResolvedValueOnce([
      { id: 'r1', ingredients_json: JSON.stringify([
        { item: 'chicken', amount: { kind: 'measured', value: 200, unit: 'g' }, product_id: 'p1' },
        { item: 'rice',    amount: { kind: 'measured', value: 150, unit: 'g' } },
      ]) },
    ]);
    const { result } = renderHook(() => useProducts());
    await result.current.deleteProduct('p1');

    // Transaction wrapper
    const calls = mockDb.runAsync.mock.calls.map((c: any[]) => c[0] as string);
    expect(calls[0]).toBe('BEGIN');
    expect(calls[calls.length - 1]).toBe('COMMIT');

    // Recipe ingredients_json rewritten without product_id
    const updateRecipe = mockDb.runAsync.mock.calls.find(
      c => typeof c[0] === 'string' && c[0].startsWith('UPDATE recipes'),
    );
    expect(updateRecipe).toBeDefined();
    const written = JSON.parse(updateRecipe![1][0]);
    expect(written[0].product_id).toBeUndefined();

    // purchase_history nulled
    expect(calls).toEqual(expect.arrayContaining([
      expect.stringMatching(/UPDATE purchase_history SET product_id = NULL WHERE product_id = \?/),
    ]));

    // products row deleted
    expect(calls).toEqual(expect.arrayContaining([
      expect.stringMatching(/DELETE FROM products WHERE id = \?/),
    ]));
  });
});

describe('useProducts.mergeProduct', () => {
  it('runs the full merge transaction (re-target purchases, rewrite recipes, delete source)', async () => {
    // source and target rows for macro comparison
    mockDb.getFirstAsync
      .mockResolvedValueOnce({ id: 'src', brand: 'Coles', product_name: 'Fillet', item_name: 'chicken breast',
        basis: 'per_100g', cal_per_basis: 165, protein_per_basis: 31, carbs_per_basis: 0, fat_per_basis: 3.6,
        updated_at: '2026-02-01T00:00:00Z' })
      .mockResolvedValueOnce({ id: 'tgt', brand: 'Coles', product_name: 'Fillets', item_name: 'chicken breast',
        basis: 'per_100g', cal_per_basis: 170, protein_per_basis: 30, carbs_per_basis: 0, fat_per_basis: 4,
        updated_at: '2026-01-01T00:00:00Z' });
    // recipes referencing source
    mockDb.getAllAsync.mockResolvedValueOnce([
      { id: 'r1', ingredients_json: JSON.stringify([
        { item: 'chicken', amount: { kind: 'measured', value: 200, unit: 'g' }, product_id: 'src' },
      ]) },
    ]);

    const { result } = renderHook(() => useProducts());
    await result.current.mergeProduct('src', 'tgt');

    const calls = mockDb.runAsync.mock.calls;
    const sqls = calls.map(c => c[0] as string);

    // Transaction wrapper
    expect(sqls[0]).toBe('BEGIN');
    expect(sqls[sqls.length - 1]).toBe('COMMIT');

    // Source is more recent and has macros → target gets source's macros
    const updateProducts = calls.find(c => typeof c[0] === 'string' && c[0].includes('UPDATE products SET'));
    expect(updateProducts).toBeDefined();
    expect(updateProducts![1]).toEqual(expect.arrayContaining([165, 31, 0, 3.6, 'tgt']));

    // purchase_history re-targeted
    expect(sqls).toEqual(expect.arrayContaining([
      expect.stringMatching(/UPDATE purchase_history SET product_id = \? WHERE product_id = \?/),
    ]));

    // recipe ingredients_json rewritten with target id
    const updateRecipe = calls.find(c => typeof c[0] === 'string' && c[0].startsWith('UPDATE recipes'));
    const written = JSON.parse(updateRecipe![1][0]);
    expect(written[0].product_id).toBe('tgt');

    // source deleted
    expect(sqls).toEqual(expect.arrayContaining([
      expect.stringMatching(/DELETE FROM products WHERE id = \?/),
    ]));
  });

  it('keeps target macros when source has none', async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({ id: 'src', brand: 'A', product_name: 'X', item_name: 'foo',
        basis: 'per_100g', cal_per_basis: null, protein_per_basis: null, carbs_per_basis: null, fat_per_basis: null,
        updated_at: '2026-02-01T00:00:00Z' })
      .mockResolvedValueOnce({ id: 'tgt', brand: 'A', product_name: 'Y', item_name: 'foo',
        basis: 'per_100g', cal_per_basis: 100, protein_per_basis: 10, carbs_per_basis: 20, fat_per_basis: 1,
        updated_at: '2026-01-01T00:00:00Z' });
    mockDb.getAllAsync.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useProducts());
    await result.current.mergeProduct('src', 'tgt');

    const calls = mockDb.runAsync.mock.calls;
    const updateProducts = calls.find(c => typeof c[0] === 'string' && c[0].includes('UPDATE products SET'));
    // No macro update should happen — target already has them and source is empty
    expect(updateProducts).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/hooks/useProducts.test.ts`
Expected: FAIL — new methods not defined.

- [ ] **Step 3: Add the new methods to `hooks/useProducts.ts`**

Append inside the `useProducts` function, before the `return`:

```ts
  const getAll = useCallback(async (): Promise<ProductRow[]> => {
    return await db.getAllAsync<ProductRow>(
      'SELECT * FROM products ORDER BY item_name, product_name',
    );
  }, [db]);

  const deleteProduct = useCallback(async (productId: string): Promise<void> => {
    await db.runAsync('BEGIN');
    try {
      const affectedRecipes = await db.getAllAsync<{ id: string; ingredients_json: string }>(
        `SELECT DISTINCT r.id, r.ingredients_json
         FROM recipes r, json_each(r.ingredients_json) ing
         WHERE json_extract(ing.value, '$.product_id') = ?`,
        [productId],
      );
      for (const r of affectedRecipes) {
        const ingredients = JSON.parse(r.ingredients_json);
        const next = ingredients.map((ing: any) => {
          if (ing.product_id === productId) {
            const { product_id, ...rest } = ing;
            return rest;
          }
          return ing;
        });
        await db.runAsync(
          'UPDATE recipes SET ingredients_json = ? WHERE id = ?',
          [JSON.stringify(next), r.id],
        );
      }
      await db.runAsync(
        'UPDATE purchase_history SET product_id = NULL WHERE product_id = ?',
        [productId],
      );
      await db.runAsync('DELETE FROM products WHERE id = ?', [productId]);
      await db.runAsync('COMMIT');
    } catch (e) {
      await db.runAsync('ROLLBACK');
      throw e;
    }
  }, [db]);

  const mergeProduct = useCallback(async (
    sourceId: string,
    targetId: string,
  ): Promise<void> => {
    if (sourceId === targetId) return;

    const source = await db.getFirstAsync<ProductRow>(
      'SELECT * FROM products WHERE id = ?',
      [sourceId],
    );
    const target = await db.getFirstAsync<ProductRow>(
      'SELECT * FROM products WHERE id = ?',
      [targetId],
    );
    if (!source || !target) {
      throw new Error('Source or target product not found');
    }

    await db.runAsync('BEGIN');
    try {
      // Decide winning macros.
      const sourceHasMacros =
        source.cal_per_basis != null || source.protein_per_basis != null ||
        source.carbs_per_basis != null || source.fat_per_basis != null;
      const targetHasMacros =
        target.cal_per_basis != null || target.protein_per_basis != null ||
        target.carbs_per_basis != null || target.fat_per_basis != null;

      const useSourceMacros =
        sourceHasMacros &&
        (!targetHasMacros || source.updated_at >= target.updated_at);

      if (useSourceMacros) {
        await db.runAsync(
          `UPDATE products
           SET basis = ?, cal_per_basis = ?, protein_per_basis = ?,
               carbs_per_basis = ?, fat_per_basis = ?, updated_at = ?
           WHERE id = ?`,
          [source.basis,
           source.cal_per_basis, source.protein_per_basis,
           source.carbs_per_basis, source.fat_per_basis,
           new Date().toISOString(), targetId],
        );
      }

      await db.runAsync(
        'UPDATE purchase_history SET product_id = ? WHERE product_id = ?',
        [targetId, sourceId],
      );

      const affectedRecipes = await db.getAllAsync<{ id: string; ingredients_json: string }>(
        `SELECT DISTINCT r.id, r.ingredients_json
         FROM recipes r, json_each(r.ingredients_json) ing
         WHERE json_extract(ing.value, '$.product_id') = ?`,
        [sourceId],
      );
      for (const r of affectedRecipes) {
        const ingredients = JSON.parse(r.ingredients_json);
        const next = ingredients.map((ing: any) => {
          if (ing.product_id === sourceId) {
            return { ...ing, product_id: targetId };
          }
          return ing;
        });
        await db.runAsync(
          'UPDATE recipes SET ingredients_json = ? WHERE id = ?',
          [JSON.stringify(next), r.id],
        );
      }

      await db.runAsync('DELETE FROM products WHERE id = ?', [sourceId]);
      await db.runAsync('COMMIT');
    } catch (e) {
      await db.runAsync('ROLLBACK');
      throw e;
    }
  }, [db]);
```

Then update the `return` statement:

```ts
return { upsert, getById, getByKey, getNutritionForIngredients, getAll, deleteProduct, mergeProduct };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/hooks/useProducts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/useProducts.ts __tests__/hooks/useProducts.test.ts
git commit -m "feat(useProducts): getAll, deleteProduct, mergeProduct with json_each-driven recipe rewrites"
```

---

## Task 6: `useCatalog` hook + tests

**Files:**
- Create: `hooks/useCatalog.ts`
- Create: `__tests__/hooks/useCatalog.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/hooks/useCatalog.test.ts
import { renderHook, waitFor } from '@testing-library/react-native';
import { useCatalog } from '../../hooks/useCatalog';

const mockDb = {
  getAllAsync: jest.fn(),
  getFirstAsync: jest.fn(),
};

jest.mock('../../providers/DatabaseProvider', () => ({
  useDb: () => mockDb,
  usePlanVersion: () => ({ planVersion: 0 }),
}));

beforeEach(() => {
  mockDb.getAllAsync.mockReset();
  mockDb.getFirstAsync.mockReset();
});

function mockQueries({ products = [], latest = [], recipeRefs = [] }: {
  products?: any[]; latest?: any[]; recipeRefs?: any[];
}) {
  mockDb.getAllAsync.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM products p')) return products;
    if (sql.includes('FROM purchase_history ph') && sql.includes('latest_per_product')) return latest;
    if (sql.includes('json_each')) return recipeRefs;
    return [];
  });
}

describe('useCatalog', () => {
  it('returns empty rows and zero counts on an empty catalog', async () => {
    mockQueries({});
    const { result } = renderHook(() => useCatalog());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toEqual([]);
    expect(result.current.counts).toEqual({ missingNutrition: 0, unused: 0, duplicates: 0, total: 0 });
  });

  it('flags missing_nutrition only when recipe_count > 0 AND all macros null', async () => {
    mockQueries({
      products: [
        { id: 'p1', brand: 'A', product_name: 'X', item_name: 'foo', basis: 'per_100g',
          cal_per_basis: null, protein_per_basis: null, carbs_per_basis: null, fat_per_basis: null,
          updated_at: '2026-01-01T00:00:00Z', purchase_count: 0, latest_purchased_at: null,
          last_used_at: '2026-01-01T00:00:00Z' },
      ],
      recipeRefs: [{ product_id: 'p1', recipe_count: 2 }],
    });
    const { result } = renderHook(() => useCatalog());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows[0].issue).toBe('missing_nutrition');
    expect(result.current.counts.missingNutrition).toBe(1);
  });

  it('flags unused when no purchases AND no recipe references', async () => {
    mockQueries({
      products: [
        { id: 'p1', brand: 'A', product_name: 'X', item_name: 'foo', basis: 'per_100g',
          cal_per_basis: 100, protein_per_basis: 10, carbs_per_basis: 0, fat_per_basis: 1,
          updated_at: '2026-01-01T00:00:00Z', purchase_count: 0, latest_purchased_at: null,
          last_used_at: '2026-01-01T00:00:00Z' },
      ],
      recipeRefs: [],
    });
    const { result } = renderHook(() => useCatalog());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows[0].issue).toBe('unused');
    expect(result.current.counts.unused).toBe(1);
  });

  it('flags duplicates and gives counts of unique products in the cluster', async () => {
    mockQueries({
      products: [
        { id: '1', brand: 'Coles', product_name: 'Chicken Breast Fillet', item_name: 'chicken breast',
          basis: 'per_100g', cal_per_basis: 165, protein_per_basis: 31, carbs_per_basis: 0, fat_per_basis: 3.6,
          updated_at: '2026-01-01T00:00:00Z', purchase_count: 1, latest_purchased_at: '2026-01-01T00:00:00Z',
          last_used_at: '2026-01-01T00:00:00Z' },
        { id: '2', brand: 'Coles', product_name: 'Chicken Breast Fillets', item_name: 'chicken breast',
          basis: 'per_100g', cal_per_basis: 165, protein_per_basis: 31, carbs_per_basis: 0, fat_per_basis: 3.6,
          updated_at: '2026-02-01T00:00:00Z', purchase_count: 1, latest_purchased_at: '2026-02-01T00:00:00Z',
          last_used_at: '2026-02-01T00:00:00Z' },
      ],
    });
    const { result } = renderHook(() => useCatalog());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows.every(r => r.issue === 'duplicate')).toBe(true);
    expect(result.current.counts.duplicates).toBe(2);
    expect(result.current.rows[0].duplicate_of).toBeDefined();
  });

  it('sorts rows by last_used_at descending', async () => {
    mockQueries({
      products: [
        { id: '1', brand: 'A', product_name: 'Old', item_name: 'foo', basis: 'per_100g',
          cal_per_basis: 100, protein_per_basis: 10, carbs_per_basis: 0, fat_per_basis: 1,
          updated_at: '2025-01-01T00:00:00Z', purchase_count: 0, latest_purchased_at: null,
          last_used_at: '2025-01-01T00:00:00Z' },
        { id: '2', brand: 'B', product_name: 'New', item_name: 'bar', basis: 'per_100g',
          cal_per_basis: 100, protein_per_basis: 10, carbs_per_basis: 0, fat_per_basis: 1,
          updated_at: '2026-06-01T00:00:00Z', purchase_count: 0, latest_purchased_at: null,
          last_used_at: '2026-06-01T00:00:00Z' },
      ],
    });
    const { result } = renderHook(() => useCatalog());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows.map(r => r.product.id)).toEqual(['2', '1']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/hooks/useCatalog.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the hook**

```ts
// hooks/useCatalog.ts
import { useEffect, useState, useCallback } from 'react';
import { useDb, usePlanVersion } from '../providers/DatabaseProvider';
import { findDuplicateMatches } from '../lib/catalog/findDuplicates';
import type { ProductRow } from '../types/db';

export type CatalogIssue = 'duplicate' | 'missing_nutrition' | 'unused' | null;

export interface CatalogRow {
  product: ProductRow;
  latest: { price: number; chain: string; purchased_at: string; qty: string } | null;
  purchase_count: number;
  recipe_count: number;
  last_used_at: string;
  issue: CatalogIssue;
  duplicate_of?: { id: string; brand: string; product_name: string };
}

export interface CatalogCounts {
  missingNutrition: number;
  unused: number;
  duplicates: number;
  total: number;
}

interface BaseRow extends ProductRow {
  purchase_count: number;
  latest_purchased_at: string | null;
  last_used_at: string;
}

interface LatestRow {
  product_id: string;
  price: number;
  chain: string;
  purchased_at: string;
  qty_amount: number;
  qty_unit: string;
}

function formatQty(amount: number, unit: string): string {
  if (unit === 'units') return amount === 1 ? '1 unit' : `${amount} units`;
  return `${amount}${unit}`;
}

function hasAnyMacro(p: ProductRow): boolean {
  return p.cal_per_basis != null || p.protein_per_basis != null ||
         p.carbs_per_basis != null || p.fat_per_basis != null;
}

export function useCatalog(): {
  rows: CatalogRow[];
  counts: CatalogCounts;
  loading: boolean;
  reload: () => void;
} {
  const db = useDb();
  const { planVersion } = usePlanVersion();
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [counts, setCounts] = useState<CatalogCounts>({
    missingNutrition: 0, unused: 0, duplicates: 0, total: 0,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    const base = await db.getAllAsync<BaseRow>(
      `SELECT
         p.*,
         COUNT(DISTINCT ph.id) AS purchase_count,
         MAX(ph.purchased_at) AS latest_purchased_at,
         COALESCE(MAX(ph.purchased_at), p.updated_at) AS last_used_at
       FROM products p
       LEFT JOIN purchase_history ph
         ON ph.product_id = p.id AND ph.status = 'confirmed'
       GROUP BY p.id`,
    );

    let latestByProduct: Map<string, LatestRow> = new Map();
    if (base.length > 0) {
      const latest = await db.getAllAsync<LatestRow>(
        `WITH latest_per_product AS (
           SELECT product_id, MAX(purchased_at) AS purchased_at
           FROM purchase_history
           WHERE status = 'confirmed' AND product_id IS NOT NULL
           GROUP BY product_id
         )
         SELECT ph.product_id, ph.price, s.chain, ph.purchased_at,
                ph.qty_amount, ph.qty_unit
         FROM purchase_history ph
         JOIN latest_per_product lp
           ON lp.product_id = ph.product_id AND lp.purchased_at = ph.purchased_at
         JOIN stores s ON s.id = ph.store_id
         WHERE ph.status = 'confirmed'`,
      );
      latestByProduct = new Map(latest.map(l => [l.product_id, l]));
    }

    const recipeRefs = await db.getAllAsync<{ product_id: string; recipe_count: number }>(
      `SELECT json_extract(ing.value, '$.product_id') AS product_id,
              COUNT(DISTINCT r.id) AS recipe_count
       FROM recipes r, json_each(r.ingredients_json) ing
       WHERE json_extract(ing.value, '$.product_id') IS NOT NULL
       GROUP BY product_id`,
    );
    const recipeCountById = new Map(recipeRefs.map(r => [r.product_id, r.recipe_count]));

    const products: ProductRow[] = base.map(r => ({
      id: r.id, brand: r.brand, product_name: r.product_name, item_name: r.item_name,
      basis: r.basis, cal_per_basis: r.cal_per_basis,
      protein_per_basis: r.protein_per_basis, carbs_per_basis: r.carbs_per_basis,
      fat_per_basis: r.fat_per_basis, updated_at: r.updated_at,
    }));

    const duplicates = findDuplicateMatches(products);

    const out: CatalogRow[] = base.map(r => {
      const product = products.find(p => p.id === r.id)!;
      const purchase_count = r.purchase_count;
      const recipe_count = recipeCountById.get(r.id) ?? 0;
      const dup = duplicates.get(r.id);

      let issue: CatalogIssue = null;
      if (dup) issue = 'duplicate';
      else if (!hasAnyMacro(product) && recipe_count > 0) issue = 'missing_nutrition';
      else if (purchase_count === 0 && recipe_count === 0) issue = 'unused';

      const latest = latestByProduct.get(r.id);
      const latestRecord = latest
        ? {
            price: latest.price,
            chain: latest.chain,
            purchased_at: latest.purchased_at,
            qty: formatQty(latest.qty_amount, latest.qty_unit),
          }
        : null;

      const row: CatalogRow = {
        product,
        latest: latestRecord,
        purchase_count,
        recipe_count,
        last_used_at: r.last_used_at,
        issue,
      };
      if (dup) {
        row.duplicate_of = {
          id: dup.twin.id,
          brand: dup.twin.brand,
          product_name: dup.twin.product_name,
        };
      }
      return row;
    }).sort((a, b) => b.last_used_at.localeCompare(a.last_used_at));

    const nextCounts: CatalogCounts = {
      missingNutrition: out.filter(r => r.issue === 'missing_nutrition').length,
      unused: out.filter(r => r.issue === 'unused').length,
      duplicates: out.filter(r => r.issue === 'duplicate').length,
      total: out.length,
    };

    setRows(out);
    setCounts(nextCounts);
    setLoading(false);
  }, [db]);

  useEffect(() => { load(); }, [load, planVersion]);

  return { rows, counts, loading, reload: load };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/hooks/useCatalog.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/useCatalog.ts __tests__/hooks/useCatalog.test.ts
git commit -m "feat(useCatalog): hook with audit-issue assignment, last-used sort, recipe-ref aggregation"
```

---

## Task 7: `CatalogRow` component + tests

**Files:**
- Create: `components/CatalogRow.tsx`
- Create: `__tests__/components/CatalogRow.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// __tests__/components/CatalogRow.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CatalogRow } from '../../components/CatalogRow';
import type { CatalogRow as CatalogRowData } from '../../hooks/useCatalog';

function makeRow(overrides: Partial<CatalogRowData> = {}): CatalogRowData {
  return {
    product: {
      id: 'p1', brand: 'Coles', product_name: 'Chicken Breast Fillets', item_name: 'chicken breast',
      basis: 'per_100g',
      cal_per_basis: 165, protein_per_basis: 31, carbs_per_basis: 0, fat_per_basis: 3.6,
      updated_at: '2026-01-01T00:00:00Z',
    },
    latest: { price: 12.50, chain: 'Coles', purchased_at: '2026-05-25T00:00:00Z', qty: '500g' },
    purchase_count: 4,
    recipe_count: 2,
    last_used_at: '2026-05-25T00:00:00Z',
    issue: null,
    ...overrides,
  };
}

describe('CatalogRow — clean', () => {
  it('renders title with brand + product_name', () => {
    const { getByText } = render(<CatalogRow row={makeRow()} onPress={jest.fn()} />);
    expect(getByText(/Coles Chicken Breast Fillets/)).toBeTruthy();
  });

  it('renders "· generic" suffix when brand is empty', () => {
    const row = makeRow({ product: { ...makeRow().product, brand: '' } });
    const { getByText } = render(<CatalogRow row={row} onPress={jest.fn()} />);
    expect(getByText(/generic/i)).toBeTruthy();
  });

  it('renders price in the tail', () => {
    const { getByText } = render(<CatalogRow row={makeRow()} onPress={jest.fn()} />);
    expect(getByText(/\$12\.50/)).toBeTruthy();
  });

  it('fires onPress with the product id', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(<CatalogRow row={makeRow()} onPress={onPress} />);
    fireEvent.press(getByLabelText(/Coles Chicken Breast Fillets/));
    expect(onPress).toHaveBeenCalledWith('p1');
  });
});

describe('CatalogRow — issue variants', () => {
  it('renders missing nutrition hint', () => {
    const row = makeRow({ issue: 'missing_nutrition', recipe_count: 2 });
    const { getByText } = render(<CatalogRow row={row} onPress={jest.fn()} />);
    expect(getByText(/No nutrition on file/)).toBeTruthy();
    expect(getByText(/used in 2 recipes/)).toBeTruthy();
  });

  it('renders unused hint', () => {
    const row = makeRow({ issue: 'unused', purchase_count: 0, recipe_count: 0, latest: null });
    const { getByText } = render(<CatalogRow row={row} onPress={jest.fn()} />);
    expect(getByText(/Unused/)).toBeTruthy();
  });

  it('renders duplicate hint with twin product_name', () => {
    const row = makeRow({
      issue: 'duplicate',
      duplicate_of: { id: 'p2', brand: 'Coles', product_name: 'Chicken Breast Fillet' },
    });
    const { getByText } = render(<CatalogRow row={row} onPress={jest.fn()} />);
    expect(getByText(/Looks like a duplicate/)).toBeTruthy();
    expect(getByText(/Chicken Breast Fillet/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/components/CatalogRow.test.tsx`
Expected: FAIL — component not defined.

- [ ] **Step 3: Implement the component**

```tsx
// components/CatalogRow.tsx
import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './ui/AppText';
import { colors, spacing, radius } from '../constants/tokens';
import { formatPrice, formatRelativeTime } from '../lib/format';
import type { CatalogRow as CatalogRowData } from '../hooks/useCatalog';

interface Props {
  row: CatalogRowData;
  onPress: (productId: string) => void;
  now?: number;
}

export function CatalogRow({ row, onPress, now }: Props) {
  const ts = now ?? Date.now();
  const isProblem = row.issue !== null;
  const isGeneric = row.product.brand === '';
  const titleText = isGeneric
    ? row.product.product_name
    : `${row.product.brand} ${row.product.product_name}`;
  const accessibilityLabel = titleText;

  return (
    <TouchableOpacity
      style={[styles.row, isProblem && styles.rowDim]}
      onPress={() => onPress(row.product.id)}
      accessibilityLabel={accessibilityLabel}
      activeOpacity={0.7}
    >
      <View style={styles.main}>
        <View style={styles.titleRow}>
          <AppText weight="bold" size="md" color="textPrimary" numberOfLines={1} style={styles.titleText}>
            {titleText}
          </AppText>
          {isGeneric && (
            <AppText weight="semibold" size="2xs" color="textTertiary" style={styles.genericTag}>
              · generic
            </AppText>
          )}
        </View>
        {row.issue === 'duplicate' && row.duplicate_of && (
          <View style={styles.issueLine}>
            <Ionicons name="alert-circle-outline" size={12} color={colors.terracotta} style={styles.issueIcon} />
            <AppText weight="semibold" size="sm" color="terracotta">
              Looks like a duplicate of <AppText weight="bold" size="sm" color="terracotta">{row.duplicate_of.product_name}</AppText>
            </AppText>
          </View>
        )}
        {row.issue === 'missing_nutrition' && (
          <View style={styles.issueLine}>
            <Ionicons name="alert-circle-outline" size={12} color={colors.terracotta} style={styles.issueIcon} />
            <AppText weight="semibold" size="sm" color="terracotta">No nutrition on file</AppText>
          </View>
        )}
        {row.issue === 'unused' && (
          <View style={styles.issueLine}>
            <Ionicons name="alert-circle-outline" size={12} color={colors.terracotta} style={styles.issueIcon} />
            <AppText weight="semibold" size="sm" color="terracotta">Unused — never purchased or referenced</AppText>
          </View>
        )}
        {!row.issue && row.latest && (
          <AppText weight="medium" size="sm" color="textTertiary" numberOfLines={1} style={styles.metaLine}>
            {`${row.latest.chain} · ${formatRelativeTime(row.latest.purchased_at, ts)} · ${row.latest.qty}`}
          </AppText>
        )}
        {!row.issue && !row.latest && (
          <AppText weight="medium" size="sm" color="textTertiary" style={styles.metaLine}>
            No purchases yet
          </AppText>
        )}
      </View>
      <View style={styles.tail}>
        {!row.issue && row.latest && (
          <AppText weight="extrabold" size="md" color="orange">{formatPrice(row.latest.price)}</AppText>
        )}
        {row.issue === 'missing_nutrition' && (
          <AppText weight="semibold" size="sm" color="textTertiary">
            {row.recipe_count === 1 ? 'used in 1 recipe' : `used in ${row.recipe_count} recipes`}
          </AppText>
        )}
        {row.issue === 'duplicate' && (
          <AppText weight="semibold" size="sm" color="textTertiary">
            {row.purchase_count === 1 ? '1 purchase' : `${row.purchase_count} purchases`}
          </AppText>
        )}
        {row.issue === 'unused' && (
          <AppText weight="semibold" size="sm" color="textTertiary">—</AppText>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3] + 2,
    marginBottom: spacing[2],
  },
  rowDim: { opacity: 0.7 },
  main: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[1] },
  titleText: { flexShrink: 1 },
  genericTag: { flexShrink: 0 },
  issueLine: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  issueIcon: { marginRight: 4 },
  metaLine: { marginTop: 3 },
  tail: { alignItems: 'flex-end' },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/components/CatalogRow.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/CatalogRow.tsx __tests__/components/CatalogRow.test.tsx
git commit -m "feat(CatalogRow): clean + issue variants with subtle dimmed hint"
```

---

## Task 8: `MergeProductSheet` component + tests

**Files:**
- Create: `components/MergeProductSheet.tsx`
- Create: `__tests__/components/MergeProductSheet.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// __tests__/components/MergeProductSheet.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { MergeProductSheet } from '../../components/MergeProductSheet';
import type { ProductRow } from '../../types/db';

const SOURCE: ProductRow = {
  id: 'src', brand: 'Coles', product_name: 'Chicken Breast Fillet', item_name: 'chicken breast',
  basis: 'per_100g',
  cal_per_basis: 165, protein_per_basis: 31, carbs_per_basis: 0, fat_per_basis: 3.6,
  updated_at: '2026-05-01T00:00:00Z',
};
const TWIN: ProductRow = {
  ...SOURCE, id: 'twin', product_name: 'Chicken Breast Fillets',
};
const OTHER: ProductRow = {
  id: 'other', brand: 'Macro', product_name: 'Free Range', item_name: 'chicken breast',
  basis: 'per_100g',
  cal_per_basis: null, protein_per_basis: null, carbs_per_basis: null, fat_per_basis: null,
  updated_at: '2026-05-01T00:00:00Z',
};
const UNRELATED: ProductRow = {
  id: 'eggs', brand: 'Coles', product_name: 'Eggs', item_name: 'eggs',
  basis: 'per_unit',
  cal_per_basis: 70, protein_per_basis: 6, carbs_per_basis: 0, fat_per_basis: 5,
  updated_at: '2026-05-01T00:00:00Z',
};

describe('MergeProductSheet', () => {
  it('surfaces the fuzzy twin as the suggested match', () => {
    const { getByText } = render(
      <MergeProductSheet
        visible={true}
        source={SOURCE}
        candidates={[TWIN, OTHER, UNRELATED]}
        onClose={jest.fn()}
        onMerge={jest.fn()}
      />,
    );
    expect(getByText(/Suggested match/i)).toBeTruthy();
    expect(getByText(/Chicken Breast Fillets/)).toBeTruthy();
  });

  it('omits the source from the candidate list', () => {
    const { queryByText } = render(
      <MergeProductSheet
        visible={true}
        source={SOURCE}
        candidates={[SOURCE, TWIN, OTHER]}
        onClose={jest.fn()}
        onMerge={jest.fn()}
      />,
    );
    // SOURCE.product_name should not appear in the candidates list (only in the header)
    const sourceMatches = queryByText('Chicken Breast Fillet');
    // It appears in the header but not as a tappable candidate row — the picker filters self out.
    expect(sourceMatches).toBeNull();
  });

  it('confirms via destructive Alert before invoking onMerge', () => {
    const onMerge = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert');
    alertSpy.mockImplementation((_title, _msg, buttons) => {
      const mergeBtn = buttons?.find(b => b.text === 'Merge');
      mergeBtn?.onPress?.();
    });

    const { getByText } = render(
      <MergeProductSheet
        visible={true}
        source={SOURCE}
        candidates={[TWIN]}
        onClose={jest.fn()}
        onMerge={onMerge}
      />,
    );
    fireEvent.press(getByText(/Chicken Breast Fillets/));
    expect(alertSpy).toHaveBeenCalled();
    expect(onMerge).toHaveBeenCalledWith('twin');
    alertSpy.mockRestore();
  });

  it('search field filters candidate list by substring', () => {
    const { getByPlaceholderText, queryByText } = render(
      <MergeProductSheet
        visible={true}
        source={SOURCE}
        candidates={[TWIN, OTHER, UNRELATED]}
        onClose={jest.fn()}
        onMerge={jest.fn()}
      />,
    );
    fireEvent.changeText(getByPlaceholderText(/Search/i), 'eggs');
    // Eggs row should still be visible; the chicken rows should be filtered out
    expect(queryByText('Eggs')).toBeTruthy();
    expect(queryByText('Chicken Breast Fillets')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/components/MergeProductSheet.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the sheet**

```tsx
// components/MergeProductSheet.tsx
import React, { useMemo, useState } from 'react';
import { Alert, Modal, StyleSheet, TextInput, TouchableOpacity, View, FlatList } from 'react-native';
import { KeyboardAvoidingView, KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './ui/AppText';
import { colors, font, radius, spacing } from '../constants/tokens';
import { findDuplicateMatches } from '../lib/catalog/findDuplicates';
import type { ProductRow } from '../types/db';

interface Props {
  visible: boolean;
  source: ProductRow;
  candidates: ProductRow[];   // all other products (already excludes source, OR we filter here defensively)
  onClose: () => void;
  onMerge: (targetId: string) => void;
}

function labelFor(p: ProductRow): string {
  return p.brand ? `${p.brand} ${p.product_name}` : p.product_name;
}

export function MergeProductSheet({ visible, source, candidates, onClose, onMerge }: Props) {
  const [query, setQuery] = useState('');

  const targets = useMemo(
    () => candidates.filter(c => c.id !== source.id),
    [candidates, source.id],
  );

  const suggested = useMemo(() => {
    const matches = findDuplicateMatches([source, ...targets]);
    return matches.get(source.id)?.twin ?? null;
  }, [source, targets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return targets;
    return targets.filter(c =>
      c.brand.toLowerCase().includes(q) ||
      c.product_name.toLowerCase().includes(q) ||
      c.item_name.toLowerCase().includes(q),
    );
  }, [targets, query]);

  function confirmAndMerge(target: ProductRow) {
    Alert.alert(
      `Merge "${labelFor(source)}" into "${labelFor(target)}"?`,
      "This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Merge', style: 'destructive', onPress: () => onMerge(target.id) },
      ],
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <KeyboardAwareScrollView keyboardShouldPersistTaps="handled">
            <AppText weight="extrabold" size="xl" color="textPrimary" style={styles.title}>
              Merge into…
            </AppText>
            <AppText weight="medium" size="sm" color="textTertiary" style={styles.subtitle}>
              Pick the product to keep. All references and purchases of <AppText weight="bold" size="sm" color="textPrimary">{labelFor(source)}</AppText> will be re-targeted, then it'll be deleted.
            </AppText>

            {suggested && (
              <View>
                <AppText weight="bold" size="xs" color="terracotta" style={styles.sectionLabel}>
                  SUGGESTED MATCH
                </AppText>
                <TouchableOpacity
                  style={styles.suggested}
                  onPress={() => confirmAndMerge(suggested)}
                  activeOpacity={0.85}
                >
                  <View style={{ flex: 1 }}>
                    <AppText weight="bold" size="md" color="textPrimary">{labelFor(suggested)}</AppText>
                    <AppText weight="medium" size="sm" color="textTertiary">{suggested.item_name}</AppText>
                  </View>
                  <Ionicons name="arrow-forward" size={18} color={colors.green} />
                </TouchableOpacity>
              </View>
            )}

            <AppText weight="bold" size="xs" color="terracotta" style={styles.sectionLabel}>
              ALL PRODUCTS
            </AppText>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color={colors.textTertiary} style={{ marginRight: 6 }} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search products"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
            {filtered.map(target => (
              <TouchableOpacity
                key={target.id}
                style={styles.row}
                onPress={() => confirmAndMerge(target)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <AppText weight="semibold" size="md" color="textPrimary">{labelFor(target)}</AppText>
                  <AppText weight="medium" size="sm" color="textTertiary">{target.item_name}</AppText>
                </View>
              </TouchableOpacity>
            ))}
          </KeyboardAwareScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[8],
    maxHeight: '80%',
  },
  handle: {
    width: 36, height: 4, borderRadius: radius.xs,
    backgroundColor: colors.divider,
    alignSelf: 'center', marginVertical: spacing[3],
  },
  title: { marginBottom: spacing[2] },
  subtitle: { marginBottom: spacing[4], lineHeight: 18 },
  sectionLabel: { letterSpacing: font.tracking.category, marginBottom: spacing[2], marginTop: spacing[2] },
  suggested: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: colors.cream, borderRadius: radius.md,
    padding: spacing[3], marginBottom: spacing[3],
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.cream, borderRadius: radius.full,
    paddingHorizontal: spacing[3], minHeight: 40, marginBottom: spacing[3],
  },
  searchInput: {
    flex: 1, fontFamily: font.family.semibold, fontSize: font.size.md,
    color: colors.textPrimary, padding: 0,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/components/MergeProductSheet.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/MergeProductSheet.tsx __tests__/components/MergeProductSheet.test.tsx
git commit -m "feat(MergeProductSheet): suggested-match + search picker with destructive confirmation"
```

---

## Task 9: Catalog landing screen + tests

**Files:**
- Create: `app/(tabs)/catalog.tsx`
- Create: `__tests__/screens/catalog.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// __tests__/screens/catalog.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

const mockCatalogState = {
  current: {
    rows: [] as any[],
    counts: { missingNutrition: 0, unused: 0, duplicates: 0, total: 0 },
    loading: false,
  },
};

jest.mock('../../hooks/useCatalog', () => ({
  useCatalog: () => ({ ...mockCatalogState.current, reload: jest.fn() }),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void) => cb(),
}));

import CatalogScreen from '../../app/(tabs)/catalog';

beforeEach(() => {
  mockCatalogState.current = {
    rows: [],
    counts: { missingNutrition: 0, unused: 0, duplicates: 0, total: 0 },
    loading: false,
  };
});

function makeRow(overrides: any) {
  return {
    product: {
      id: 'p1', brand: 'Coles', product_name: 'Chicken Breast Fillets', item_name: 'chicken breast',
      basis: 'per_100g',
      cal_per_basis: 165, protein_per_basis: 31, carbs_per_basis: 0, fat_per_basis: 3.6,
      updated_at: '2026-05-01T00:00:00Z',
      ...overrides.product,
    },
    latest: { price: 12.50, chain: 'Coles', purchased_at: '2026-05-25T00:00:00Z', qty: '500g' },
    purchase_count: 4,
    recipe_count: 2,
    last_used_at: '2026-05-25T00:00:00Z',
    issue: null,
    ...overrides,
  };
}

describe('CatalogScreen', () => {
  it('renders the empty state when catalog is empty', () => {
    const { getByText } = render(<CatalogScreen />);
    expect(getByText(/No products yet/i)).toBeTruthy();
  });

  it('shows the header total and audit chips', () => {
    mockCatalogState.current = {
      rows: [makeRow({})],
      counts: { missingNutrition: 1, unused: 2, duplicates: 0, total: 5 },
      loading: false,
    };
    const { getByText } = render(<CatalogScreen />);
    expect(getByText(/CATALOG · 5/)).toBeTruthy();
    expect(getByText(/Missing nutrition/)).toBeTruthy();
    expect(getByText(/Unused/)).toBeTruthy();
  });

  it('filters list when an audit chip is tapped', () => {
    const clean = makeRow({ product: { id: 'a', brand: 'A', product_name: 'A1', item_name: 'a' } });
    const dirty = makeRow({
      product: { id: 'b', brand: 'B', product_name: 'B1', item_name: 'b' },
      issue: 'unused', purchase_count: 0, recipe_count: 0, latest: null,
    });
    mockCatalogState.current = {
      rows: [clean, dirty],
      counts: { missingNutrition: 0, unused: 1, duplicates: 0, total: 2 },
      loading: false,
    };
    const { getByText, queryByText } = render(<CatalogScreen />);
    expect(queryByText(/A A1/)).toBeTruthy();
    expect(queryByText(/B B1/)).toBeTruthy();
    fireEvent.press(getByText(/Unused/));
    expect(queryByText(/A A1/)).toBeNull();
    expect(queryByText(/B B1/)).toBeTruthy();
  });

  it('filters list when search text is entered', () => {
    mockCatalogState.current = {
      rows: [
        makeRow({ product: { id: '1', brand: 'Coles', product_name: 'Chicken Breast Fillets', item_name: 'chicken breast' } }),
        makeRow({ product: { id: '2', brand: 'Vitasoy', product_name: 'Oat Milk', item_name: 'oat milk' } }),
      ],
      counts: { missingNutrition: 0, unused: 0, duplicates: 0, total: 2 },
      loading: false,
    };
    const { getByPlaceholderText, queryByText } = render(<CatalogScreen />);
    fireEvent.changeText(getByPlaceholderText(/Search/i), 'oat');
    expect(queryByText(/Oat Milk/)).toBeTruthy();
    expect(queryByText(/Chicken Breast Fillets/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/screens/catalog.test.tsx`
Expected: FAIL — screen module not found.

- [ ] **Step 3: Implement the screen**

```tsx
// app/(tabs)/catalog.tsx
import { useMemo, useState } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GreenHeader } from '../../components/ui/GreenHeader';
import { AppText } from '../../components/ui/AppText';
import { CatalogRow } from '../../components/CatalogRow';
import { useCatalog } from '../../hooks/useCatalog';
import { colors, font, radius, spacing } from '../../constants/tokens';

type ActiveChip = 'missing_nutrition' | 'unused' | 'duplicate' | null;

export default function CatalogScreen() {
  const insets = useSafeAreaInsets();
  const { rows, counts, loading } = useCatalog();
  const [query, setQuery] = useState('');
  const [activeChip, setActiveChip] = useState<ActiveChip>(null);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      if (activeChip && r.issue !== activeChip) return false;
      if (!q) return true;
      const p = r.product;
      return (
        p.brand.toLowerCase().includes(q) ||
        p.product_name.toLowerCase().includes(q) ||
        p.item_name.toLowerCase().includes(q)
      );
    });
  }, [rows, query, activeChip]);

  const liveCounts = useMemo(() => {
    if (!query.trim()) return counts;
    const q = query.trim().toLowerCase();
    const matching = rows.filter(r => {
      const p = r.product;
      return (
        p.brand.toLowerCase().includes(q) ||
        p.product_name.toLowerCase().includes(q) ||
        p.item_name.toLowerCase().includes(q)
      );
    });
    return {
      missingNutrition: matching.filter(r => r.issue === 'missing_nutrition').length,
      unused: matching.filter(r => r.issue === 'unused').length,
      duplicates: matching.filter(r => r.issue === 'duplicate').length,
      total: matching.length,
    };
  }, [rows, query, counts]);

  const onPress = (productId: string) => {
    router.push(`/catalog/${productId}`);
  };

  return (
    <View style={styles.outer}>
      <GreenHeader>
        <AppText weight="extrabold" size="3xl" color="onGreen">Catalog · {counts.total}</AppText>
      </GreenHeader>

      <ScrollView
        style={[styles.scroll, { paddingTop: spacing[3] }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[6] }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.textTertiary} style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search products"
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Search products"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {(liveCounts.missingNutrition + liveCounts.unused + liveCounts.duplicates === 0) ? (
          <AppText weight="medium" size="sm" color="textTertiary" style={styles.cleanMsg}>
            Catalog clean — no issues to address.
          </AppText>
        ) : (
          <View style={styles.chipRow}>
            <ChipPill
              label="Missing nutrition"
              count={liveCounts.missingNutrition}
              active={activeChip === 'missing_nutrition'}
              onPress={() => setActiveChip(activeChip === 'missing_nutrition' ? null : 'missing_nutrition')}
            />
            <ChipPill
              label="Unused"
              count={liveCounts.unused}
              active={activeChip === 'unused'}
              onPress={() => setActiveChip(activeChip === 'unused' ? null : 'unused')}
            />
            <ChipPill
              label="Possible duplicates"
              count={liveCounts.duplicates}
              active={activeChip === 'duplicate'}
              onPress={() => setActiveChip(activeChip === 'duplicate' ? null : 'duplicate')}
            />
          </View>
        )}

        <AppText weight="bold" size="xs" color="terracotta" style={styles.sectionLabel}>
          {activeChip ? sectionLabelForChip(activeChip) : 'ALL PRODUCTS'} · {filteredRows.length}
        </AppText>

        {rows.length === 0 && !loading && (
          <View style={styles.emptyContainer}>
            <AppText weight="bold" size="lg" color="textPrimary">No products yet.</AppText>
            <AppText weight="medium" size="sm" color="textTertiary" style={styles.emptySubtitle}>
              Tag an ingredient or log a shop purchase to start your catalog.
            </AppText>
          </View>
        )}

        {filteredRows.map(row => (
          <CatalogRow key={row.product.id} row={row} onPress={onPress} />
        ))}
      </ScrollView>
    </View>
  );
}

function ChipPill({ label, count, active, onPress }: {
  label: string; count: number; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      activeOpacity={0.85}
    >
      <AppText weight="bold" size="xs" color={active ? 'onTerracotta' : 'terracotta'}>
        {label}
      </AppText>
      <View style={[styles.chipCount, active && styles.chipCountActive]}>
        <AppText weight="extrabold" size="2xs" color={active ? 'terracotta' : 'onTerracotta'}>
          {count}
        </AppText>
      </View>
    </TouchableOpacity>
  );
}

function sectionLabelForChip(chip: ActiveChip): string {
  switch (chip) {
    case 'missing_nutrition': return 'MISSING NUTRITION';
    case 'unused': return 'UNUSED';
    case 'duplicate': return 'POSSIBLE DUPLICATES';
    default: return 'ALL PRODUCTS';
  }
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: colors.cream },
  scroll: { flex: 1, paddingHorizontal: spacing[3] },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radius.full,
    paddingHorizontal: spacing[3], minHeight: 40,
    marginBottom: spacing[3],
  },
  searchInput: {
    flex: 1, fontFamily: font.family.semibold, fontSize: font.size.md,
    color: colors.textPrimary, padding: 0,
  },
  cleanMsg: { textAlign: 'center', paddingVertical: spacing[3] },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[3] },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.chipSurface, borderRadius: radius.full,
    paddingVertical: 6, paddingHorizontal: spacing[3],
    minHeight: 32,
  },
  chipActive: { backgroundColor: colors.terracotta },
  chipCount: {
    backgroundColor: colors.terracotta, borderRadius: radius.full,
    paddingHorizontal: 6, paddingVertical: 1,
    minWidth: 18, alignItems: 'center', justifyContent: 'center',
  },
  chipCountActive: { backgroundColor: colors.cream },
  sectionLabel: { letterSpacing: font.tracking.category, marginBottom: spacing[2] },
  emptyContainer: { alignItems: 'center', paddingVertical: spacing[12] },
  emptySubtitle: { textAlign: 'center', marginTop: spacing[2], paddingHorizontal: spacing[6] },
});
```

Notes on tokens this code assumes exist:
- `colors.chipSurface` — same token used by the existing time-tab chips in PriceHistoryChart.
- `colors.onTerracotta` — should be defined; if it doesn't exist, swap to `colors.cream`. Verify by reading `constants/tokens.ts` during implementation.
- `font.size['3xl']` and `font.size['2xs']` — verify both exist.

- [ ] **Step 4: Verify tokens, run tests**

Run: `grep -E '(chipSurface|onTerracotta|3xl|2xs)' constants/tokens.ts`
If any token is missing, substitute the closest existing token (cream for onTerracotta, etc.) before running tests.

Run: `npx jest __tests__/screens/catalog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/catalog.tsx __tests__/screens/catalog.test.tsx
git commit -m "feat(catalog): landing screen with search + audit chips + product list"
```

---

## Task 10: Catalog detail screen + tests

**Files:**
- Create: `app/catalog/[id].tsx`
- Create: `__tests__/screens/catalog-detail.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// __tests__/screens/catalog-detail.test.tsx
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockProduct = {
  id: 'p1', brand: 'Coles', product_name: 'Chicken Breast Fillets', item_name: 'chicken breast',
  basis: 'per_100g',
  cal_per_basis: 165, protein_per_basis: 31, carbs_per_basis: 0, fat_per_basis: 3.6,
  updated_at: '2026-05-01T00:00:00Z',
};
const mockState: { product: any; recipes: any[]; purchases: any[]; allProducts: any[] } = {
  product: mockProduct,
  recipes: [],
  purchases: [],
  allProducts: [mockProduct],
};

const getByIdMock = jest.fn().mockImplementation(async () => mockState.product);
const getAllMock = jest.fn().mockImplementation(async () => mockState.allProducts);
const deleteProductMock = jest.fn().mockResolvedValue(undefined);
const mergeProductMock = jest.fn().mockResolvedValue(undefined);

jest.mock('../../hooks/useProducts', () => ({
  useProducts: () => ({
    getById: getByIdMock,
    getAll: getAllMock,
    upsert: jest.fn(),
    getByKey: jest.fn(),
    getNutritionForIngredients: jest.fn(),
    deleteProduct: deleteProductMock,
    mergeProduct: mergeProductMock,
  }),
}));

jest.mock('../../hooks/usePurchaseHistory', () => ({
  usePurchaseHistory: () => ({
    records: mockState.purchases,
    pendingRecords: [],
    loading: false,
    reload: jest.fn(),
  }),
}));

jest.mock('../../hooks/useRecipes', () => ({
  useRecipes: () => ({
    recipes: mockState.recipes,
    loading: false,
  }),
}));

jest.mock('../../components/PriceHistoryChart', () => ({
  PriceHistoryChart: () => null,
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ id: 'p1' }),
}));

import CatalogDetailScreen from '../../app/catalog/[id]';

describe('CatalogDetailScreen', () => {
  beforeEach(() => {
    mockState.product = mockProduct;
    mockState.recipes = [];
    mockState.purchases = [];
    mockState.allProducts = [mockProduct];
    getByIdMock.mockClear();
    deleteProductMock.mockClear();
    mergeProductMock.mockClear();
  });

  it('renders the brand and product header', async () => {
    const { findByText } = render(<CatalogDetailScreen />);
    expect(await findByText(/COLES/)).toBeTruthy();
    expect(await findByText(/Chicken Breast Fillets/)).toBeTruthy();
  });

  it('renders "GENERIC" in the header when brand is empty', async () => {
    mockState.product = { ...mockProduct, brand: '' };
    const { findByText } = render(<CatalogDetailScreen />);
    expect(await findByText(/GENERIC/)).toBeTruthy();
  });

  it('renders the four macros from the product row', async () => {
    const { findByText } = render(<CatalogDetailScreen />);
    expect(await findByText('165')).toBeTruthy();
    expect(await findByText('31')).toBeTruthy();
    expect(await findByText('3.6')).toBeTruthy();
  });

  it('renders the empty-nutrition CTA when all macros are null', async () => {
    mockState.product = { ...mockProduct, cal_per_basis: null, protein_per_basis: null, carbs_per_basis: null, fat_per_basis: null };
    const { findByText } = render(<CatalogDetailScreen />);
    expect(await findByText(/No nutrition on file/i)).toBeTruthy();
    expect(await findByText(/Add macros/i)).toBeTruthy();
  });

  it('omits the recipes card when no recipes reference the product', async () => {
    const { queryByText } = render(<CatalogDetailScreen />);
    await waitFor(() => expect(getByIdMock).toHaveBeenCalled());
    expect(queryByText(/USED IN/)).toBeNull();
  });

  it('delete action invokes deleteProduct via destructive Alert', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    alertSpy.mockImplementation((_t, _m, btns) => {
      btns?.find(b => b.text === 'Delete')?.onPress?.();
    });
    const { findByLabelText } = render(<CatalogDetailScreen />);
    const menuBtn = await findByLabelText(/Product actions/i);
    fireEvent.press(menuBtn);
    // simulate action sheet's Delete tap — see implementation for how this is exposed.
    const deleteAction = await findByLabelText(/Delete product/i);
    fireEvent.press(deleteAction);
    await waitFor(() => expect(deleteProductMock).toHaveBeenCalledWith('p1'));
    alertSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/screens/catalog-detail.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the detail screen**

```tsx
// app/catalog/[id].tsx
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../../components/ui/AppText';
import { GreenHeader } from '../../components/ui/GreenHeader';
import { PriceHistoryChart } from '../../components/PriceHistoryChart';
import { IngredientSheet } from '../../components/IngredientSheet';
import { MergeProductSheet } from '../../components/MergeProductSheet';
import { useProducts } from '../../hooks/useProducts';
import { useRecipes } from '../../hooks/useRecipes';
import { usePurchaseHistory } from '../../hooks/usePurchaseHistory';
import { usePlan } from '../../hooks/usePlan';
import { colors, font, radius, spacing } from '../../constants/tokens';
import { formatPrice, formatRelativeTime } from '../../lib/format';
import type { ProductRow } from '../../types/db';
import type { Ingredient } from '../../meal_plan.types';

type MenuAction = 'rename' | 'merge' | 'delete' | null;

export default function CatalogDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getById, getAll, upsert, deleteProduct, mergeProduct } = useProducts();
  const { recipes } = useRecipes();
  const { plan } = usePlan();
  const planId = plan?.row.id ?? null;
  const { records } = usePurchaseHistory(planId);

  const [product, setProduct] = useState<ProductRow | null>(null);
  const [allProducts, setAllProducts] = useState<ProductRow[]>([]);
  const [editVisible, setEditVisible] = useState(false);
  const [mergeVisible, setMergeVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    getById(id).then(setProduct);
    getAll().then(setAllProducts);
  }, [id, getById, getAll]);

  if (!product) {
    return (
      <View style={styles.notFound}>
        <AppText weight="semibold" color="textSecondary">Product not found.</AppText>
      </View>
    );
  }

  const purchasesForProduct = records.filter(r => r.product_id === product.id);

  const recipesUsingProduct = recipes.filter(r =>
    r.ingredients.some(ing => ing.product_id === product.id),
  );

  const hasAnyMacro = product.cal_per_basis != null || product.protein_per_basis != null ||
                      product.carbs_per_basis != null || product.fat_per_basis != null;

  async function handleEditSave({ ingredient, nutrition }: { ingredient: Ingredient; nutrition: any }) {
    if (nutrition) await upsert(nutrition);
    setEditVisible(false);
    const fresh = await getById(id!);
    setProduct(fresh);
  }

  function handleMenuAction(action: MenuAction) {
    setMenuOpen(false);
    if (action === 'rename') setEditVisible(true);
    else if (action === 'merge') setMergeVisible(true);
    else if (action === 'delete') confirmDelete();
  }

  function confirmDelete() {
    if (!product) return;
    Alert.alert(
      `Delete ${product.brand ? `${product.brand} ${product.product_name}` : product.product_name}?`,
      'All references in recipes and purchases will be cleared.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteProduct(product.id);
            router.back();
          },
        },
      ],
    );
  }

  async function handleMerge(targetId: string) {
    if (!product) return;
    await mergeProduct(product.id, targetId);
    setMergeVisible(false);
    router.back();
  }

  const brandLabel = product.brand === '' ? 'GENERIC' : product.brand.toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <GreenHeader>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={22} color={colors.onGreen} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMenuOpen(true)}
            accessibilityLabel="Product actions"
            style={styles.menuBtn}
          >
            <Ionicons name="ellipsis-vertical" size={22} color={colors.onGreen} />
          </TouchableOpacity>
        </View>
        <View style={styles.brandPill}>
          <AppText weight="bold" size="2xs" color="onGreen">{brandLabel}</AppText>
        </View>
        <AppText weight="extrabold" size="2xl" color="onGreen" style={styles.productName}>
          {product.product_name}
        </AppText>
        <AppText weight="medium" size="sm" color="onGreenDim" style={styles.itemName}>
          {product.item_name}
        </AppText>
      </GreenHeader>

      <ScrollView
        contentContainerStyle={{ padding: spacing[3], paddingBottom: insets.bottom + spacing[6] }}
      >
        {/* Nutrition card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <AppText weight="bold" size="xs" color="terracotta" style={styles.cardTitle}>NUTRITION</AppText>
            <TouchableOpacity onPress={() => setEditVisible(true)} accessibilityLabel="Edit nutrition">
              <AppText weight="semibold" size="sm" color="textSecondary">✎ Edit</AppText>
            </TouchableOpacity>
          </View>
          {hasAnyMacro ? (
            <View>
              <View style={styles.macroGrid}>
                <MacroCell label="KCAL" value={product.cal_per_basis} unit="" />
                <MacroCell label="PROTEIN" value={product.protein_per_basis} unit="g" />
                <MacroCell label="CARBS" value={product.carbs_per_basis} unit="g" />
                <MacroCell label="FAT" value={product.fat_per_basis} unit="g" />
              </View>
              <View style={styles.basisPill}>
                <AppText weight="bold" size="2xs" color="terracotta">per {product.basis === 'per_100g' ? '100g' : product.basis === 'per_100mL' ? '100mL' : 'unit'}</AppText>
              </View>
            </View>
          ) : (
            <View style={styles.emptyNutrition}>
              <AppText weight="semibold" size="md" color="textTertiary" style={{ marginBottom: spacing[2] }}>
                No nutrition on file
              </AppText>
              <TouchableOpacity onPress={() => setEditVisible(true)} style={styles.addCta}>
                <AppText weight="bold" size="sm" color="onGreen">Add macros</AppText>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Purchase History card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <AppText weight="bold" size="xs" color="terracotta" style={styles.cardTitle}>
              PURCHASE HISTORY · {purchasesForProduct.length}
            </AppText>
          </View>
          {purchasesForProduct.length > 0 ? (
            <View>
              <PriceHistoryChart itemName={product.item_name} />
              <View style={{ marginTop: spacing[3] }}>
                {purchasesForProduct.slice(0, 5).map(p => (
                  <View key={p.id} style={styles.purchaseRow}>
                    <View style={{ flex: 1 }}>
                      <AppText weight="semibold" size="sm" color="textPrimary">
                        {formatRelativeTime(p.purchased_at)}
                      </AppText>
                      <AppText weight="medium" size="xs" color="textTertiary">
                        {p.brand ?? 'Unknown store'} · {p.qty_amount}{p.qty_unit}
                      </AppText>
                    </View>
                    {p.price != null && (
                      <AppText weight="extrabold" size="md" color="orange">{formatPrice(p.price)}</AppText>
                    )}
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <AppText weight="medium" size="sm" color="textTertiary">No purchases yet.</AppText>
          )}
        </View>

        {/* Used in recipes card */}
        {recipesUsingProduct.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <AppText weight="bold" size="xs" color="terracotta" style={styles.cardTitle}>
                USED IN · {recipesUsingProduct.length} {recipesUsingProduct.length === 1 ? 'RECIPE' : 'RECIPES'}
              </AppText>
            </View>
            {recipesUsingProduct.map(r => (
              <TouchableOpacity
                key={r.id}
                style={styles.recipeRow}
                onPress={() => router.push(`/recipe/${r.id}`)}
              >
                <AppText weight="semibold" size="md" color="textPrimary" style={{ flex: 1 }}>{r.title}</AppText>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Actions menu (simple inline buttons; replace with ActionSheetIOS / bottom sheet if desired) */}
      {menuOpen && (
        <View style={styles.menuOverlay}>
          <TouchableOpacity style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} />
          <View style={styles.menuSheet}>
            <TouchableOpacity
              accessibilityLabel="Rename product"
              style={styles.menuItem}
              onPress={() => handleMenuAction('rename')}
            >
              <AppText weight="semibold" size="md" color="textPrimary">Rename product</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="Merge into another product"
              style={styles.menuItem}
              onPress={() => handleMenuAction('merge')}
            >
              <AppText weight="semibold" size="md" color="textPrimary">Merge into another product</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="Delete product"
              style={styles.menuItem}
              onPress={() => handleMenuAction('delete')}
            >
              <AppText weight="semibold" size="md" color="terracotta">Delete product</AppText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Edit sheet (reuses IngredientSheet) */}
      <IngredientSheet
        visible={editVisible}
        mode="edit"
        initialIngredient={{ item: product.item_name, amount: { kind: 'measured', value: 100, unit: 'g' } }}
        existingEntry={product}
        onSave={handleEditSave}
        onClose={() => setEditVisible(false)}
      />

      {/* Merge sheet */}
      <MergeProductSheet
        visible={mergeVisible}
        source={product}
        candidates={allProducts}
        onClose={() => setMergeVisible(false)}
        onMerge={handleMerge}
      />
    </View>
  );
}

function MacroCell({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <View style={styles.macroCell}>
      <AppText weight="bold" size="2xs" color="textTertiary">{label}</AppText>
      <AppText weight="extrabold" size="xl" color="orange" style={styles.macroValue}>
        {value != null ? String(value) : '—'}
      </AppText>
      {unit && <AppText weight="semibold" size="2xs" color="textTertiary">{unit}</AppText>}
    </View>
  );
}

const styles = StyleSheet.create({
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[2] },
  menuBtn: { padding: spacing[1] },
  brandPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.headerPill,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2] + 2,
    paddingVertical: 2,
    marginBottom: spacing[1],
  },
  productName: { lineHeight: 28 },
  itemName: { marginTop: 2, opacity: 0.85 },
  card: {
    backgroundColor: colors.card, borderRadius: radius.md,
    padding: spacing[3] + 2, marginBottom: spacing[3],
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[2] },
  cardTitle: { letterSpacing: font.tracking.category },
  macroGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  macroCell: { flex: 1, alignItems: 'center' },
  macroValue: { lineHeight: 22 },
  basisPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.cream,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    marginTop: spacing[2],
  },
  emptyNutrition: { alignItems: 'center', paddingVertical: spacing[3] },
  addCta: {
    backgroundColor: colors.green,
    borderRadius: radius.full,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2] + 2,
  },
  purchaseRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  recipeRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing[2] + 2,
  },
  menuOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'flex-end',
  },
  menuBackdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.scrim,
  },
  menuSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingVertical: spacing[2], paddingBottom: spacing[8],
  },
  menuItem: {
    paddingVertical: spacing[3] + 2,
    paddingHorizontal: spacing[4],
  },
});
```

Implementation notes:
- The `onGreenDim` color token may not exist; if absent, substitute `colors.onGreen` with reduced opacity inline (`style={{ opacity: 0.85 }}`).
- The current `usePurchaseHistory` returns rows filtered by `planId` — but the catalog detail wants ALL purchases for this product, not just the active plan's. **This is a real bug** in the sketch above. Fix by adding a method `usePurchaseHistory().reload()` is plan-scoped; for the catalog use case, we want a different query. Pragmatic fix: when implementing, replace `records.filter(r => r.product_id === product.id)` with a direct query using a new `useProducts.getPurchasesForProduct(productId)` method, OR import `usePurchaseHistory` differently. Simplest approach for v1: add a small helper inside this screen that queries `purchase_history` directly via `useDb()` for the product_id — bypassing the planId scoping.

Concrete fix (apply at implementation time):

```ts
// Replace the usePurchaseHistory line with:
import { useDb } from '../../providers/DatabaseProvider';
// ...
const db = useDb();
const [purchasesForProduct, setPurchasesForProduct] = useState<PurchaseHistoryRowWithProduct[]>([]);

useEffect(() => {
  if (!product) return;
  db.getAllAsync<PurchaseHistoryRowWithProduct>(
    `SELECT ph.*, p.brand AS brand, p.product_name AS product_name
     FROM purchase_history ph
     LEFT JOIN products p ON p.id = ph.product_id
     WHERE ph.product_id = ? AND ph.status = 'confirmed'
     ORDER BY ph.purchased_at DESC`,
    [product.id],
  ).then(setPurchasesForProduct);
}, [product, db]);
```

And drop the usePurchaseHistory / usePlan imports.

- [ ] **Step 4: Verify tokens, fix the purchases query**

Run: `grep -E '(onGreenDim|2xl)' constants/tokens.ts`
Substitute missing tokens with the closest existing ones.

Apply the concrete purchase-query fix above.

- [ ] **Step 5: Run tests**

Run: `npx jest __tests__/screens/catalog-detail.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/catalog/\[id\].tsx __tests__/screens/catalog-detail.test.tsx
git commit -m "feat(catalog-detail): full screen with Nutrition / Purchases / Recipes cards + ⋮ menu"
```

---

## Task 11: Add Catalog tab to the tab bar

**Files:**
- Modify: `app/(tabs)/_layout.tsx`

- [ ] **Step 1: Append the new tab**

After the `Tabs.Screen` for `recipes`, add:

```tsx
<Tabs.Screen
  name="catalog"
  options={{
    title: 'Catalog',
    tabBarAccessibilityLabel: 'Catalog',
    tabBarIcon: ({ focused, color }) => (
      <Ionicons name={focused ? 'library' : 'library-outline'} size={22} color={color} />
    ),
  }}
/>
```

- [ ] **Step 2: Run tests + typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

Run: `npx jest`
Expected: full suite passes.

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/_layout.tsx
git commit -m "feat(tabs): add Catalog tab as fourth tab in the tab bar"
```

---

## Task 12: Full verification + manual smoke

- [ ] **Step 1: TypeScript clean**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 2: Full Jest suite**

Run: `npx jest`
Expected: all tests pass (existing + new catalog tests).

- [ ] **Step 3: Manual smoke in the simulator**

Run the app (`npm run start`, then `i` or `a`). Smoke checks:

1. **Catalog tab is visible** in the tab bar.
2. **Empty state** — fresh install shows "No products yet."
3. **Tag an ingredient** in a recipe (from the Recipes tab) → return to Catalog → product appears.
4. **Search** — type in the search field; list filters.
5. **Audit chips** — tap "Missing nutrition" → list filters; tap again → unfilters.
6. **Detail screen** — tap a product → detail loads with header / nutrition / purchases / recipes sections.
7. **Edit nutrition** — tap ✎ Edit on a product, change a macro, save → detail refreshes with new value.
8. **Merge flow** — create two near-duplicate products (e.g. "Chicken Breast Fillet" and "Chicken Breast Fillets"), open one, ⋮ → Merge → confirm the suggested twin → both detail and catalog refresh, source is gone.
9. **Delete flow** — open a product, ⋮ → Delete → confirm → product gone, any recipe references to it now show no nutrition.
10. **Chart change** — open a recipe ingredient's chart — the chart shows lines per (brand, product) within the same item_name.

- [ ] **Step 4: Manual stale-reference grep**

Run: `grep -rn 'usePriceHistory.*productId\|brand=.*productName=' --include='*.ts' --include='*.tsx' . | grep -v node_modules`
Expected: zero matches. If any appear, they're chart-related leftovers — fix and commit.

- [ ] **Step 5: Final commit if anything was cleaned up**

```bash
git add -u
git commit -m "chore(catalog): final cleanup of stale chart prop references"  # only if matches were found
```
