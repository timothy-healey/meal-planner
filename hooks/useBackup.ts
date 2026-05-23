import { useCallback, useState } from 'react';
import { File as FSFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useDb } from '../providers/DatabaseProvider';
import { runMigrations } from '../lib/db/migrations';

export type BackupStatus =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string };

export function useBackup(onRestore?: () => void) {
  const db = useDb();
  const [status, setStatus] = useState<BackupStatus>({ type: 'idle' });

  const exportBackup = useCallback(async () => {
    setStatus({ type: 'loading' });
    try {
      const [recipes, plans, items, prices, barcodeNutrition, barcodeStores, stores, aisles, aisleMap] =
        await Promise.all([
          db.getAllAsync('SELECT * FROM recipes'),
          db.getAllAsync('SELECT * FROM weekly_plans'),
          db.getAllAsync('SELECT * FROM shopping_items'),
          db.getAllAsync('SELECT * FROM price_history'),
          db.getAllAsync('SELECT * FROM barcode_nutrition'),
          db.getAllAsync('SELECT * FROM barcode_stores'),
          db.getAllAsync('SELECT * FROM stores'),
          db.getAllAsync('SELECT * FROM store_aisles'),
          db.getAllAsync('SELECT * FROM item_aisle_map'),
        ]);

      const backup = {
        backup_version: '1.0',
        exported_at: new Date().toISOString(),
        recipes,
        weekly_plans: plans,
        shopping_items: items,
        price_history: prices,
        barcode_nutrition: barcodeNutrition,
        barcode_stores: barcodeStores,
        stores,
        store_aisles: aisles,
        item_aisle_map: aisleMap,
      };

      const filename = `meal-planner-backup-${new Date().toISOString().split('T')[0]}.json`;
      const file = new FSFile(Paths.document, filename);
      file.write(JSON.stringify(backup));
      await Sharing.shareAsync(file.uri);
      setStatus({ type: 'success', message: 'Backup shared successfully' });
    } catch {
      setStatus({ type: 'error', message: 'Export failed — please try again' });
    }
  }, [db]);

  const restoreBackup = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
    if (result.canceled) return;

    setStatus({ type: 'loading' });
    let backup: any;
    try {
      const srcFile = new FSFile(result.assets[0].uri);
      const raw = await srcFile.text();
      backup = JSON.parse(raw);
    } catch {
      setStatus({ type: 'error', message: 'Could not read backup file' });
      return;
    }

    if (!backup.backup_version) {
      setStatus({ type: 'error', message: 'Invalid backup — missing backup_version' });
      return;
    }

    const summary = `${backup.recipes?.length ?? 0} recipes · ${backup.weekly_plans?.length ?? 0} plans`;
    const exportedDate = backup.exported_at?.split('T')[0] ?? 'unknown date';

    return { summary, exportedDate, execute: () => executeRestore(backup) };
  }, [db]);

  const executeRestore = useCallback(async (backup: any) => {
    setStatus({ type: 'loading' });
    try {
      await db.runAsync('BEGIN');
      const tables = ['item_aisle_map','store_aisles','stores','price_history',
        'shopping_items','weekly_plans','recipes','barcode_nutrition','barcode_stores'];
      for (const t of tables) {
        await db.runAsync(`DELETE FROM ${t}`);
      }
      await runMigrations(db);

      const inserts: Array<[string, any[]]> = [
        ...insertRows('recipes', backup.recipes ?? [], ['id','title','meal_type','servings',
          'calories_per_serve','protein_per_serve_g','cook_method','prep_minutes','cook_minutes',
          'ingredients_json','method_steps_json','is_favourite','source','created_at']),
        ...insertRows('weekly_plans', backup.weekly_plans ?? [], ['id','week_starting','is_active',
          'meta_json','strategy_json','days_json','batch_plan_json','created_at']),
        ...insertRows('shopping_items', backup.shopping_items ?? [], ['id','plan_id','category',
          'category_order','item_order','name','qty','estimated_price','is_oneoff','note',
          'is_checked','actual_price','store']),
        ...insertRows('price_history', backup.price_history ?? [], ['id','barcode','item_name','store','price','qty','date','plan_id']),
        ...insertRows('barcode_nutrition', backup.barcode_nutrition ?? [], ['barcode','brand_name','item_name','cal_per_100g','protein_per_100g','carbs_per_100g','fat_per_100g','scanned_at']),
        ...insertRows('barcode_stores', backup.barcode_stores ?? [], ['barcode','store','first_seen']),
        ...insertRows('stores', backup.stores ?? [], ['id','chain','branch','created_at']),
        ...insertRows('store_aisles', backup.store_aisles ?? [], ['id','store_id','aisle_label','sort_order']),
        ...insertRows('item_aisle_map', backup.item_aisle_map ?? [], ['id','store_id','barcode','item_name','aisle_id','updated_at']),
      ];

      for (const [sql, params] of inserts) {
        await db.runAsync(sql, params);
      }

      await db.runAsync('COMMIT');
      setStatus({ type: 'success', message: 'Backup restored' });
      onRestore?.();
    } catch {
      await db.runAsync('ROLLBACK');
      setStatus({ type: 'error', message: 'Restore failed — backup may be corrupt' });
    }
  }, [db, onRestore]);

  return { exportBackup, restoreBackup, status };
}

function insertRows(table: string, rows: any[], cols: string[]): Array<[string, any[]]> {
  const placeholders = cols.map(() => '?').join(',');
  const sql = `INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`;
  return rows.map((row) => [sql, cols.map((c) => row[c] ?? null)] as [string, any[]]);
}
