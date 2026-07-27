import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act, waitFor } from '@testing-library/react-native';

import * as Sharing from 'expo-sharing';
import { useBackup } from '../../hooks/useBackup';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const mockWrite = jest.fn();
const mockCreateFile = jest.fn(() => ({ uri: 'content://tree/downloads/backup.json', write: mockWrite }));
const mockPickDirectoryAsync = jest.fn();

jest.mock('expo-file-system', () => ({
  Paths: { document: 'file:///doc/' },
  File: jest.fn().mockImplementation(() => ({
    uri: 'file:///doc/backup.json',
    write: jest.fn(),
    text: jest.fn(),
  })),
  Directory: Object.assign(
    jest.fn().mockImplementation((uri: string) => ({
      uri,
      name: 'Downloads',
      createFile: mockCreateFile,
    })),
    { pickDirectoryAsync: (...a: unknown[]) => mockPickDirectoryAsync(...a) },
  ),
}));

jest.mock('expo-sharing', () => ({ shareAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('../../lib/db/migrations', () => ({ runMigrations: jest.fn() }));

const mockDb = { getAllAsync: jest.fn().mockResolvedValue([]), runAsync: jest.fn() };
jest.mock('../../providers/DatabaseProvider', () => ({ useDb: () => mockDb }));

/** Expo surfaces a user-dismissed picker as a CodedException, not a result flag. */
function cancellation() {
  const e: Error & { code?: string } = new Error('The file picker was cancelled by the user');
  e.code = 'ERR_PICKER_CANCELLED';
  return e;
}

async function mounted() {
  const { result } = renderHook(() => useBackup());
  await waitFor(() => expect(result.current.folderName).toBeDefined());
  return result;
}

describe('useBackup.saveBackup', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockWrite.mockClear();
    mockCreateFile.mockClear();
    mockPickDirectoryAsync.mockReset().mockResolvedValue({
      uri: 'content://tree/downloads',
      name: 'Downloads',
    });
    (Sharing.shareAsync as jest.Mock).mockClear();
    mockDb.getAllAsync.mockClear().mockResolvedValue([]);
  });

  it('prompts for a folder on the first save', async () => {
    const result = await mounted();
    await act(async () => { await result.current.saveBackup(); });

    expect(mockPickDirectoryAsync).toHaveBeenCalledTimes(1);
    expect(mockWrite).toHaveBeenCalledTimes(1);
  });

  it('writes the backup as JSON into the chosen folder', async () => {
    const result = await mounted();
    await act(async () => { await result.current.saveBackup(); });

    const [filename, mimeType] = mockCreateFile.mock.calls[0] as unknown as [string, string];
    expect(filename).toMatch(/^meal-planner-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(mimeType).toBe('application/json');
    expect(JSON.parse(mockWrite.mock.calls[0][0]).backup_version).toBe('2.0');
  });

  it('reuses the remembered folder without prompting again', async () => {
    const result = await mounted();
    await act(async () => { await result.current.saveBackup(); });
    await act(async () => { await result.current.saveBackup(); });

    expect(mockPickDirectoryAsync).toHaveBeenCalledTimes(1);
    expect(mockWrite).toHaveBeenCalledTimes(2);
  });

  it('exposes the remembered folder name for display', async () => {
    const result = await mounted();
    await act(async () => { await result.current.saveBackup(); });

    expect(result.current.folderName).toBe('Downloads');
  });

  it('restores the remembered folder on a later mount', async () => {
    const first = await mounted();
    await act(async () => { await first.current.saveBackup(); });

    mockPickDirectoryAsync.mockClear();
    const second = await mounted();
    await waitFor(() => expect(second.current.folderName).toBe('Downloads'));
    await act(async () => { await second.current.saveBackup(); });

    expect(mockPickDirectoryAsync).not.toHaveBeenCalled();
  });

  it('reports where the file landed on success', async () => {
    const result = await mounted();
    await act(async () => { await result.current.saveBackup(); });

    expect(result.current.status).toMatchObject({ type: 'success' });
    expect((result.current.status as { message: string }).message)
      .toMatch(/^Saved to Downloads\/meal-planner-backup-/);
  });

  it('treats a dismissed folder picker as a no-op, not an error', async () => {
    mockPickDirectoryAsync.mockRejectedValue(cancellation());
    const result = await mounted();
    await act(async () => { await result.current.saveBackup(); });

    expect(result.current.status).toEqual({ type: 'idle' });
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('surfaces a genuine picker failure as an error', async () => {
    mockPickDirectoryAsync.mockRejectedValue(new Error('no activity found'));
    const result = await mounted();
    await act(async () => { await result.current.saveBackup(); });

    expect(result.current.status).toMatchObject({ type: 'error' });
  });

  it('re-prompts when the remembered folder is no longer writable', async () => {
    const result = await mounted();
    await act(async () => { await result.current.saveBackup(); });

    // Android revokes the SAF grant if the folder is deleted or the app is reinstalled.
    mockWrite.mockImplementationOnce(() => { throw new Error('permission denied'); });
    await act(async () => { await result.current.saveBackup(); });

    expect(mockPickDirectoryAsync).toHaveBeenCalledTimes(2);
    expect(result.current.status).toMatchObject({ type: 'success' });
  });

  it('forgets a revoked folder so it is not retried forever', async () => {
    const result = await mounted();
    await act(async () => { await result.current.saveBackup(); });

    mockWrite.mockImplementationOnce(() => { throw new Error('permission denied'); });
    mockPickDirectoryAsync.mockRejectedValueOnce(cancellation());
    await act(async () => { await result.current.saveBackup(); });

    expect(result.current.folderName).toBeNull();
  });
});

describe('useBackup.chooseFolder', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockWrite.mockClear();
    mockPickDirectoryAsync.mockReset().mockResolvedValue({
      uri: 'content://tree/documents',
      name: 'Documents',
    });
  });

  it('replaces the remembered folder without writing a file', async () => {
    const result = await mounted();
    await act(async () => { await result.current.chooseFolder(); });

    expect(result.current.folderName).toBe('Documents');
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('keeps the existing folder when the picker is dismissed', async () => {
    const result = await mounted();
    await act(async () => { await result.current.chooseFolder(); });

    mockPickDirectoryAsync.mockRejectedValue(cancellation());
    await act(async () => { await result.current.chooseFolder(); });

    expect(result.current.folderName).toBe('Documents');
  });
});

describe('useBackup.shareBackup', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (Sharing.shareAsync as jest.Mock).mockClear();
    mockPickDirectoryAsync.mockClear();
    mockDb.getAllAsync.mockClear().mockResolvedValue([]);
  });

  it('still opens the share sheet, independent of the saved folder', async () => {
    const result = await mounted();
    await act(async () => { await result.current.shareBackup(); });

    expect(Sharing.shareAsync).toHaveBeenCalledTimes(1);
    expect(mockPickDirectoryAsync).not.toHaveBeenCalled();
  });
});
