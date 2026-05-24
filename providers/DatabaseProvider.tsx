import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as SQLite from 'expo-sqlite';
import { runMigrations } from '../lib/db/migrations';

type DB = SQLite.SQLiteDatabase;

interface PlanVersionContextValue {
  planVersion: number;
  bumpPlanVersion: () => void;
}

const DbContext = createContext<DB | null>(null);
const PlanVersionContext = createContext<PlanVersionContextValue>({ planVersion: 0, bumpPlanVersion: () => {} });

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB | null>(null);
  const [planVersion, setPlanVersion] = useState(0);
  const bumpPlanVersion = useCallback(() => setPlanVersion(v => v + 1), []);

  useEffect(() => {
    SQLite.openDatabaseAsync('meal-planner.db').then(async (database) => {
      await runMigrations(database);
      setDb(database);
    });
  }, []);

  if (!db) return null;
  return (
    <DbContext.Provider value={db}>
      <PlanVersionContext.Provider value={{ planVersion, bumpPlanVersion }}>
        {children}
      </PlanVersionContext.Provider>
    </DbContext.Provider>
  );
}

export function useDb(): DB {
  const db = useContext(DbContext);
  if (!db) throw new Error('useDb must be used inside DatabaseProvider');
  return db;
}

export function usePlanVersion() {
  return useContext(PlanVersionContext);
}
