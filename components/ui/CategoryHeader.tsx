import { StyleSheet, View } from "react-native";
import { colors, font, spacing } from "../../constants/tokens";
import { AppText } from "./AppText";
import { Row } from "./Row";

const DOT_SIZE = 7;

interface CategoryHeaderProps {
  label: string;
  isOneoff?: boolean;
}

export function CategoryHeader({
  label,
  isOneoff = false,
}: CategoryHeaderProps) {
  return (
    <Row gap={2} style={styles.row}>
      <View style={styles.dot} />
      <AppText
        weight="semibold"
        size="md"
        color="terracotta"
        style={styles.label}
      >
        {label.toUpperCase()}
      </AppText>
      {isOneoff && (
        <AppText size="2xs" color="textNote" style={styles.oneoff}>
          (check pantry first)
        </AppText>
      )}
    </Row>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing[2],
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE,
    backgroundColor: colors.terracotta,
  },
  label: {
    letterSpacing: font.tracking.category,
  },
  oneoff: {
    marginLeft: spacing[2],
  },
});
