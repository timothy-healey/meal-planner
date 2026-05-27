import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// Names prefixed with `mock` so babel-jest allows them in jest.mock factories
// (only names matching /^mock/i — case-insensitive — are permitted as free vars
// inside the hoisted factory closures).

const mockPlanRow = { id: 'plan-1', week_starting: '2026-05-24' };

const mockUnchecked = [
  { id: 'a', plan_id: 'plan-1', category: 'Produce', category_order: 0, item_order: 0,
    name: 'Apples', qty: '1kg', estimated_price: 5, is_oneoff: 0, note: null, is_checked: 0, isChecked: false },
];
const mockOneChecked = [
  { id: 'b', plan_id: 'plan-1', category: 'Meat', category_order: 1, item_order: 0,
    name: 'Chicken', qty: '500g', estimated_price: 8, is_oneoff: 0, note: null, is_checked: 1, isChecked: true },
];
const mockTwoChecked = [
  ...mockOneChecked,
  { id: 'c', plan_id: 'plan-1', category: 'Pantry', category_order: 2, item_order: 0,
    name: 'Rice', qty: '1kg', estimated_price: 4, is_oneoff: 0, note: null, is_checked: 1, isChecked: true },
];

const mockDeleteChecked = jest.fn().mockResolvedValue(undefined);
const mockSetMode = jest.fn().mockResolvedValue(undefined);

// Mutable state read by the mock factories at call time. Tests mutate these
// before calling render() to control what each render observes.
const mockState = {
  shopping: { items: [...mockUnchecked], loading: false } as { items: unknown[]; loading: boolean },
  mode: { mode: 'quick', activeStore: null } as { mode: 'quick' | 'review'; activeStore: { chain: string; branch: string } | null },
  purchase: { pendingRecords: [] as Array<{ price: number }> },
};

jest.mock('../../hooks/usePlan', () => ({
  usePlan: () => ({ plan: { row: mockPlanRow }, loading: false }),
}));

jest.mock('../../hooks/useShoppingItems', () => ({
  useShoppingItems: () => ({
    ...mockState.shopping,
    reload: jest.fn(),
    toggleItem: jest.fn(),
    addItem: jest.fn(),
    updateItem: jest.fn(),
    deleteItem: jest.fn(),
    resetAll: jest.fn(),
    deleteChecked: mockDeleteChecked,
  }),
}));

jest.mock('../../hooks/useCategoryOrder', () => ({
  useCategoryOrder: () => ({ applySavedOrder: (cats: string[]) => cats, reload: jest.fn() }),
}));

jest.mock('../../hooks/usePurchaseHistory', () => ({
  usePurchaseHistory: () => ({
    ...mockState.purchase,
    addRecord: jest.fn(),
    deletePending: jest.fn(),
    getLatestForItem: jest.fn().mockResolvedValue(null),
    reload: jest.fn(),
  }),
}));

jest.mock('../../hooks/useShoppingMode', () => ({
  useShoppingMode: () => ({
    ...mockState.mode,
    savedStores: [],
    setMode: mockSetMode,
    reload: jest.fn(),
  }),
}));

jest.mock('../../lib/barcodeScanResult', () => ({
  takePendingScanResult: () => null,
}));

// ReviewItemSheet (mounted at the bottom of the shop screen even when invisible)
// reaches into useIngredientSuggestions, which itself calls useDb(). Provide a
// stub so the suggestion hook doesn't try to materialise a database connection.
// The query/invalidate refs are stable across calls — fresh jest.fn() each render
// would change useEffect deps inside the sheet and trigger an infinite loop.
const mockSuggestionQuery = jest.fn().mockResolvedValue([]);
const mockSuggestionInvalidate = jest.fn();
jest.mock('../../hooks/useIngredientSuggestions', () => ({
  useIngredientSuggestions: () => ({
    query: mockSuggestionQuery,
    invalidate: mockSuggestionInvalidate,
  }),
}));

// `__mocks__/expo-router.js` already stubs useFocusEffect as a NOOP. That's fine:
// the focus effect only triggers reload methods on the hooks, which are jest.fn()
// and irrelevant to the CTA assertions. No additional expo-router mocking needed.

import ShopScreen from '../../app/(tabs)/shop';

function setState(opts: {
  mode?: 'quick' | 'review';
  checked?: 'none' | 'one' | 'two';
  activeStore?: { chain: string; branch: string } | null;
  pending?: number;
}) {
  if (opts.mode) mockState.mode.mode = opts.mode;
  if (opts.activeStore !== undefined) mockState.mode.activeStore = opts.activeStore;
  const checked = opts.checked ?? 'none';
  mockState.shopping.items =
    checked === 'two' ? [...mockUnchecked, ...mockTwoChecked]
    : checked === 'one' ? [...mockUnchecked, ...mockOneChecked]
    : [...mockUnchecked];
  const pending = opts.pending ?? 0;
  mockState.purchase.pendingRecords = Array.from({ length: pending }, (_, i) => ({ price: i + 1 }));
}

describe('ShopScreen — Clear basket CTA', () => {
  beforeEach(() => {
    mockDeleteChecked.mockClear();
    mockSetMode.mockClear();
    setState({ mode: 'quick', checked: 'none', pending: 0, activeStore: null });
  });

  it('hides the Clear CTA in Quick mode when the basket is empty', () => {
    const { queryByLabelText } = render(<ShopScreen />);
    expect(queryByLabelText(/Clear basket/i)).toBeNull();
  });

  it('shows the Clear CTA in Quick mode with singular copy when one item is checked', async () => {
    setState({ mode: 'quick', checked: 'one' });
    const { findByText } = render(<ShopScreen />);
    expect(await findByText('Clear basket · 1 item')).toBeTruthy();
  });

  it('shows the Clear CTA in Quick mode with plural copy when multiple items are checked', async () => {
    setState({ mode: 'quick', checked: 'two' });
    const { findByText } = render(<ShopScreen />);
    expect(await findByText('Clear basket · 2 items')).toBeTruthy();
  });

  it('opens a confirmation Alert when the Clear CTA is tapped', async () => {
    setState({ mode: 'quick', checked: 'two' });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { findByText } = render(<ShopScreen />);
    fireEvent.press(await findByText('Clear basket · 2 items'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Clear basket?',
      "Remove 2 items from this week's list?",
      expect.any(Array),
    );
    alertSpy.mockRestore();
  });

  it('calls deleteChecked when the destructive Clear button is confirmed', async () => {
    setState({ mode: 'quick', checked: 'two' });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const clear = (buttons ?? []).find((b: any) => b.text === 'Clear');
      clear?.onPress?.();
    });

    const { findByText } = render(<ShopScreen />);
    fireEvent.press(await findByText('Clear basket · 2 items'));

    await waitFor(() => expect(mockDeleteChecked).toHaveBeenCalledTimes(1));
    alertSpy.mockRestore();
  });

  it('does not call deleteChecked when the alert is cancelled', async () => {
    setState({ mode: 'quick', checked: 'two' });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const cancel = (buttons ?? []).find((b: any) => b.text === 'Cancel');
      cancel?.onPress?.();
    });

    const { findByText } = render(<ShopScreen />);
    fireEvent.press(await findByText('Clear basket · 2 items'));

    await new Promise((r) => setTimeout(r, 0));
    expect(mockDeleteChecked).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('hides the Clear CTA when mode switches to Review', () => {
    setState({ mode: 'review', checked: 'two', activeStore: { chain: 'Coles', branch: '' }, pending: 0 });
    const { queryByText } = render(<ShopScreen />);
    expect(queryByText(/Clear basket/)).toBeNull();
  });

  it('keeps the Review CTA visible in Review mode with pending records', () => {
    setState({ mode: 'review', checked: 'two', activeStore: { chain: 'Coles', branch: '' }, pending: 2 });
    const { getByText, queryByText } = render(<ShopScreen />);
    expect(getByText(/Done shopping/)).toBeTruthy();
    expect(queryByText(/Clear basket/)).toBeNull();
  });
});
