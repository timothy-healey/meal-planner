import { StyleSheet, View } from "react-native";
import { spacing } from "../../constants/tokens";
import { AppText } from "./AppText";
import { Card } from "./Card";

interface Stat {
  label: string;
  value: string;
  highlight?: boolean;
}

interface StatStripProps {
  stats: Stat[];
}

export function StatStrip({ stats }: StatStripProps) {
  return (
    <View style={styles.row}>
      {stats.map((stat) => (
        <Card key={stat.label} style={styles.card}>
          <AppText size="2xs" color="textSecondary">
            {stat.label}
          </AppText>
          <AppText
            weight="extrabold"
            size="2xl"
            color={stat.highlight ? "orange" : "textPrimary"}
          >
            {stat.value}
          </AppText>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing[2],
  },
  card: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing[2],
  },
});
