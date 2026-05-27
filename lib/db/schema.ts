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
    notes               TEXT,
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
    is_checked       INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS purchase_history (
    id              TEXT PRIMARY KEY,
    plan_id         TEXT REFERENCES weekly_plans(id),
    item_name       TEXT NOT NULL,
    store_id        TEXT REFERENCES stores(id),
    brand           TEXT,
    product_name    TEXT,
    qty_amount      REAL,
    qty_unit        TEXT CHECK (qty_unit IN ('g', 'kg', 'mL', 'L', 'units')),
    price           REAL,
    is_sale         INTEGER NOT NULL DEFAULT 0,
    barcode         TEXT,
    purchased_at    TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'confirmed'
  );

  CREATE INDEX IF NOT EXISTS idx_purchase_history_item_name
    ON purchase_history(item_name);

  CREATE INDEX IF NOT EXISTS idx_purchase_history_barcode
    ON purchase_history(barcode);

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

  CREATE TABLE IF NOT EXISTS food_nutrition (
    id TEXT PRIMARY KEY,
    item_name TEXT NOT NULL,
    brand TEXT,
    product_name TEXT,
    basis TEXT NOT NULL DEFAULT 'per_100g'
      CHECK (basis IN ('per_100g', 'per_100mL', 'per_unit')),
    cal_per_basis REAL,
    protein_per_basis REAL,
    carbs_per_basis REAL,
    fat_per_basis REAL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_food_nutrition_item_name
    ON food_nutrition(item_name);

  CREATE TABLE IF NOT EXISTS ingredient_nutrition_link (
    recipe_id TEXT NOT NULL,
    ingredient_index INTEGER NOT NULL,
    food_nutrition_id TEXT NOT NULL REFERENCES food_nutrition(id),
    PRIMARY KEY (recipe_id, ingredient_index)
  );
`;
