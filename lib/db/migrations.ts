import type { SQLiteDatabase } from 'expo-sqlite';
import { SCHEMA_SQL } from './schema';

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
}
