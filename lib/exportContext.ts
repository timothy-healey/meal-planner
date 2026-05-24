import type { SQLiteDatabase } from 'expo-sqlite';

interface NutritionPayload {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface PurchaseEntry {
  item: string;
  brand: string | null;
  product: string | null;
  store: string;
  qty: string | null;
  price: number | null;
  is_sale: boolean;
  barcode: string | null;
  nutrition_basis?: string;
  nutrition?: NutritionPayload;
}

export async function buildClaudeContext(db: SQLiteDatabase, planId: string): Promise<string> {
  const plan = await db.getFirstAsync<{ week_starting: string }>(
    'SELECT week_starting FROM weekly_plans WHERE id = ?',
    [planId]
  );

  const purchases = await db.getAllAsync<{
    item_name: string;
    brand: string | null;
    product_name: string | null;
    store: string | null;
    qty_amount: number | null;
    qty_unit: string | null;
    price: number | null;
    is_sale: number;
    barcode: string | null;
  }>(
    `SELECT ph.item_name, ph.brand, ph.product_name, s.chain AS store,
            ph.qty_amount, ph.qty_unit, ph.price, ph.is_sale, ph.barcode
     FROM purchase_history ph
     LEFT JOIN stores s ON ph.store_id = s.id
     WHERE ph.plan_id = ? ORDER BY ph.purchased_at ASC`,
    [planId]
  );

  const entries: PurchaseEntry[] = [];

  for (const p of purchases) {
    const qty = p.qty_amount != null && p.qty_unit != null
      ? `${p.qty_amount}${p.qty_unit}`
      : null;

    const entry: PurchaseEntry = {
      item: p.item_name,
      brand: p.brand,
      product: p.product_name,
      store: p.store ?? '',
      qty,
      price: p.price,
      is_sale: p.is_sale === 1,
      barcode: p.barcode,
    };

    let nutrition: NutritionPayload | undefined;
    let basis: string | undefined;

    if (p.barcode) {
      const bn = await db.getFirstAsync<{
        cal_per_100g: number;
        protein_per_100g: number;
        carbs_per_100g: number;
        fat_per_100g: number;
      }>(
        `SELECT cal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g
         FROM barcode_nutrition WHERE barcode = ?`,
        [p.barcode]
      );
      if (bn) {
        nutrition = {
          calories: bn.cal_per_100g,
          protein_g: bn.protein_per_100g,
          carbs_g: bn.carbs_per_100g,
          fat_g: bn.fat_per_100g,
        };
        basis = 'per_100g';
      }
    }

    if (!nutrition) {
      const fn = await db.getFirstAsync<{
        basis: string;
        cal_per_basis: number;
        protein_per_basis: number;
        carbs_per_basis: number;
        fat_per_basis: number;
      }>(
        `SELECT basis, cal_per_basis, protein_per_basis, carbs_per_basis, fat_per_basis
         FROM food_nutrition
         WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?))
           AND COALESCE(brand, '') = COALESCE(?, '')
           AND COALESCE(product_name, '') = COALESCE(?, '')
         ORDER BY updated_at DESC
         LIMIT 1`,
        [p.item_name, p.brand, p.product_name]
      );
      if (fn) {
        nutrition = {
          calories: fn.cal_per_basis,
          protein_g: fn.protein_per_basis,
          carbs_g: fn.carbs_per_basis,
          fat_g: fn.fat_per_basis,
        };
        basis = fn.basis;
      }
    }

    if (nutrition) {
      entry.nutrition = nutrition;
      entry.nutrition_basis = basis;
    }

    entries.push(entry);
  }

  return JSON.stringify({
    generated_at: new Date().toISOString().split('T')[0],
    week_starting: plan?.week_starting ?? '',
    purchases: entries,
  }, null, 2);
}
