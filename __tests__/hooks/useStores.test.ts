import { renderHook, waitFor } from '@testing-library/react-native';
import { useStores } from '../../hooks/useStores';

const mockStoreRows = [
  { id: 's1', chain: 'Woolworths', branch: '', created_at: '2026-01-01' },
  { id: 's2', chain: 'Coles', branch: '', created_at: '2026-01-01' },
];

const mockDb = {
  getAllAsync: jest.fn().mockResolvedValue(mockStoreRows),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  runAsync: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../providers/DatabaseProvider', () => ({
  useDb: () => mockDb,
}));

describe('useStores', () => {
  beforeEach(() => {
    mockDb.getAllAsync.mockClear();
    mockDb.getFirstAsync.mockClear();
    mockDb.runAsync.mockClear();
    mockDb.getAllAsync.mockResolvedValue(mockStoreRows);
    mockDb.getFirstAsync.mockResolvedValue(null);
  });

  it('loads all stores sorted by chain', async () => {
    const { result } = renderHook(() => useStores());
    await waitFor(() => expect(result.current.stores).toHaveLength(2));
    expect(result.current.stores[0].chain).toBe('Woolworths');
  });

  it('resolveOrCreate returns existing store id', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ id: 's1' });
    const { result } = renderHook(() => useStores());
    await waitFor(() => expect(result.current.stores).toHaveLength(2));
    const id = await result.current.resolveOrCreate('Woolworths');
    expect(id).toBe('s1');
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it('resolveOrCreate inserts new store when not found', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);
    const { result } = renderHook(() => useStores());
    await waitFor(() => expect(result.current.stores).toHaveLength(2));
    const id = await result.current.resolveOrCreate('ALDI');
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO stores'),
      expect.any(Array),
    );
    expect(typeof id).toBe('string');
  });
});
