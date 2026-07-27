import React, { useEffect, useState } from 'react';
import { Modal, View, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AppText } from './ui/AppText';
import { colors, spacing, radius, shadow, font } from '../constants/tokens';

const MIN_SERVES = 1;
const MAX_SERVES = 99;

interface Props {
  visible: boolean;
  servings: number;
  /** Per-serve calories at the current `servings`, or null when the recipe has none. */
  caloriesPerServe: number | null;
  /** Mirrors the header's `~` prefix when the macro rollup is partial. */
  isApproximate: boolean;
  onSave: (servings: number) => void;
  onClose: () => void;
}

export function ServesSheet({
  visible,
  servings,
  caloriesPerServe,
  isApproximate,
  onSave,
  onClose,
}: Props) {
  const [value, setValue] = useState(servings);

  // Reseed on open so a dismissed edit does not carry into the next visit.
  useEffect(() => {
    if (visible) setValue(servings);
  }, [visible, servings]);

  // The pot is fixed: stepping serves re-divides the same total.
  const preview =
    caloriesPerServe != null
      ? Math.round((caloriesPerServe * servings) / (value > 0 ? value : 1))
      : null;

  function step(delta: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setValue((v) => Math.min(MAX_SERVES, Math.max(MIN_SERVES, v + delta)));
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <AppText weight="extrabold" color="textPrimary" size="xl">Serves</AppText>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.stepper}>
            <TouchableOpacity
              style={[styles.stepBtn, value <= MIN_SERVES && styles.stepBtnDisabled]}
              onPress={() => step(-1)}
              disabled={value <= MIN_SERVES}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Decrease serves"
            >
              <Ionicons
                name="remove"
                size={24}
                color={value <= MIN_SERVES ? colors.textTertiary : colors.green}
              />
            </TouchableOpacity>

            <View style={styles.valueWrap} accessible accessibilityLabel={`Serves ${value}`}>
              <AppText weight="extrabold" color="textPrimary" size="3xl">
                {String(value)}
              </AppText>
            </View>

            <TouchableOpacity
              style={[styles.stepBtn, value >= MAX_SERVES && styles.stepBtnDisabled]}
              onPress={() => step(1)}
              disabled={value >= MAX_SERVES}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Increase serves"
            >
              <Ionicons
                name="add"
                size={24}
                color={value >= MAX_SERVES ? colors.textTertiary : colors.green}
              />
            </TouchableOpacity>
          </View>

          {preview != null && (
            <AppText weight="bold" color="orange" size="md" style={styles.preview}>
              {`${isApproximate ? '~' : ''}${preview} kcal per serve`}
            </AppText>
          )}

          <AppText weight="regular" color="textTertiary" size="sm" style={styles.hint}>
            Ingredient amounts stay the same — only the per-serve numbers change.
          </AppText>

          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => onSave(value)}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <AppText weight="extrabold" color="onGreen" size="md">Done</AppText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[6],
    ...shadow.sheet,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.divider,
    alignSelf: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[1],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[5],
    paddingVertical: spacing[3],
  },
  stepBtn: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.5 },
  valueWrap: { minWidth: 64, alignItems: 'center' },
  preview: { textAlign: 'center', marginTop: spacing[1] },
  hint: {
    textAlign: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[4],
    letterSpacing: font.tracking.normal,
  },
  doneBtn: {
    backgroundColor: colors.green,
    paddingVertical: spacing[4],
    borderRadius: radius.xl,
    alignItems: 'center',
  },
});
