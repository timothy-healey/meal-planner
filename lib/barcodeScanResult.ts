import type { PurchaseHistoryRow } from '../types/db';

export interface ScanResult {
  barcode: string;
  record: PurchaseHistoryRow | null;
}

let pending: ScanResult | null = null;

export function setPendingScanResult(result: ScanResult): void {
  pending = result;
}

export function takePendingScanResult(): ScanResult | null {
  const result = pending;
  pending = null;
  return result;
}
