import { Ionicons } from "@expo/vector-icons";
import { useCallback } from "react";
import * as Haptics from 'expo-haptics';
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useFocusEffect } from "expo-router";
import { colors } from "../constants/tokens";
import { Divider } from "./ui/Divider";
import type { ShoppingItemRow } from "../types/db";
import { ShoppingItem } from "./ShoppingItem";

const ACTIONS_WIDTH = 160;
const SPRING = { damping: 20, stiffness: 200 };

interface Props {
  item: ShoppingItemRow;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

function EditAction({ onEdit }: { onEdit: () => void }) {
  return (
    <TouchableOpacity
      style={styles.editAction}
      onPress={onEdit}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Edit item"
    >
      <Ionicons name="create-outline" size={22} color={colors.onGreen} />
    </TouchableOpacity>
  );
}

function DeleteAction({ onDelete }: { onDelete: () => void }) {
  return (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={onDelete}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Delete item"
    >
      <Ionicons name="trash-outline" size={22} color={colors.onGreen} />
    </TouchableOpacity>
  );
}

export function SwipeableShoppingItem({ item, onToggle, onDelete, onEdit }: Props) {
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      return () => {
        translateX.value = withSpring(0, SPRING);
      };
    }, [])
  );

  const handleDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDelete();
  };

  const handleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    translateX.value = withSpring(0, SPRING);
    onEdit();
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-5, 5])
    .failOffsetY([-10, 10])
    .onBegin(() => {
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      translateX.value = Math.max(-ACTIONS_WIDTH, Math.min(0, startX.value + e.translationX));
    })
    .onEnd(() => {
      translateX.value = withSpring(
        translateX.value < -ACTIONS_WIDTH / 2 ? -ACTIONS_WIDTH : 0,
        SPRING
      );
    });

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View>
      <GestureDetector gesture={pan}>
        <View style={styles.container}>
          <View style={styles.actions}>
            <EditAction onEdit={handleEdit} />
            <DeleteAction onDelete={handleDelete} />
          </View>
          <Animated.View style={[styles.content, contentStyle]}>
            <ShoppingItem item={item} onToggle={onToggle} showDivider={false} />
          </Animated.View>
        </View>
      </GestureDetector>
      <Divider />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  actions: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  content: {
    backgroundColor: colors.card,
  },
  editAction: {
    width: 80,
    backgroundColor: colors.green,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteAction: {
    width: 80,
    backgroundColor: colors.orange,
    justifyContent: "center",
    alignItems: "center",
  },
});
