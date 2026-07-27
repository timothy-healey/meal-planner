import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../../../lib/db/migrations';

/**
 * Executes the real migration SQL against a real SQLite database.
 *
 * The sibling unit test mocks `execAsync`, so it only ever asserts on the SQL
 * *string* — which is how a launch-blocking bug shipped: an index in SCHEMA_SQL
 * referenced a column the ALTERs had not added yet, and the mock happily
 * recorded it. Anything that depends on statements actually executing, in
 * order, belongs here.
 */
function adapter(db: InstanceType<typeof DatabaseSync>) {
  return {
    execAsync: async (sql: string) => { db.exec(sql); },
    getAllAsync: async (sql: string, params: unknown[] = []) =>
      db.prepare(sql).all(...(params as never[])),
    getFirstAsync: async (sql: string, params: unknown[] = []) =>
      db.prepare(sql).get(...(params as never[])) ?? null,
    runAsync: async (sql: string, params: unknown[] = []) => {
      db.prepare(sql).run(...(params as never[]));
    },
  };
}

function columns(db: InstanceType<typeof DatabaseSync>, table: string): string[] {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((r: any) => r.name);
}

function version(db: InstanceType<typeof DatabaseSync>): number {
  return (db.prepare('PRAGMA user_version').get() as any).user_version;
}

/** A v6 install: the tables as they were before this feature. */
function seedV6(db: InstanceType<typeof DatabaseSync>) {
  db.exec(`
    CREATE TABLE weekly_plans (
      id TEXT PRIMARY KEY, week_starting TEXT NOT NULL, is_active INTEGER DEFAULT 0,
      meta_json TEXT NOT NULL, strategy_json TEXT NOT NULL, days_json TEXT NOT NULL,
      batch_plan_json TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE shopping_items (
      id TEXT PRIMARY KEY, plan_id TEXT NOT NULL, category TEXT NOT NULL,
      category_order INTEGER NOT NULL, item_order INTEGER NOT NULL,
      name TEXT NOT NULL, qty TEXT NOT NULL, estimated_price REAL NOT NULL,
      is_oneoff INTEGER DEFAULT 0, note TEXT, is_checked INTEGER DEFAULT 0);
    PRAGMA user_version = 6;
  `);
  db.prepare(`INSERT INTO weekly_plans
    (id, week_starting, is_active, meta_json, strategy_json, days_json, batch_plan_json, created_at)
    VALUES ('p1','2026-07-20',1,'{}','{}','[]','[]','2026-07-20')`).run();
  db.prepare(`INSERT INTO shopping_items
    (id, plan_id, category, category_order, item_order, name, qty, estimated_price)
    VALUES ('i1','p1','Fresh Produce',0,0,'Onion','2',1.5)`).run();
}

describe('runMigrations against real SQLite', () => {
  it('upgrades a v6 install without throwing', async () => {
    const db = new DatabaseSync(':memory:');
    seedV6(db);
    await expect(runMigrations(adapter(db) as never)).resolves.toBeUndefined();
    expect(version(db)).toBe(7);
  });

  it('adds the new columns to an existing shopping_items', async () => {
    const db = new DatabaseSync(':memory:');
    seedV6(db);
    await runMigrations(adapter(db) as never);
    expect(columns(db, 'shopping_items')).toEqual(
      expect.arrayContaining(['item_key', 'planned_qty']));
  });

  it("marks pre-existing plans as imported", async () => {
    const db = new DatabaseSync(':memory:');
    seedV6(db);
    await runMigrations(adapter(db) as never);
    const row = db.prepare('SELECT source FROM weekly_plans WHERE id = ?').get('p1') as any;
    expect(row.source).toBe('imported');
  });

  it('preserves existing shopping rows through the upgrade', async () => {
    const db = new DatabaseSync(':memory:');
    seedV6(db);
    await runMigrations(adapter(db) as never);
    const row = db.prepare('SELECT name, item_key FROM shopping_items WHERE id = ?').get('i1') as any;
    expect(row.name).toBe('Onion');
    expect(row.item_key).toBeNull();   // pre-existing rows are not derived
  });

  it('creates the partial index only after the columns exist', async () => {
    const db = new DatabaseSync(':memory:');
    seedV6(db);
    await runMigrations(adapter(db) as never);
    const names = db.prepare('PRAGMA index_list(shopping_items)').all().map((r: any) => r.name);
    expect(names).toContain('idx_shopping_item_key');
  });

  it('creates the new tables on an upgrading install', async () => {
    const db = new DatabaseSync(':memory:');
    seedV6(db);
    await runMigrations(adapter(db) as never);
    expect(columns(db, 'plan_recipes')).toContain('target_serves');
    expect(columns(db, 'item_category_map')).toContain('item_key');
  });

  it('runs clean on a fresh install', async () => {
    const db = new DatabaseSync(':memory:');
    await expect(runMigrations(adapter(db) as never)).resolves.toBeUndefined();
    expect(version(db)).toBe(7);
    expect(columns(db, 'shopping_items')).toEqual(
      expect.arrayContaining(['item_key', 'planned_qty']));
  });

  it('is idempotent — a second run changes nothing and does not throw', async () => {
    const db = new DatabaseSync(':memory:');
    seedV6(db);
    await runMigrations(adapter(db) as never);
    await expect(runMigrations(adapter(db) as never)).resolves.toBeUndefined();
    expect(version(db)).toBe(7);
  });

  it('lets the partial index hold two null keys but not two equal ones', async () => {
    const db = new DatabaseSync(':memory:');
    await runMigrations(adapter(db) as never);
    // node:sqlite enforces foreign keys by default; the app does not (every
    // REFERENCES in the schema is documentary today). Satisfy the parent row
    // rather than disabling enforcement — a real plan always exists here.
    db.prepare(`INSERT INTO weekly_plans
      (id, week_starting, is_active, meta_json, strategy_json, days_json,
       batch_plan_json, created_at)
      VALUES ('p1','2026-07-20',1,'{}','{}','[]','[]','2026-07-20')`).run();

    const insert = (id: string, key: string | null) =>
      db.prepare(`INSERT INTO shopping_items
        (id, plan_id, category, category_order, item_order, name, qty,
         estimated_price, item_key)
        VALUES (?, 'p1', 'Pantry', 0, 0, 'x', '1', 0, ?)`).run(id, key);

    insert('a', null);
    insert('b', null);            // manual rows: many nulls are fine
    insert('c', 'name:onion');
    expect(() => insert('d', 'name:onion')).toThrow(/UNIQUE/);
  });
});
