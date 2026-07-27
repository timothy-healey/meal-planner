import React from 'react';
import { Modal, View, Pressable, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './ui/AppText';
import { CategoryHeader } from './ui/CategoryHeader';
import { colors, radius, spacing } from '../constants/tokens';

export interface PickableRecipe {
  id: string;
  title: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  servings: number;
}

interface Props {
  visible: boolean;
  recipes: PickableRecipe[];
  alreadyInPlan: string[];
  onPick: (recipeId: string, defaultServes: number) => void;
  onClose: () => void;
}

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export function RecipePickerSheet({
  visible, recipes, alreadyInPlan, onPick, onClose,
}: Props) {
  const grouped = MEAL_ORDER
    .map((meal) => ({ meal, items: recipes.filter((r) => r.meal_type === meal) }))
    .filter((g) => g.items.length > 0);

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

        {/* Percentage height, never absolute — an absolute-height child of a
            keyboard-padded container spills off the top of the screen. */}
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <AppText weight="extrabold" size="xl" color="textPrimary">Add a recipe</AppText>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {recipes.length === 0 ? (
            <AppText weight="regular" size="md" color="textTertiary">
              No recipes yet — import a plan first.
            </AppText>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {grouped.map(({ meal, items }) => (
                <View key={meal}>
                  <CategoryHeader label={meal} isOneoff={false} />
                  {items.map((r) => {
                    const inPlan = alreadyInPlan.includes(r.id);
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={[styles.row, inPlan && styles.rowInPlan]}
                        disabled={inPlan}
                        onPress={() => onPick(r.id, r.servings)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={
                          inPlan ? `${r.title}, already in plan` : `${r.title}, serves ${r.servings}`
                        }
                      >
                        <AppText weight="semibold" size="md" color="textPrimary">
                          {r.title}
                        </AppText>
                        {inPlan ? (
                          <Ionicons name="checkmark" size={18} color={colors.green} />
                        ) : (
                          <AppText weight="regular" size="sm" color="textTertiary">
                            {`Serves ${r.servings}`}
                          </AppText>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
              <View style={{ height: spacing[4] }} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: {
    height: '80%',
    backgroundColor: colors.cream,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[6],
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.divider,
    alignSelf: 'center', marginTop: spacing[2], marginBottom: spacing[1],
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing[2],
  },
  closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 44, paddingVertical: spacing[2],
  },
  rowInPlan: { opacity: 0.45 },
});
