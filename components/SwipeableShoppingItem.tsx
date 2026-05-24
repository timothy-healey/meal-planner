import { Ionicons } from "@expo/vector-icons";
import { useRef } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { colors } from "../constants/tokens";
import type { ShoppingItemRow } from "../types/db";
import { ShoppingItem } from "./ShoppingItem";

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
  const swipeableRef = useRef<SwipeableMethods>(null);

  const handleDelete = () => {
    swipeableRef.current?.close();
    onDelete();
  };

  const handleEdit = () => {
    swipeableRef.current?.close();
    onEdit();
  };

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      friction={2}
      rightThreshold={60}
      renderRightActions={() => (
        <>
          <DeleteAction onDelete={handleDelete} />
          <EditAction onEdit={handleEdit} />
        </>
      )}
      overshootRight={false}
    >
      <ShoppingItem item={item} onToggle={onToggle} />
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
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
