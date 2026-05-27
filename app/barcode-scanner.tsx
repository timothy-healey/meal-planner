import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../components/ui/AppText';
import { colors, font, spacing, radius } from '../constants/tokens';
import { setPendingScanResult } from '../lib/barcodeScanResult';
import { usePurchaseHistory } from '../hooks/usePurchaseHistory';
import { usePlan } from '../hooks/usePlan';
import * as Haptics from 'expo-haptics';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export default function BarcodeScannerScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [matchedRecord, setMatchedRecord] = useState<any>(null);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const { plan } = usePlan();
  const { getLatestForBarcode } = usePurchaseHistory(plan?.row.id ?? null);

  useFocusEffect(useCallback(() => {
    setScanned(false);
    setMatchedRecord(null);
    setScannedBarcode(null);
  }, []));

  async function handleBarcodeScanned({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);
    setScannedBarcode(data);
    const record = await getLatestForBarcode(data);
    setMatchedRecord(record);
  }

  function handleUse() {
    if (!scannedBarcode) return;
    setPendingScanResult({ barcode: scannedBarcode, record: matchedRecord });
    router.back();
  }

  if (!permission) {
    return <View style={[styles.container, { paddingTop: insets.top }]} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
            <AppText weight="semibold" size="sm" color="onGreenSubtle">‹ Cancel</AppText>
          </TouchableOpacity>
          <AppText weight="extrabold" size="xl" color="onGreen">Scan Barcode</AppText>
          <View style={styles.cancelBtn} />
        </View>
        <View style={styles.permissionBody}>
          <AppText weight="semibold" size="md" color="textPrimary" style={styles.permissionText}>
            Camera access is needed to scan barcodes.
          </AppText>
          <TouchableOpacity style={styles.grantBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); requestPermission(); }} activeOpacity={0.85}>
            <AppText weight="extrabold" size="md" color="onGreen">Grant Access</AppText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.cancelBtn}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <AppText weight="semibold" size="sm" color="onGreenSubtle">‹ Cancel</AppText>
        </TouchableOpacity>
        <AppText weight="extrabold" size="xl" color="onGreen">Scan Barcode</AppText>
        <View style={styles.cancelBtn} />
      </View>

      <View style={[styles.viewfinder, { height: windowHeight * 0.28 }]}>
        <CameraView
          style={StyleSheet.absoluteFill}
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'] }}
        />
        <View style={styles.bracketContainer}>
          <View style={styles.bracket}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            <View style={styles.scanLine} />
          </View>
        </View>
      </View>

      <View style={styles.hint}>
        <AppText weight="medium" size="sm" color="textSecondary">
          Point at the barcode on the product
        </AppText>
      </View>

      <View style={styles.result}>
        {!scanned && (
          <AppText weight="regular" size="sm" color="textTertiary" style={styles.waitingText}>
            Waiting for barcode…
          </AppText>
        )}

        {scanned && matchedRecord && (
          <>
            <AppText weight="bold" size="2xs" color="textTertiary" style={styles.resultLabel}>
              FOUND IN YOUR HISTORY
            </AppText>
            <View style={styles.matchCard}>
              <View style={styles.matchInfo}>
                <AppText weight="bold" size="md" color="textPrimary">
                  {matchedRecord.product_name || matchedRecord.item_name}
                </AppText>
                <AppText weight="regular" size="sm" color="textSecondary">
                  {matchedRecord.brand}{matchedRecord.brand ? ' · ' : ''}last bought {formatDate(matchedRecord.purchased_at)}
                </AppText>
              </View>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleUse(); }}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Use this item"
              >
                <AppText weight="bold" size="sm" color="onGreen">Use</AppText>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setScanned(false); }}
              style={styles.rescanLink}
              accessibilityRole="button"
              accessibilityLabel="Scan again"
            >
              <AppText weight="semibold" size="sm" color="textSecondary">Scan again</AppText>
            </TouchableOpacity>
          </>
        )}

        {scanned && !matchedRecord && (
          <>
            <AppText weight="bold" size="2xs" color="textTertiary" style={styles.resultLabel}>
              BARCODE SCANNED
            </AppText>
            <View style={styles.noMatchCard}>
              <AppText weight="bold" size="sm" color="textTertiary" style={styles.centred}>
                Not in your history yet
              </AppText>
              <AppText weight="regular" size="sm" color="textNote" style={[styles.centred, styles.noMatchSub]}>
                Barcode saved — fill in the details manually
              </AppText>
            </View>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleUse(); }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Continue with scanned barcode"
            >
              <AppText weight="bold" size="sm" color="onGreen">Continue</AppText>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const CORNER_SIZE = 18;
const CORNER_WEIGHT = 2;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.green },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  cancelBtn: { width: 70 },
  viewfinder: { backgroundColor: colors.scannerBg, position: 'relative' },
  bracketContainer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  bracket: { width: 180, height: 100, position: 'relative' },
  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE, borderColor: colors.onGreen },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_WEIGHT, borderLeftWidth: CORNER_WEIGHT, borderTopLeftRadius: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_WEIGHT, borderRightWidth: CORNER_WEIGHT, borderTopRightRadius: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_WEIGHT, borderLeftWidth: CORNER_WEIGHT, borderBottomLeftRadius: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_WEIGHT, borderRightWidth: CORNER_WEIGHT, borderBottomRightRadius: 3 },
  scanLine: {
    position: 'absolute', left: 8, right: 8, top: '50%', height: 1.5,
    backgroundColor: colors.orange,
    shadowColor: colors.orange, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 4,
  },
  hint: {
    backgroundColor: colors.card, borderBottomWidth: 1, borderColor: colors.divider,
    paddingVertical: spacing[2], alignItems: 'center',
  },
  result: { flex: 1, backgroundColor: colors.cream, padding: spacing[4] },
  waitingText: { textAlign: 'center' },
  resultLabel: { letterSpacing: font.tracking.caps, marginBottom: spacing[2] },
  matchCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderRadius: radius.md, padding: spacing[3],
    borderWidth: 1.5, borderColor: 'rgba(28,69,60,0.15)', marginBottom: spacing[2],
  },
  matchInfo: { flex: 1, gap: spacing[1] },
  noMatchCard: {
    backgroundColor: colors.card, borderRadius: radius.md, padding: spacing[4],
    borderWidth: 1.5, borderColor: colors.divider, borderStyle: 'dashed', marginBottom: spacing[3],
  },
  centred: { textAlign: 'center' },
  noMatchSub: { marginTop: spacing[1] },
  actionBtn: {
    backgroundColor: colors.orange, borderRadius: radius.full,
    paddingVertical: spacing[2], paddingHorizontal: spacing[4], alignItems: 'center',
  },
  rescanLink: { alignItems: 'center', paddingVertical: spacing[2] },
  permissionBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing[6], backgroundColor: colors.cream },
  permissionText: { textAlign: 'center', marginBottom: spacing[4] },
  grantBtn: { backgroundColor: colors.orange, borderRadius: radius.full, paddingVertical: spacing[3], paddingHorizontal: spacing[6] },
});
