import { runMigrations } from '../../../lib/db/migrations';

const mockDb = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  getAllAsync: jest.fn().mockResolvedValue([{ user_version: 0 }]),
  runAsync: jest.fn().mockResolvedValue(undefined),
};

describe('runMigrations', () => {
  beforeEach(() => {
    mockDb.execAsync.mockClear();
    mockDb.getAllAsync.mockClear();
    mockDb.runAsync.mockClear();
    mockDb.getAllAsync.mockResolvedValue([{ user_version: 0 }]);
  });

  it('calls execAsync with SQL containing all core table names', async () => {
    await runMigrations(mockDb as any);
    const sql: string = mockDb.execAsync.mock.calls[0][0];
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS recipes');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS weekly_plans');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS shopping_items');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS purchase_history');
  });

  it('runs version-1 migration on a fresh database', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ user_version: 0 }]);
    await runMigrations(mockDb as any);
    const allSql = mockDb.execAsync.mock.calls.map((c: any[]) => c[0]).join('\n');
    expect(allSql).toContain('user_version = 1');
  });

  it('skips version-1 migration when already at version 1', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ user_version: 1 }]);
    await runMigrations(mockDb as any);
    const allSql = mockDb.execAsync.mock.calls.map((c: any[]) => c[0]).join('\n');
    expect(allSql).not.toContain('DROP COLUMN');
  });

  it('calls execAsync with SQL containing the two new nutrition tables', async () => {
    await runMigrations(mockDb as any);
    const sql: string = mockDb.execAsync.mock.calls[0][0];
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS food_nutrition');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS ingredient_nutrition_link');
  });

  it('runs version-2 migration on a v1 database', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ user_version: 1 }]);
    await runMigrations(mockDb as any);
    const allSql = mockDb.execAsync.mock.calls.map((c: any[]) => c[0]).join('\n');
    expect(allSql).toContain('user_version = 2');
  });

  it('skips version-2 migration when already at version 2', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ user_version: 2 }]);
    await runMigrations(mockDb as any);
    const allSql = mockDb.execAsync.mock.calls.map((c: any[]) => c[0]).join('\n');
    expect(allSql).not.toContain('user_version = 2');
  });

  it('runs version-4 migration on a v3 database (adds status column)', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ user_version: 3 }]);
    await runMigrations(mockDb as any);
    const allSql = mockDb.execAsync.mock.calls.map((c: any[]) => c[0]).join('\n');
    expect(allSql).toContain("ALTER TABLE purchase_history ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed'");
    expect(allSql).toContain('user_version = 4');
  });

  it('skips version-4 migration when already at version 4', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ user_version: 4 }]);
    await runMigrations(mockDb as any);
    const allSql = mockDb.execAsync.mock.calls.map((c: any[]) => c[0]).join('\n');
    expect(allSql).not.toContain('ADD COLUMN status');
  });

  it('runs version-5 migration on a v4 database (adds notes column to recipes)', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ user_version: 4 }]);
    await runMigrations(mockDb as any);
    const allSql = mockDb.execAsync.mock.calls.map((c: any[]) => c[0]).join('\n');
    expect(allSql).toContain('ALTER TABLE recipes ADD COLUMN notes TEXT');
    expect(allSql).toContain('user_version = 5');
  });

  it('skips version-5 migration when already at version 5', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ user_version: 5 }]);
    await runMigrations(mockDb as any);
    const allSql = mockDb.execAsync.mock.calls.map((c: any[]) => c[0]).join('\n');
    expect(allSql).not.toContain('ADD COLUMN notes');
  });

  it('includes notes column in the recipes CREATE TABLE statement', async () => {
    await runMigrations(mockDb as any);
    const sql: string = mockDb.execAsync.mock.calls[0][0];
    const recipesBlock = sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS recipes'));
    const afterCreate = recipesBlock.slice(0, recipesBlock.indexOf(');') + 2);
    expect(afterCreate).toContain('notes');
    expect(afterCreate).toContain('TEXT');
  });
});
