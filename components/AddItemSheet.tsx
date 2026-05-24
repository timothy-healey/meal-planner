import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './ui/AppText';
import { colors, spacing, radius, font } from '../constants/tokens';
import type { ShoppingItemRow } from '../types/db';

const SHEET_HEIGHT = Dimensions.get('window').height * 0.72;

export interface ItemFormData {
  name: string;
  qty: string;
  estimatedPrice: number;
  category: string;
  note: string | null;
}

interface Props {
  visible: boolean;
  categories: string[];
  onAdd: (data: ItemFormData) => void;
  onSave?: (id: string, data: ItemFormData) => void;
  onClose: () => void;
  initialItem?: ShoppingItemRow;
}

export function AddItemSheet({ visible, categories, onAdd, onSave, onClose, initialItem }: Props) {
  const translateY = useSharedValue(SHEET_HEIGHT);
  const scrimOpacity = useSharedValue(0);

  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(categories[0] ?? '');
  const [note, setNote] = useState('');
  const [noteExpanded, setNoteExpanded] = useState(false);

  const isEditMode = !!initialItem;

  useEffect(() => {
    if (visible) {
      if (initialItem) {
        setName(initialItem.name);
        setQty(initialItem.qty);
        setPrice(initialItem.estimated_price > 0 ? String(initialItem.estimated_price) : '');
        setSelectedCategory(initialItem.category);
        setNote(initialItem.note ?? '');
        setNoteExpanded(!!initialItem.note);
      } else {
        setName('');
        setQty('1');
        setPrice('');
        setSelectedCategory(categories[0] ?? '');
        setNote('');
        setNoteExpanded(false);
      }
      scrimOpacity.value = withTiming(1, { duration: 180 });
      translateY.value = withTiming(0, { duration: 280 });
    }
  }, [visible]);

  const handleClose = () => {
    scrimOpacity.value = withTiming(0, { duration: 220 });
    translateY.value = withTiming(SHEET_HEIGHT, { duration: 260 }, () => {
      runOnJS(onClose)();
    });
  };

  const handleSubmit = () => {
    if (!name.trim() || !selectedCategory) return;
    const data: ItemFormData = {
      name: name.trim(),
      qty: qty.trim() || '1',
      estimatedPrice: parseFloat(price.replace(/[^0-9.]/g, '')) || 0,
      category: selectedCategory,
      note: note.trim() || null,
    };
    if (isEditMode && initialItem) {
      onSave?.(initialItem.id, data);
    } else {
      onAdd(data);
    }
    handleClose();
  };

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity.value,
  }));

  if (!visible) return null;

  const canSubmit = name.trim().length > 0 && selectedCategory.length > 0;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <Animated.View style={[styles.sheet, sheetStyle]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <AppText weight="extrabold" color="textPrimary" size="xl">
              {isEditMode ? 'Edit item' : 'Add item'}
            </AppText>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeBtn}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <AppText weight="semibold" color="terracotta" size="sm" style={styles.label}>
              ITEM NAME
            </AppText>
            <TextInput
              style={styles.input}
              placeholder="e.g. Greek yoghurt"
              placeholderTextColor={colors.textTertiary}
              value={name}
              onChangeText={setName}
              autoFocus={!isEditMode}
              returnKeyType="next"
              accessibilityLabel="Item name"
            />

            <View style={styles.twoCol}>
              <View style={styles.col}>
                <AppText weight="semibold" color="terracotta" size="sm" style={styles.label}>
                  QUANTITY
                </AppText>
                <TextInput
                  style={styles.input}
                  placeholder="1 tub"
                  placeholderTextColor={colors.textTertiary}
                  value={qty}
                  onChangeText={setQty}
                  returnKeyType="next"
                  accessibilityLabel="Quantity"
                />
              </View>
              <View style={styles.col}>
                <AppText weight="semibold" color="terracotta" size="sm" style={styles.label}>
                  PRICE
                </AppText>
                <TextInput
                  style={styles.input}
                  placeholder="$4.50"
                  placeholderTextColor={colors.textTertiary}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  accessibilityLabel="Price, optional"
                />
              </View>
            </View>

            <AppText weight="semibold" color="terracotta" size="sm" style={[styles.label, styles.categoryLabel]}>
              CATEGORY
            </AppText>
            {categories.length === 0 ? (
              <AppText weight="regular" color="textSecondary" size="md" style={styles.noCategories}>
                No categories yet — import a plan first
              </AppText>
            ) : (
              categories.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryRow, isSelected && styles.categoryRowSelected]}
                    onPress={() => setSelectedCategory(cat)}
                    activeOpacity={0.65}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={cat}
                  >
                    <AppText
                      weight={isSelected ? 'bold' : 'regular'}
                      color={isSelected ? 'textPrimary' : 'textSecondary'}
                      size="md"
                    >
                      {cat}
                    </AppText>
                    {isSelected && (
                      <Ionicons name="checkmark" size={18} color={colors.green} />
                    )}
                  </TouchableOpacity>
                );
              })
            )}

            {noteExpanded ? (
              <>
                <AppText weight="semibold" color="terracotta" size="sm" style={[styles.label, styles.noteLabel]}>
                  NOTE
                </AppText>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Free range"
                  placeholderTextColor={colors.textTertiary}
                  value={note}
                  onChangeText={setNote}
                  returnKeyType="done"
                  accessibilityLabel="Note, optional"
                />
              </>
            ) : (
              <TouchableOpacity
                style={styles.addNoteRow}
                onPress={() => setNoteExpanded(true)}
                accessibilityRole="button"
                accessibilityLabel="Add note"
              >
                <Ionicons name="add-circle-outline" size={16} color={colors.textSecondary} />
                <AppText weight="semibold" color="textSecondary" size="sm">Add note</AppText>
              </TouchableOpacity>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.addBtn, !canSubmit && styles.addBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={isEditMode ? 'Save changes' : 'Add to list'}
              accessibilityState={{ disabled: !canSubmit }}
            >
              <AppText weight="extrabold" color="onGreen" size="md">
                {isEditMode ? 'Save changes' : '+ Add to list'}
              </AppText>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    backgroundColor: 'rgba(28, 69, 60, 0.45)',
  },
  sheet: {
    height: SHEET_HEIGHT,
    backgroundColor: colors.cream,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 16,
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
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
  },
  closeBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
  },
  label: {
    letterSpacing: 1.0,
    marginBottom: spacing[1],
  },
  categoryLabel: {
    marginTop: spacing[5],
  },
  noteLabel: {
    marginTop: spacing[5],
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontFamily: font.family.regular,
    fontSize: font.size.md,
    color: colors.textPrimary,
    marginBottom: spacing[3],
  },
  twoCol: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  col: {
    flex: 1,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: radius.sm,
    marginBottom: spacing[1],
  },
  categoryRowSelected: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  noCategories: {
    paddingVertical: spacing[3],
  },
  addNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    marginTop: spacing[2],
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  addBtn: {
    backgroundColor: colors.green,
    paddingVertical: spacing[4],
    borderRadius: radius.xl,
    alignItems: 'center',
  },
  addBtnDisabled: {
    opacity: 0.4,
  },
});
