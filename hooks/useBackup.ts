import { useCallback, useEffect, useState } from 'react';
import { Directory, File as FSFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDb } from '../providers/DatabaseProvider';
import { runMigrations } from '../lib/db/migrations';

export type BackupStatus =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string };

const FOLDER_KEY = 'backup_folder';

/** The folder the user chose to save backups into. */
interface SavedFolder {
  uri: string;
  name: string;
}

/**
 * Expo surfaces a dismissed picker as a thrown CodedException rather than a
 * result flag, and the code differs by platform (`ERR_PICKER_CANCELLED` on
 * Android, `ERR_FILE_PICKING_CANCELLED` on iOS), so match on the shared word.
 */
function isCancellation(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null;
  return `${err?.code ?? ''} ${err?.message ?? ''}`.toLowerCase().includes('cancel');
}

export function useBackup(onRestore?: () => void) {
  const db = useDb();
  const [status, setStatus] = useState<BackupStatus>({ type: 'idle' });
  const [folder, setFolder] = useState<SavedFolder | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(FOLDER_KEY).then((raw) => {
      if (raw) setFolder(JSON.parse(raw));
    });
  }, []);

  const buildBackup = useCallback(async () => {
    const [
      recipes, plans, items, purchases, products,
      barcodeNutrition, barcodeStores, stores, aisles, aisleMap,
    ] = await Promise.all([
      db.getAllAsync('SELECT * FROM recipes'),
      db.getAllAsync('SELECT * FROM weekly_plans'),
      db.getAllAsync('SELECT * FROM shopping_items'),
      db.getAllAsync('SELECT * FROM purchase_history'),
      db.getAllAsync('SELECT * FROM products'),
      db.getAllAsync('SELECT * FROM barcode_nutrition'),
      db.getAllAsync('SELECT * FROM barcode_stores'),
      db.getAllAsync('SELECT * FROM stores'),
      db.getAllAsync('SELECT * FROM store_aisles'),
      db.getAllAsync('SELECT * FROM item_aisle_map'),
    ]);

    return {
      backup_version: '2.0',
      exported_at: new Date().toISOString(),
      recipes,
      weekly_plans: plans,
      shopping_items: items,
      purchase_history: purchases,
      products,
      barcode_nutrition: barcodeNutrition,
      barcode_stores: barcodeStores,
      stores,
      store_aisles: aisles,
      item_aisle_map: aisleMap,
    };
  }, [db]);

  function backupFilename(): string {
    return `meal-planner-backup-${new Date().toISOString().split('T')[0]}.json`;
  }

  const rememberFolder = useCallback(async (next: SavedFolder | null) => {
    if (next) await AsyncStorage.setItem(FOLDER_KEY, JSON.stringify(next));
    else await AsyncStorage.removeItem(FOLDER_KEY);
    setFolder(next);
  }, []);

  /** Opens the system folder picker. Returns null if dismissed or unavailable. */
  const pickFolder = useCallback(async (): Promise<SavedFolder | null> => {
    try {
      const dir = await Directory.pickDirectoryAsync();
      const next = { uri: dir.uri, name: dir.name };
      await rememberFolder(next);
      return next;
    } catch (e) {
      setStatus(
        isCancellation(e)
          ? { type: 'idle' }
          : { type: 'error', message: 'Could not open the folder picker' },
      );
      return null;
    }
  }, [rememberFolder]);

  /** Re-pick the save folder without writing anything. */
  const chooseFolder = useCallback(async () => {
    await pickFolder();
  }, [pickFolder]);

  const saveBackup = useCallback(async () => {
    setStatus({ type: 'loading' });

    let target = folder ?? (await pickFolder());
    if (!target) return;

    let json: string;
    try {
      json = JSON.stringify(await buildBackup());
    } catch {
      setStatus({ type: 'error', message: 'Export failed — please try again' });
      return;
    }

    const filename = backupFilename();
    const writeInto = (dest: SavedFolder) => {
      new Directory(dest.uri).createFile(filename, 'application/json').write(json);
    };

    try {
      writeInto(target);
    } catch {
      // The grant is revoked if the folder is deleted or the app reinstalled.
      // Forget it, ask once for a new one, and don't loop past that.
      await rememberFolder(null);
      setStatus({ type: 'loading' });
      const retry = await pickFolder();
      if (!retry) return;
      try {
        writeInto(retry);
      } catch {
        setStatus({ type: 'error', message: 'Could not write to that folder' });
        return;
      }
      target = retry;
    }

    setStatus({ type: 'success', message: `Saved to ${target.name}/${filename}` });
  }, [folder, pickFolder, rememberFolder, buildBackup]);

  const shareBackup = useCallback(async () => {
    setStatus({ type: 'loading' });
    try {
      const filename = backupFilename();
      const file = new FSFile(Paths.document, filename);
      file.write(JSON.stringify(await buildBackup()));
      await Sharing.shareAsync(file.uri);
      setStatus({ type: 'success', message: 'Backup shared successfully' });
    } catch {
      setStatus({ type: 'error', message: 'Export failed — please try again' });
    }
  }, [buildBackup]);

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
      // Delete in reverse-FK order so referencing rows go before their targets.
      const tables = [
        'item_aisle_map', 'store_aisles', 'shopping_items', 'purchase_history',
        'barcode_nutrition', 'barcode_stores', 'weekly_plans', 'recipes',
        'products', 'stores',
      ];
      for (const t of tables) {
        await db.runAsync(`DELETE FROM ${t}`);
      }
      await runMigrations(db);

      // Insert in forward-FK order so referenced rows exist when referencing rows insert.
      const inserts: Array<[string, any[]]> = [
        ...insertRows('stores', backup.stores ?? [],
          ['id','chain','branch','created_at']),
        ...insertRows('products', backup.products ?? [],
          ['id','brand','product_name','item_name','basis',
           'cal_per_basis','protein_per_basis','carbs_per_basis','fat_per_basis','updated_at']),
        ...insertRows('weekly_plans', backup.weekly_plans ?? [],
          ['id','week_starting','is_active','meta_json','strategy_json',
           'days_json','batch_plan_json','created_at']),
        ...insertRows('recipes', backup.recipes ?? [],
          ['id','title','meal_type','servings','calories_per_serve','protein_per_serve_g',
           'cook_method','prep_minutes','cook_minutes','ingredients_json','method_steps_json',
           'is_favourite','source','notes','created_at']),
        ...insertRows('shopping_items', backup.shopping_items ?? [],
          ['id','plan_id','category','category_order','item_order','name','qty',
           'estimated_price','is_oneoff','note','is_checked']),
        ...insertRows('purchase_history', backup.purchase_history ?? [],
          ['id','plan_id','item_name','store_id','product_id',
           'qty_amount','qty_unit','price','is_sale','barcode','purchased_at','status']),
        ...insertRows('barcode_nutrition', backup.barcode_nutrition ?? [],
          ['barcode','brand_name','item_name','cal_per_100g','protein_per_100g',
           'carbs_per_100g','fat_per_100g','scanned_at']),
        ...insertRows('barcode_stores', backup.barcode_stores ?? [],
          ['barcode','store','first_seen']),
        ...insertRows('store_aisles', backup.store_aisles ?? [],
          ['id','store_id','aisle_label','sort_order']),
        ...insertRows('item_aisle_map', backup.item_aisle_map ?? [],
          ['id','store_id','barcode','item_name','aisle_id','updated_at']),
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

  return {
    saveBackup,
    shareBackup,
    chooseFolder,
    folderName: folder?.name ?? null,
    restoreBackup,
    status,
  };
}

function insertRows(table: string, rows: any[], cols: string[]): Array<[string, any[]]> {
  const placeholders = cols.map(() => '?').join(',');
  const sql = `INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`;
  return rows.map((row) => [sql, cols.map((c) => row[c] ?? null)] as [string, any[]]);
}
