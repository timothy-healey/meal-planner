import React from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { GreenHeader } from '../components/ui/GreenHeader';
import { AppText } from '../components/ui/AppText';
import { Divider } from '../components/ui/Divider';
import { usePlan } from '../hooks/usePlan';
import { colors, spacing, radius } from '../constants/tokens';

export default function BatchPlanScreen() {
  const { plan } = usePlan();
  // plan.batchSteps is BatchStep[] — already parsed
  const steps = plan?.batchSteps ?? [];

  return (
    <View style={styles.container}>
      <GreenHeader>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back to Recipes"
          >
            <AppText weight="bold" color="onGreenSubtle" size="sm">‹ Recipes</AppText>
          </TouchableOpacity>
          <AppText weight="extrabold" color="onGreen" size="xl">Sunday Batch Plan</AppText>
        </View>
      </GreenHeader>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.card}>
          {steps.map((step, idx) => (
            <View key={idx}>
              <View style={styles.stepRow}>
                <AppText weight="bold" color="terracotta" size="md" style={styles.time}>
                  {step.time}
                </AppText>
                <AppText weight="semibold" color="textPrimary" size="md" style={styles.task}>
                  {step.task}
                </AppText>
              </View>
              {idx < steps.length - 1 && <Divider />}
            </View>
          ))}
          {steps.length === 0 && (
            <AppText weight="regular" color="textSecondary" size="md" style={styles.empty}>
              No batch plan steps for this week.
            </AppText>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  headerContent: { paddingBottom: spacing[1], gap: spacing[2] },
  backBtn: { paddingVertical: spacing[4], paddingRight: spacing[4], alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  body: { flex: 1 },
  bodyContent: { padding: spacing[4], paddingBottom: spacing[10] },
  card: { backgroundColor: colors.card, borderRadius: radius.md, overflow: 'hidden' },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    gap: spacing[4],
  },
  time: { width: 64, flexShrink: 0 },
  task: { flex: 1 },
  empty: { padding: spacing[4], textAlign: 'center' },
});
