import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AppText } from './ui/AppText';
import { colors, radius, spacing } from '../constants/tokens';

export interface PlanRecipeEntryView {
  recipeId: string;
  title: string;
  /** null when the recipe has been deleted out from under the plan. */
  recipeServings: number | null;
  targetServes: number;
}

interface Props {
  entries: PlanRecipeEntryView[];
  onSetServes: (recipeId: string, next: number) => void;
  onRemove: (recipeId: string) => void;
  onAdd: () => void;
  onOpen: (recipeId: string) => void;
}

const MIN_SERVES = 1;
const COMMIT_DELAY_MS = 400;

export function PlanRecipeList({ entries, onSetServes, onRemove, onAdd, onOpen }: Props) {
  // Every commit runs a full read-compute-diff-write cycle. A stepper is built
  // to be tapped repeatedly, so hold the value locally and commit once the taps
  // settle — the same shape as ServesSheet, where edits are local until Done.
  const [pending, setPending] = useState<Record<string, number>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => () => {
    for (const t of Object.values(timers.current)) clearTimeout(t);
  }, []);

  function step(recipeId: string, from: number, delta: number) {
    const next = Math.max(MIN_SERVES, from + delta);
    if (next === from) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPending((p) => ({ ...p, [recipeId]: next }));
    clearTimeout(timers.current[recipeId]);
    timers.current[recipeId] = setTimeout(() => {
      onSetServes(recipeId, next);
      setPending((p) => {
        const { [recipeId]: _drop, ...rest } = p;
        return rest;
      });
    }, COMMIT_DELAY_MS);
  }

  return (
    <View style={styles.wrap}>
      {entries.map((entry) => {
        const target = pending[entry.recipeId] ?? entry.targetServes;
        const missing = entry.recipeServings === null;
        const factor = entry.recipeServings && entry.recipeServings > 0
          ? Math.round((target / entry.recipeServings) * 100) / 100
          : 1;

        return (
          <View key={entry.recipeId} style={styles.card}>
            <View style={styles.titleRow}>
              {/* Only the title navigates — the stepper and remove button sit
                  inside this card and must not be wrapped in a tap target
                  that would carry you off mid-edit. */}
              {missing ? (
                <AppText weight="bold" size="lg" color="textPrimary" style={styles.title}>
                  {entry.title}
                </AppText>
              ) : (
                <TouchableOpacity
                  style={styles.titleLink}
                  onPress={() => onOpen(entry.recipeId)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${entry.title}`}
                >
                  <AppText weight="bold" size="lg" color="textPrimary">
                    {entry.title}
                  </AppText>
                  <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => onRemove(entry.recipeId)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${entry.title} from plan`}
              >
                <Ionicons name="close" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {missing ? (
              // FKs are not enforced, so deleting a recipe leaves the join row.
              <AppText weight="regular" size="sm" color="terracotta">
                Recipe no longer exists — remove it from the plan.
              </AppText>
            ) : (
              <>
                <View style={styles.stepper}>
                  <AppText weight="semibold" size="sm" color="textSecondary">Make</AppText>
                  <TouchableOpacity
                    style={[styles.stepBtn, target <= MIN_SERVES && styles.stepBtnDisabled]}
                    disabled={target <= MIN_SERVES}
                    onPress={() => step(entry.recipeId, target, -1)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Decrease serves for ${entry.title}`}
                  >
                    <Ionicons
                      name="remove"
                      size={18}
                      color={target <= MIN_SERVES ? colors.textTertiary : colors.green}
                    />
                  </TouchableOpacity>

                  <View accessible accessibilityLabel={`Make ${target} serves of ${entry.title}`}>
                    <AppText weight="extrabold" size="xl" color="textPrimary">
                      {String(target)}
                    </AppText>
                  </View>

                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => step(entry.recipeId, target, 1)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Increase serves for ${entry.title}`}
                  >
                    <Ionicons name="add" size={18} color={colors.green} />
                  </TouchableOpacity>
                  <AppText weight="semibold" size="sm" color="textSecondary">serves</AppText>
                </View>

                <AppText weight="regular" size="2xs" color="textTertiary">
                  {`recipe serves ${entry.recipeServings} · ×${factor}`}
                </AppText>
              </>
            )}
          </View>
        );
      })}

      <TouchableOpacity
        style={styles.addBtn}
        onPress={onAdd}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Add a recipe"
      >
        <Ionicons name="add" size={16} color={colors.green} />
        <AppText weight="bold" size="sm" color="green">Add a recipe</AppText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[3], paddingHorizontal: spacing[4] },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing[4],
    gap: spacing[2],
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1, paddingRight: spacing[2] },
  titleLink: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    paddingRight: spacing[2], paddingVertical: spacing[1], minHeight: 44,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  stepBtn: {
    width: 44, height: 44, borderRadius: radius.full,
    backgroundColor: colors.cream, borderWidth: 1.5, borderColor: colors.divider,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.5 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[1], minHeight: 44, borderRadius: radius.xl,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.divider,
  },
});
