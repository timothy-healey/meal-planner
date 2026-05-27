import { Ionicons } from '@expo/vector-icons';
import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useFocusEffect } from 'expo-router';
import { AppText } from './ui/AppText';
import { colors, spacing } from '../constants/tokens';
import { formatPrice } from '../lib/format';

const ACTION_WIDTH = 90;
const SPRING = { damping: 30, stiffness: 400 };

interface Props {
  name: string;
  subtitle: string | null;
  price: number | null;
  onTap: () => void;
  onRemove: () => void;
}

export function ReceiptRow({ name, subtitle, price, onTap, onRemove }: Props) {
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      return () => { translateX.value = withSpring(0, SPRING); };
    }, []),
  );

  const handleRemove = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onRemove();
  };

  const handleTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    translateX.value = withSpring(0, SPRING);
    onTap();
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-5, 5])
    .failOffsetY([-10, 10])
    .onBegin(() => { startX.value = translateX.value; })
    .onUpdate((e) => {
      translateX.value = Math.max(-ACTION_WIDTH, Math.min(0, startX.value + e.translationX));
    })
    .onEnd(() => {
      translateX.value = withSpring(
        translateX.value < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0,
        SPRING,
      );
    });

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.outer}>
      <GestureDetector gesture={pan}>
        <View style={styles.container}>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.removeAction}
              onPress={handleRemove}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Remove from receipt"
            >
              <Ionicons name="trash-outline" size={22} color={colors.onGreen} />
            </TouchableOpacity>
          </View>
          <Animated.View style={[styles.content, contentStyle]}>
            <TouchableOpacity
              style={styles.row}
              onPress={handleTap}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${name}`}
            >
              <View style={styles.left}>
                <AppText weight="bold" size="md" color="green">{name}</AppText>
                {subtitle ? (
                  <AppText weight="semibold" size="xs" color="textTertiary">
                    {subtitle}
                  </AppText>
                ) : null}
              </View>
              <AppText weight="extrabold" size="md" color="green" style={styles.price}>
                {price != null ? formatPrice(price) : '—'}
              </AppText>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { position: 'relative' },
  container: { position: 'relative' },
  actions: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row', justifyContent: 'flex-end',
  },
  removeAction: {
    width: ACTION_WIDTH,
    backgroundColor: colors.orange,
    justifyContent: 'center', alignItems: 'center',
  },
  content: {
    backgroundColor: colors.paper,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing[3] + 1,
    paddingRight: spacing[3],
    minHeight: 44,
  },
  left: { flex: 1, gap: 2 },
  price: {
    fontVariant: ['tabular-nums'],
  },
});
