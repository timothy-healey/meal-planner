import { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { GreenHeader } from '../components/ui/GreenHeader';
import { AppText } from '../components/ui/AppText';
import { Pill } from '../components/ui/Pill';
import { Divider } from '../components/ui/Divider';
import { Row } from '../components/ui/Row';
import { useImport } from '../hooks/useImport';
import { useBackup } from '../hooks/useBackup';
import { colors, spacing, radius } from '../constants/tokens';

export default function SettingsScreen() {
  const { importPlan, status: importStatus } = useImport(() => router.back());
  const { exportBackup, restoreBackup, status: backupStatus } = useBackup(() => router.back());
  const [restorePreview, setRestorePreview] = useState<{
    summary: string;
    exportedDate: string;
    execute: () => void;
  } | null>(null);

  async function handleRestore() {
    const preview = await restoreBackup();
    if (preview) setRestorePreview(preview);
  }

  function confirmRestore() {
    if (!restorePreview) return;
    restorePreview.execute();
    setRestorePreview(null);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <GreenHeader>
        <Row justify="space-between" align="center">
          <AppText weight="extrabold" size="xl" color="onGreen">Settings</AppText>
          <Pill label="✕ Close" onPress={() => router.back()} variant="green" />
        </Row>
      </GreenHeader>

      <ScrollView contentContainerStyle={{ padding: spacing[4], gap: spacing[5] }}>
        {/* Import */}
        <View style={{ gap: spacing[3] }}>
          <AppText weight="bold" size="lg">Import Plan</AppText>
          <AppText color="textSecondary">
            Replace the active shopping list with a new weekly plan JSON.
            Your recipe library is preserved.
          </AppText>
          <Pill label="📂 Import weekly plan" onPress={importPlan} />
          {importStatus.type === 'success' && (
            <AppText color="green">{importStatus.message}</AppText>
          )}
          {importStatus.type === 'error' && (
            <View style={{ gap: spacing[1] }}>
              <AppText color="terracotta">{importStatus.message}</AppText>
              <Pill label="Try again" onPress={importPlan} />
            </View>
          )}
        </View>

        <Divider />

        {/* Export */}
        <View style={{ gap: spacing[3] }}>
          <AppText weight="bold" size="lg">Export Backup</AppText>
          <AppText color="textSecondary">
            Save all your data — recipes, plans, and shopping history — to a JSON file.
          </AppText>
          <Pill label="📤 Export backup" onPress={exportBackup} />
          {backupStatus.type === 'success' && (
            <AppText color="green">{backupStatus.message}</AppText>
          )}
        </View>

        <Divider />

        {/* Restore */}
        <View style={{ gap: spacing[3] }}>
          <AppText weight="bold" size="lg">Restore Backup</AppText>
          <AppText color="textSecondary">
            Replace all data from a backup file. Cannot be undone.
          </AppText>
          {!restorePreview ? (
            <Pill label="📥 Restore from backup" onPress={handleRestore} />
          ) : (
            <View style={{
              gap: spacing[3],
              backgroundColor: colors.card,
              borderRadius: radius.md,
              padding: spacing[4],
            }}>
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
