import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { DatabaseProvider, useDb } from '../../providers/DatabaseProvider';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockResolvedValue({
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue(undefined),
    getAllAsync: jest.fn().mockResolvedValue([]),
    getFirstAsync: jest.fn().mockResolvedValue(null),
  }),
}));

function Consumer() {
  const db = useDb();
  return <Text>{db ? 'ready' : 'not ready'}</Text>;
}

describe('DatabaseProvider', () => {
  it('renders children and provides db once migrations complete', async () => {
    const { getByText } = render(
      <DatabaseProvider>
        <Consumer />
      </DatabaseProvider>
    );
    await waitFor(() => expect(getByText('ready')).toBeTruthy());
  });
});
