import type { SQLiteDatabase } from 'expo-sqlite';
import { SCHEMA_SQL } from './schema';
import { generateId } from '../uuid';

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(SCHEMA_SQL);

  const rows = await db.getAllAsync<{ user_version: number }>('PRAGMA user_version');
  const version = rows[0]?.user_version ?? 0;

  if (version < 1) {
    // Drop columns removed from shopping_items.
    // try/catch handles fresh installs where columns were never created.
    try {
      await db.execAsync('ALTER TABLE shopping_items DROP COLUMN actual_price');
    } catch {}
    try {
      await db.execAsync('ALTER TABLE shopping_items DROP COLUMN store');
    } catch {}
    await db.execAsync('PRAGMA user_version = 1');
  }

  if (version < 2) {
    // food_nutrition and ingredient_nutrition_link are created by SCHEMA_SQL above (IF NOT EXISTS).
    // Nothing destructive to run — just bump the version.
    await db.execAsync('PRAGMA user_version = 2');
  }

  if (version < 3) {
    // Drop the unused price_history table
    try { await db.execAsync('DROP TABLE IF EXISTS price_history'); } catch {}

    // Detect if the live purchase_history table still has the legacy `store` column.
    // Fresh installs already have the new schema, so we skip the rebuild.
    const cols = await db.getAllAsync<{ name: string }>(
      "PRAGMA table_info(purchase_history)",
    );
    const hasLegacyStore = cols.some(c => c.name === 'store');

    if (hasLegacyStore) {
      // Create the new purchase_history schema (store_id, nullable plan_id)
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS purchase_history_v3 (
          id           TEXT PRIMARY KEY,
          plan_id      TEXT REFERENCES weekly_plans(id),
          item_name    TEXT NOT NULL,
          store_id     TEXT REFERENCES stores(id),
          brand        TEXT,
          product_name TEXT,
          qty_amount   REAL,
          qty_unit     TEXT CHECK (qty_unit IN ('g', 'kg', 'mL', 'L', 'units')),
          price        REAL,
          is_sale      INTEGER NOT NULL DEFAULT 0,
          barcode      TEXT,
          purchased_at TEXT NOT NULL
        )
      `);

      // Migrate existing rows — map free-text store names to stores.id
      const existing = await db.getAllAsync<{
        id: string; plan_id: string; item_name: string; store: string;
        brand: string | null; product_name: string | null;
        qty_amount: number | null; qty_unit: string | null;
        price: number | null; is_sale: number; barcode: string | null;
        purchased_at: string;
      }>('SELECT * FROM purchase_history');

      if (existing.length > 0) {
        const existingStores = await db.getAllAsync<{ id: string; chain: string }>(
          'SELECT id, chain FROM stores',
        );
        const storeMap = new Map<string, string>();
        for (const s of existingStores) {
          storeMap.set(s.chain.toLowerCase(), s.id);
        }

        // Create missing store entries for any unrecognised store names
        const distinctStoreNames = [...new Set(existing.map(r => r.store))];
        for (const name of distinctStoreNames) {
          const key = name.toLowerCase();
          if (!storeMap.has(key)) {
            const id = generateId();
            await db.runAsync(
              'INSERT INTO stores (id, chain, branch, created_at) VALUES (?, ?, ?, ?)',
              [id, name, '', new Date().toISOString()],
            );
            storeMap.set(key, id);
          }
        }

        // Copy rows to new table
        for (const row of existing) {
          const storeId = storeMap.get(row.store.toLowerCase()) ?? null;
          await db.runAsync(
            `INSERT INTO purchase_history_v3
               (id, plan_id, item_name, store_id, brand, product_name,
                qty_amount, qty_unit, price, is_sale, barcode, purchased_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [row.id, row.plan_id, row.item_name, storeId,
             row.brand, row.product_name, row.qty_amount, row.qty_unit,
             row.price, row.is_sale, row.barcode, row.purchased_at],
          );
        }
      }

      await db.execAsync('DROP TABLE IF EXISTS purchase_history');
      await db.execAsync('ALTER TABLE purchase_history_v3 RENAME TO purchase_history');
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_purchase_history_item_name
          ON purchase_history(item_name);
        CREATE INDEX IF NOT EXISTS idx_purchase_history_barcode
          ON purchase_history(barcode);
      `);
    }

    await db.execAsync('PRAGMA user_version = 3');
  }

  if (version < 4) {
    // Fresh installs already get the column via SCHEMA_SQL — the ALTER is wrapped
    // in try/catch so re-running on a fresh DB is a no-op.
    try {
      await db.execAsync(
        "ALTER TABLE purchase_history ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed'"
      );
    } catch {}
    await db.execAsync('PRAGMA user_version = 4');
  }

  if (version < 5) {
    // Fresh installs already get the column via SCHEMA_SQL — the ALTER is wrapped
    // in try/catch so re-running on a fresh DB is a no-op.
    try {
      await db.execAsync('ALTER TABLE recipes ADD COLUMN notes TEXT');
    } catch {}
    await db.execAsync('PRAGMA user_version = 5');
  }

  if (version < 6) {
    await db.execAsync('PRAGMA user_version = 6');
  }
}
