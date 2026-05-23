export const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS recipes (
    id                  TEXT PRIMARY KEY,
    title               TEXT NOT NULL,
    meal_type           TEXT NOT NULL,
    servings            INTEGER NOT NULL,
    calories_per_serve  INTEGER NOT NULL,
    protein_per_serve_g INTEGER NOT NULL,
    cook_method         TEXT NOT NULL,
    prep_minutes        INTEGER NOT NULL,
    cook_minutes        INTEGER NOT NULL,
    ingredients_json    TEXT NOT NULL,
    method_steps_json   TEXT NOT NULL,
    is_favourite        INTEGER DEFAULT 0,
    source              TEXT DEFAULT 'imported',
    created_at          TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS weekly_plans (
    id               TEXT PRIMARY KEY,
    week_starting    TEXT NOT NULL,
    is_active        INTEGER DEFAULT 0,
    meta_json        TEXT NOT NULL,
    strategy_json    TEXT NOT NULL,
    days_json        TEXT NOT NULL,
    batch_plan_json  TEXT NOT NULL,
    created_at       TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shopping_items (
    id               TEXT PRIMARY KEY,
    plan_id          TEXT NOT NULL REFERENCES weekly_plans(id),
    category         TEXT NOT NULL,
    category_order   INTEGER NOT NULL,
    item_order       INTEGER NOT NULL,
    name             TEXT NOT NULL,
    qty              TEXT NOT NULL,
    estimated_price  REAL NOT NULL,
    is_oneoff        INTEGER DEFAULT 0,
    note             TEXT,
    is_checked       INTEGER DEFAULT 0,
    actual_price     REAL,
    store            TEXT
  );

  CREATE TABLE IF NOT EXISTS barcode_stores (
    barcode     TEXT NOT NULL,
    store       TEXT NOT NULL,
    first_seen  TEXT NOT NULL,
    PRIMARY KEY (barcode, store)
  );

  CREATE TABLE IF NOT EXISTS barcode_nutrition (
    barcode          TEXT PRIMARY KEY,
    brand_name       TEXT,
    item_name        TEXT NOT NULL,
    cal_per_100g     REAL NOT NULL,
    protein_per_100g REAL NOT NULL,
    carbs_per_100g   REAL NOT NULL,
    fat_per_100g     REAL NOT NULL,
    scanned_at       TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS price_history (
    id          TEXT PRIMARY KEY,
    barcode     TEXT REFERENCES barcode_nutrition(barcode),
    item_name   TEXT NOT NULL,
    store       TEXT NOT NULL,
    price       REAL NOT NULL,
    qty         TEXT NOT NULL,
    date        TEXT NOT NULL,
    plan_id     TEXT REFERENCES weekly_plans(id)
  );

  CREATE TABLE IF NOT EXISTS stores (
    id          TEXT PRIMARY KEY,
    chain       TEXT NOT NULL,
    branch      TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS store_aisles (
    id          TEXT PRIMARY KEY,
    store_id    TEXT NOT NULL REFERENCES stores(id),
    aisle_label TEXT NOT NULL,
    sort_order  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS item_aisle_map (
    id          TEXT PRIMARY KEY,
    store_id    TEXT NOT NULL REFERENCES stores(id),
    barcode     TEXT,
    item_name   TEXT NOT NULL,
    aisle_id    TEXT NOT NULL REFERENCES store_aisles(id),
    updated_at  TEXT NOT NULL
  );
`;
