import { useState, useEffect, useCallback } from 'react';
import { useDb } from '../providers/DatabaseProvider';
import { generateId } from '../lib/uuid';
import type { StoreRow } from '../types/db';

export function useStores() {
  const db = useDb();
  const [stores, setStores] = useState<StoreRow[]>([]);

  const load = useCallback(async () => {
    const rows = await db.getAllAsync<StoreRow>(
      'SELECT * FROM stores ORDER BY chain ASC',
    );
    setStores(rows);
  }, [db]);

  useEffect(() => { load(); }, [load]);

  const resolveOrCreate = useCallback(async (chainName: string): Promise<string> => {
    const existing = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM stores WHERE LOWER(chain) = LOWER(?)',
      [chainName],
    );
    if (existing) return existing.id;
    const id = generateId();
    await db.runAsync(
      'INSERT INTO stores (id, chain, branch, created_at) VALUES (?, ?, ?, ?)',
      [id, chainName, '', new Date().toISOString()],
    );
    await load();
    return id;
  }, [db, load]);

  return { stores, resolveOrCreate, reload: load };
}
