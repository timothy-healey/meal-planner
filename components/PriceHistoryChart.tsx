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
import type { PricePoint } from '../types/db';
import { AddPriceSheet } from './AddPriceSheet';

interface Props {
  brand: string | null;
  productName: string | null;
}

const TIME_RANGES: TimeRange[] = ['3M', '6M', '1Y', 'All'];

export function PriceHistoryChart({ brand, productName }: Props) {
  const { points, reload } = usePriceHistory(brand, productName);
  const [timeRange, setTimeRange] = useState<TimeRange>('6M');
  const [unit, setUnit] = useState<ChartUnit>('per100');
  const [chartWidth, setChartWidth] = useState(0);
  const [addPriceVisible, setAddPriceVisible] = useState(false);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setChartWidth(e.nativeEvent.layout.width);
  }, []);

  const filtered = filterByTimeRange(points, timeRange);

  // Group by chain, assign stable colours by sorted chain name
  const chains = [...new Set(filtered.map(p => p.chain))].sort();
  const chainMap = new Map<string, PricePoint[]>();
  for (const chain of chains) {
    chainMap.set(chain, filtered.filter(p => p.chain === chain));
  }

  // Determine display value based on unit toggle (both same for now;
  // Total mode would show raw price — wired separately if needed).
  const displayValue = (p: PricePoint) => p.normalisedPrice;

  const allValues = filtered.map(displayValue);
  const CHART_H = 130;
  const areaW = Math.max(chartWidth - CHART_MARGINS.left - CHART_MARGINS.right, 0);
  const areaH = CHART_H - CHART_MARGINS.top - CHART_MARGINS.bottom;

  const yScale = buildYScale(allValues.length ? allValues : [0.40], areaH);
  const xScale = buildXScale(filtered.map(p => p.purchasedAt), areaW);

  // Best value: lowest most-recent price per chain
  const bestValue: { chain: string; value: number } | null = (() => {
    if (!chains.length) return null;
    let best: { chain: string; value: number } | null = null;
    for (const chain of chains) {
      const pts = chainMap.get(chain)!;
      const last = pts[pts.length - 1];
      const v = displayValue(last);
      if (!best || v < best.value) best = { chain, value: v };
    }
    return best;
  })();

  const toSvgX = (iso: string) => CHART_MARGINS.left + xScale.toX(iso);
  const toSvgY = (v: number) => CHART_MARGINS.top + yScale.toY(v);

  return (
    <View>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionDot} />
        <AppText weight="bold" size="sm" color="terracotta" style={styles.sectionTitle}>
          PRICE HISTORY
        </AppText>
        <TouchableOpacity onPress={() => setAddPriceVisible(true)} accessibilityRole="button" accessibilityLabel="Add price">
          <AppText weight="bold" size="sm" color="green">+ Add price</AppText>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        {/* Toolbar */}
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

        {/* Chart or empty state */}
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
                {/* Y axis line */}
                <Line
                  x1={CHART_MARGINS.left} y1={CHART_MARGINS.top}
                  x2={CHART_MARGINS.left} y2={CHART_MARGINS.top + areaH}
                  stroke={colors.divider} strokeWidth={1}
                />
                {/* X axis line */}
                <Line
                  x1={CHART_MARGINS.left} y1={CHART_MARGINS.top + areaH}
                  x2={chartWidth - CHART_MARGINS.right} y2={CHART_MARGINS.top + areaH}
                  stroke={colors.divider} strokeWidth={1}
                />
                {/* Y grid lines + labels */}
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
                {/* X axis month labels */}
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

                {/* Chain lines */}
                {chains.map((chain, idx) => {
                  const pts = chainMap.get(chain)!;
                  const color = getStoreColor(idx);
                  const isSparse = pts.length < 3;
                  const regularPts = pts.filter(p => !p.isOnSale);
                  const salePts = pts.filter(p => p.isOnSale);

                  const regularCoords = regularPts
                    .map(p => `${toSvgX(p.purchasedAt)},${toSvgY(displayValue(p))}`)
                    .join(' ');

                  return (
                    <React.Fragment key={chain}>
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

        {/* Best value strip */}
        {bestValue && (
          <View style={styles.bestValue}>
            <AppText weight="semibold" size="sm" color="textSecondary">Best value now</AppText>
            <AppText weight="extrabold" size="md" color="orange">
              {bestValue.chain}
              <AppText weight="medium" size="sm" color="textTertiary">
                {` ${(bestValue.value * 100).toFixed(0)}¢/100g`}
              </AppText>
            </AppText>
          </View>
        )}

        {/* Legend */}
        <View style={styles.legend}>
          {chains.map((chain, idx) => (
            <View key={chain} style={styles.legendPill}>
              <View style={[styles.legendDot, { backgroundColor: getStoreColor(idx) }]} />
              <AppText weight="semibold" size="xs" color="textSecondary">{chain}</AppText>
            </View>
          ))}
          {filtered.some(p => p.isOnSale) && (
            <View style={[styles.legendPill, styles.legendSale]}>
              <View style={styles.legendSaleIcon} />
              <AppText weight="semibold" size="xs" color="orange">Sale</AppText>
            </View>
          )}
        </View>
      </View>

      <AddPriceSheet
        visible={addPriceVisible}
        brand={brand}
        productName={productName}
        onClose={() => setAddPriceVisible(false)}
        onSaved={() => { setAddPriceVisible(false); reload(); }}
      />
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
