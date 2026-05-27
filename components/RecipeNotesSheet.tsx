import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import { KeyboardAvoidingView, KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './ui/AppText';
import { colors, spacing, radius, shadow, font } from '../constants/tokens';

const SHEET_HEIGHT = Dimensions.get('window').height * 0.6;

interface Props {
  visible: boolean;
  recipeTitle: string;
  initialNotes: string | null;
  onSave: (notes: string | null) => void;
  onClose: () => void;
}

export function RecipeNotesSheet({ visible, recipeTitle, initialNotes, onSave, onClose }: Props) {
  const translateY = useSharedValue(SHEET_HEIGHT);
  const scrimOpacity = useSharedValue(0);
  const [text, setText] = useState(initialNotes ?? '');

  useEffect(() => {
    if (visible) {
      setText(initialNotes ?? '');
      scrimOpacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.exp) });
      translateY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.exp) });
    }
  }, [visible, initialNotes]);

  const handleClose = () => {
    scrimOpacity.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.exp) });
    translateY.value = withTiming(SHEET_HEIGHT, { duration: 220, easing: Easing.out(Easing.exp) }, () => {
      runOnJS(onClose)();
    });
  };

  const handleSave = () => {
    const trimmed = text.trim();
    onSave(trimmed.length === 0 ? null : trimmed);
    handleClose();
  };

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOpacity.value }));

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <Animated.View style={[styles.sheet, sheetStyle]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <AppText weight="extrabold" color="textPrimary" size="xl" style={styles.title} numberOfLines={1}>
              {`Notes — ${recipeTitle}`}
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

          <KeyboardAwareScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TextInput
              style={styles.input}
              placeholder="What worked, what to change next time…"
              placeholderTextColor={colors.textTertiary}
              value={text}
              onChangeText={setText}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Recipe notes"
            />
          </KeyboardAwareScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Save notes"
            >
              <AppText weight="extrabold" color="onGreen" size="md">
                Save notes
              </AppText>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  scrim: { backgroundColor: colors.scrim },
  sheet: {
    height: SHEET_HEIGHT,
    backgroundColor: colors.cream,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
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
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
  },
  title: { flex: 1, paddingRight: spacing[3] },
  closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: spacing[5], paddingBottom: spacing[4] },
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
    minHeight: 200,
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  saveBtn: {
    backgroundColor: colors.green,
    paddingVertical: spacing[4],
    borderRadius: radius.xl,
    alignItems: 'center',
  },
});
