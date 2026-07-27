import { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { GreenHeader } from '../components/ui/GreenHeader';
import { AppText } from '../components/ui/AppText';
import { Pill } from '../components/ui/Pill';
import { Divider } from '../components/ui/Divider';
import { Row } from '../components/ui/Row';
import { useImport } from '../hooks/useImport';
import { useBackup } from '../hooks/useBackup';
import { usePlan } from '../hooks/usePlan';
import { useBuildPlan } from '../hooks/useBuildPlan';
import { useDb } from '../providers/DatabaseProvider';
import { buildClaudeContext } from '../lib/exportContext';
import { colors, spacing, radius } from '../constants/tokens';

export default function SettingsScreen() {
  const { importPlan, status: importStatus } = useImport(() => router.back());
  const {
    saveBackup, shareBackup, chooseFolder, folderName,
    restoreBackup, status: backupStatus,
  } = useBackup(() => router.back());
  const { plan } = usePlan();
  const { buildPlan } = useBuildPlan(() => router.back());
  const db = useDb();
  const [restorePreview, setRestorePreview] = useState<{
    summary: string;
    exportedDate: string;
    execute: () => void;
  } | null>(null);
  const [contextCopied, setContextCopied] = useState(false);

  async function handleRestore() {
    const preview = await restoreBackup();
    if (preview) setRestorePreview(preview);
  }

  function confirmRestore() {
    if (!restorePreview) return;
    restorePreview.execute();
    setRestorePreview(null);
  }

  async function handleCopyContext() {
    if (!plan) return;
    const json = await buildClaudeContext(db, plan.row.id);
    await Clipboard.setStringAsync(json);
    setContextCopied(true);
    setTimeout(() => setContextCopied(false), 2000);
  }

  return (
    <View style={styles.container}>
      <GreenHeader>
        <Row justify="space-between" align="center">
          <AppText weight="extrabold" size="xl" color="onGreen">Settings</AppText>
          <Pill label="Close" icon="close" onPress={() => router.back()} variant="green" />
        </Row>
      </GreenHeader>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Import */}
        <View style={styles.section}>
          <AppText weight="bold" size="lg">Import Plan</AppText>
          <AppText color="textSecondary">
            Replace the active shopping list — either from a weekly plan JSON,
            or built here from recipes you already have. Your recipe library is
            preserved either way.
          </AppText>
          <Pill label="Import weekly plan" icon="folder-open-outline" onPress={importPlan} />
          <Pill
            label="Build a plan from recipes"
            icon="restaurant-outline"
            onPress={buildPlan}
          />
          {importStatus.type === 'success' && (
            <AppText color="green">{importStatus.message}</AppText>
          )}
          {importStatus.type === 'error' && (
            <View style={styles.errorBlock}>
              <AppText color="terracotta">{importStatus.message}</AppText>
              <Pill label="Try again" onPress={importPlan} />
            </View>
          )}
        </View>

        <Divider />

        {/* Claude Context */}
        <View style={styles.section}>
          <AppText weight="bold" size="lg">Claude Context</AppText>
          <AppText color="textSecondary">
            Copy this week's purchases with nutrition data as JSON to paste into Claude.
          </AppText>
          <Pill
            label={contextCopied ? 'Copied!' : 'Copy context for Claude'}
            icon={contextCopied ? 'checkmark' : 'sparkles-outline'}
            onPress={handleCopyContext}
            style={!plan ? styles.dimmed : undefined}
          />
          {!plan && (
            <AppText size="sm" color="textTertiary">No active plan — import a plan first.</AppText>
          )}
        </View>

        <Divider />

        {/* Export */}
        <View style={styles.section}>
          <AppText weight="bold" size="lg">Export Backup</AppText>
          <AppText color="textSecondary">
            Save all your data — recipes, plans, and shopping history — to a JSON file.
          </AppText>
          <Row gap={3}>
            <Pill label="Save to device" icon="download-outline" onPress={saveBackup} />
            <Pill label="Share" icon="share-outline" onPress={shareBackup} />
          </Row>
          {folderName ? (
            <Row gap={2} align="center">
              <AppText size="sm" color="textTertiary">Saving to {folderName}</AppText>
              <Pill label="Change folder" onPress={chooseFolder} />
            </Row>
          ) : (
            <AppText size="sm" color="textTertiary">
              You'll be asked where to save the first time.
            </AppText>
          )}
          {backupStatus.type === 'success' && (
            <AppText color="green">{backupStatus.message}</AppText>
          )}
        </View>

        <Divider />

        {/* Restore */}
        <View style={styles.section}>
          <AppText weight="bold" size="lg">Restore Backup</AppText>
          <AppText color="textSecondary">
            Replace all data from a backup file. Cannot be undone.
          </AppText>
          {!restorePreview ? (
            <Pill label="Restore from backup" icon="cloud-download-outline" onPress={handleRestore} />
          ) : (
            <View style={styles.restorePreviewCard}>
              <AppText>
                Backup from <AppText weight="bold">{restorePreview.exportedDate}</AppText>
                {' · '}{restorePreview.summary}
              </AppText>
              <AppText color="terracotta">This will replace all your current data.</AppText>
              <Row gap={3}>
                <Pill label="Restore" onPress={confirmRestore} variant="green" />
                <Pill label="Cancel" onPress={() => setRestorePreview(null)} />
              </Row>
            </View>
          )}
          {backupStatus.type === 'error' && (
            <AppText color="terracotta">{backupStatus.message}</AppText>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  scrollContent: {
    padding: spacing[4],
    gap: spacing[5],
  },
  section: {
    gap: spacing[3],
  },
  errorBlock: {
    gap: spacing[1],
  },
  dimmed: {
    opacity: 0.45,
  },
  restorePreviewCard: {
    gap: spacing[3],
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing[4],
  },
});
