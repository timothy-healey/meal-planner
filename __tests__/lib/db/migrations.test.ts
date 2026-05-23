import { runMigrations } from '../../../lib/db/migrations';

const mockDb = {
  execAsync: jest.fn().mockResolvedValue(undefined),
};

describe('runMigrations', () => {
  it('calls execAsync with SQL containing all core table names', async () => {
    await runMigrations(mockDb as any);
    const sql: string = mockDb.execAsync.mock.calls[0][0];
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS recipes');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS weekly_plans');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS shopping_items');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS barcode_stores');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS barcode_nutrition');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS price_history');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS stores');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS store_aisles');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS item_aisle_map');
  });

  it('calls execAsync exactly once', async () => {
    mockDb.execAsync.mockClear();
    await runMigrations(mockDb as any);
    expect(mockDb.execAsync).toHaveBeenCalledTimes(1);
  });
});
