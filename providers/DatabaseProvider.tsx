import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SQLite from 'expo-sqlite';
import { runMigrations } from '../lib/db/migrations';

type DB = SQLite.SQLiteDatabase;
const DatabaseContext = createContext<DB | null>(null);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB | null>(null);

  useEffect(() => {
    SQLite.openDatabaseAsync('meal-planner.db').then(async (database) => {
      await runMigrations(database);
      setDb(database);
    });
  }, []);

  if (!db) return null;
  return <DatabaseContext.Provider value={db}>{children}</DatabaseContext.Provider>;
}

export function useDb(): DB {
  const db = useContext(DatabaseContext);
  if (!db) throw new Error('useDb must be used inside DatabaseProvider');
  return db;
}
