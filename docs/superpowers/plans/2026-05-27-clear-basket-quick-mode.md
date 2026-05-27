# Clear basket in Quick mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Quick-mode "Clear basket" CTA to the shop screen that mirrors the existing Review-mode "Done shopping" CTA, with a destructive confirmation alert that reuses the existing `useShoppingItems.resetAll` to uncheck all basket items.

**Architecture:** Single-file UI change in `app/(tabs)/shop.tsx` — split the existing `showCompleteCta` flag into `showReviewCta` and `showClearCta`, render a second `TouchableOpacity` for the new flag, and wire its press to a `react-native` `Alert.alert` that calls `resetAll()` on confirm. No schema changes. No new hook methods. The new CTA reuses the existing `styles.completeCta` styling so visual treatment is identical.

**Tech Stack:** React Native (Expo SDK 56), Jest + `@testing-library/react-native`, `expo-haptics`, existing `useShoppingItems` hook backed by SQLite via `expo-sqlite`.

**Spec:** [docs/superpowers/specs/2026-05-27-clear-basket-quick-mode-design.md](docs/superpowers/specs/2026-05-27-clear-basket-quick-mode-design.md)

---

## File map

- **Modify:** `app/(tabs)/shop.tsx` — replace `showCompleteCta` with two gating flags; add new CTA element; add press handler; add `Alert` import; destructure `resetAll`.
- **Create:** `__tests__/hooks/useShoppingItems.test.ts` — covers the existing `resetAll` method (currently uncovered).
- **Create:** `__tests__/screens/shop.test.tsx` — new integration test harness for the shop screen, with all hooks mocked.

No production-source files are created. No types or schema migrations. No new components.

---

## Task 1: Cover the existing `useShoppingItems.resetAll` method

The hook already exposes `resetAll` at [hooks/useShoppingItems.ts:37-41](hooks/useShoppingItems.ts#L37-L41) but it is uncovered. The new CTA depends on its semantics — add a unit test first so regressions surface.

**Files:**
- Create: `__tests__/hooks/useShoppingItems.test.ts`

- [ ] **Step 1: Write failing test file (file doesn't exist yet, so all assertions fail until written)**

Create `__tests__/hooks/useShoppingItems.test.ts`:

```ts
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useShoppingItems } from '../../hooks/useShoppingItems';

const planId = 'plan-1';

const rows = [
  { id: 'a', plan_id: planId, category: 'Produce', category_order: 0, item_order: 0,
    name: 'Apples', qty: '1kg', estimated_price: 5, is_oneoff: 0, note: null, is_checked: 1 },
  { id: 'b', plan_id: planId, category: 'Produce', category_order: 0, item_order: 1,
    name: 'Bananas', qty: '1 bunch', estimated_price: 4, is_oneoff: 0, note: null, is_checked: 1 },
  { id: 'c', plan_id: planId, category: 'Meat', category_order: 1, item_order: 0,
    name: 'Chicken', qty: '500g', estimated_price: 8, is_oneoff: 0, note: null, is_checked: 0 },
];

const mockDb = {
  getAllAsync: jest.fn(),
  runAsync: jest.fn().mockResolvedValue(undefined),
  getFirstAsync: jest.fn(),
};

jest.mock('../../providers/DatabaseProvider', () => ({
  useDb: () => mockDb,
}));

describe('useShoppingItems.resetAll', () => {
  beforeEach(() => {
    mockDb.getAllAsync.mockReset();
    mockDb.runAsync.mockReset().mockResolvedValue(undefined);
    mockDb.getAllAsync.mockResolvedValue(rows);
  });

  it('issues UPDATE setting is_checked = 0 scoped to the active plan_id', async () => {
    const { result } = renderHook(() => useShoppingItems(planId));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.resetAll(); });

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'UPDATE shopping_items SET is_checked = 0 WHERE plan_id = ?',
      [planId],
    );
  });

  it('updates local state so all items become isChecked = false after resetAll', async () => {
    const { result } = renderHook(() => useShoppingItems(planId));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.filter((i) => i.isChecked)).toHaveLength(2);

    await act(async () => { await result.current.resetAll(); });

    expect(result.current.items.every((i) => i.isChecked === false)).toBe(true);
    expect(result.current.items.every((i) => i.is_checked === 0)).toBe(true);
  });

  it('is a no-op when planId is null (does not issue SQL)', async () => {
    const { result } = renderHook(() => useShoppingItems(null));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.resetAll(); });

    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `npm test -- __tests__/hooks/useShoppingItems.test.ts`

Expected: PASS — `resetAll` already exists in production source, so coverage is additive. All three cases should pass on the first run. If any fail, the regression is in `useShoppingItems.ts`, not the test.

- [ ] **Step 3: Commit**

```bash
git add __tests__/hooks/useShoppingItems.test.ts
git commit -m "$(cat <<'EOF'
test(useShoppingItems): cover the existing resetAll method

The Quick-mode clear-basket CTA reuses resetAll; lock down its
SQL shape and in-memory state update before adding callers.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Bootstrap shop screen test harness with failing CTA tests

The codebase has no existing screen-level test for `app/(tabs)/shop.tsx`. Bootstrap one with all hook dependencies mocked, then write the new CTA tests. They must fail before Task 3's implementation.

**Files:**
- Create: `__tests__/screens/shop.test.tsx`

- [ ] **Step 1: Write the failing test file**

Create `__tests__/screens/shop.test.tsx`:

```tsx
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

const mockResetAll = jest.fn().mockResolvedValue(undefined);
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
    resetAll: mockResetAll,
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
    mockResetAll.mockClear();
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
      'All 2 items will move back to your list.',
      expect.any(Array),
    );
    alertSpy.mockRestore();
  });

  it('calls resetAll when the destructive Clear button is confirmed', async () => {
    setState({ mode: 'quick', checked: 'two' });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const clear = (buttons ?? []).find((b: any) => b.text === 'Clear');
      clear?.onPress?.();
    });

    const { findByText } = render(<ShopScreen />);
    fireEvent.press(await findByText('Clear basket · 2 items'));

    await waitFor(() => expect(mockResetAll).toHaveBeenCalledTimes(1));
    alertSpy.mockRestore();
  });

  it('does not call resetAll when the alert is cancelled', async () => {
    setState({ mode: 'quick', checked: 'two' });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const cancel = (buttons ?? []).find((b: any) => b.text === 'Cancel');
      cancel?.onPress?.();
    });

    const { findByText } = render(<ShopScreen />);
    fireEvent.press(await findByText('Clear basket · 2 items'));

    await new Promise((r) => setTimeout(r, 0));
    expect(mockResetAll).not.toHaveBeenCalled();
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
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- __tests__/screens/shop.test.tsx`

Expected: Most of the new tests FAIL. Specifically:
- `hides the Clear CTA in Quick mode when the basket is empty` — likely passes (no Clear CTA exists yet, `queryByLabelText` returns null).
- `shows the Clear CTA … singular copy` — FAILS, `Clear basket · 1 item` text not in the rendered output.
- `shows the Clear CTA … plural copy` — FAILS, same reason.
- `opens a confirmation Alert` — FAILS, the matching element isn't there to press.
- `calls resetAll when … Clear is confirmed` — FAILS, same.
- `does not call resetAll when … cancelled` — likely passes vacuously (the press target doesn't exist, but the assertion is "not called").
- `hides the Clear CTA when mode switches to Review` — passes vacuously today.
- `keeps the Review CTA visible …` — passes today (existing behaviour).

This is the correct failing baseline: behaviour the spec adds is absent.

- [ ] **Step 3: Do not commit yet**

The test file describes behaviour that hasn't been implemented. Move to Task 3.

---

## Task 3: Implement the Clear-basket CTA in `shop.tsx`

**Files:**
- Modify: `app/(tabs)/shop.tsx`

- [ ] **Step 1: Add `Alert` to the `react-native` import**

Find the current top-of-file import in [app/(tabs)/shop.tsx:2](app/(tabs)/shop.tsx#L2):

```ts
import { View, TouchableOpacity, StyleSheet } from 'react-native';
```

Replace with:

```ts
import { View, TouchableOpacity, StyleSheet, Alert } from 'react-native';
```

- [ ] **Step 2: Add `resetAll` to the `useShoppingItems` destructure**

Find at [app/(tabs)/shop.tsx:42](app/(tabs)/shop.tsx#L42):

```ts
const { items, loading: itemsLoading, reload: reloadItems, toggleItem, addItem, updateItem, deleteItem } = useShoppingItems(planId);
```

Replace with:

```ts
const { items, loading: itemsLoading, reload: reloadItems, toggleItem, addItem, updateItem, deleteItem, resetAll } = useShoppingItems(planId);
```

- [ ] **Step 3: Replace `showCompleteCta` with two flags**

Find at [app/(tabs)/shop.tsx:108](app/(tabs)/shop.tsx#L108):

```ts
const showCompleteCta = mode === 'review' && pendingCount > 0;
```

Replace with:

```ts
const showReviewCta = mode === 'review' && pendingCount > 0;
const showClearCta = mode === 'quick' && checkedItems.length > 0;
```

- [ ] **Step 4: Add the press handler above the existing JSX**

Insert immediately after the existing `handleStoreConfirm` function (around [app/(tabs)/shop.tsx:144-147](app/(tabs)/shop.tsx#L144-L147)):

```ts
function handleClearBasketPress() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  const n = checkedItems.length;
  Alert.alert(
    'Clear basket?',
    `All ${n} ${n === 1 ? 'item' : 'items'} will move back to your list.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await resetAll();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ],
  );
}
```

- [ ] **Step 5: Rename the existing CTA's gating flag and add the new CTA**

Find at [app/(tabs)/shop.tsx:221-239](app/(tabs)/shop.tsx#L221-L239):

```tsx
{showCompleteCta && (
  <TouchableOpacity
    style={styles.completeCta}
    onPress={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push('/shop-receipt');
    }}
    activeOpacity={0.85}
    accessibilityRole="button"
    accessibilityLabel="Done shopping — review receipt"
  >
    <AppText weight="extrabold" size="sm" color="onGreen">
      {`Done shopping · ${pendingCount} of ${totalItems}`}
    </AppText>
    <AppText weight="extrabold" size="sm" color="onGreen">
      {`${formatPrice(pendingTotal)} ›`}
    </AppText>
  </TouchableOpacity>
)}
```

Replace with:

```tsx
{showReviewCta && (
  <TouchableOpacity
    style={styles.completeCta}
    onPress={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push('/shop-receipt');
    }}
    activeOpacity={0.85}
    accessibilityRole="button"
    accessibilityLabel="Done shopping — review receipt"
  >
    <AppText weight="extrabold" size="sm" color="onGreen">
      {`Done shopping · ${pendingCount} of ${totalItems}`}
    </AppText>
    <AppText weight="extrabold" size="sm" color="onGreen">
      {`${formatPrice(pendingTotal)} ›`}
    </AppText>
  </TouchableOpacity>
)}

{showClearCta && (
  <TouchableOpacity
    style={styles.completeCta}
    onPress={handleClearBasketPress}
    activeOpacity={0.85}
    accessibilityRole="button"
    accessibilityLabel={`Clear basket — ${checkedItems.length} ${checkedItems.length === 1 ? 'item' : 'items'}`}
  >
    <AppText weight="extrabold" size="sm" color="onGreen">
      {`Clear basket · ${checkedItems.length} ${checkedItems.length === 1 ? 'item' : 'items'}`}
    </AppText>
  </TouchableOpacity>
)}
```

- [ ] **Step 6: Run the shop screen tests**

Run: `npm test -- __tests__/screens/shop.test.tsx`

Expected: All tests PASS. If any still fail, the most likely culprits are:
- The `expo-router` `useFocusEffect` mock — confirm the cb is invoked via a `React.useEffect`.
- Alert mock ordering — `jest.spyOn(Alert, 'alert')` must be set up before `fireEvent.press`.
- The accessibilityLabel string — match the exact "Clear basket — N items" format.

- [ ] **Step 7: Run the full test suite to catch any regressions**

Run: `npm test`

Expected: All previously-green tests stay green. The new tests pass. Nothing in the `BasketSection` / `useShoppingMode` / etc. test suites breaks.

- [ ] **Step 8: Commit**

```bash
git add app/(tabs)/shop.tsx __tests__/screens/shop.test.tsx
git commit -m "$(cat <<'EOF'
feat(shop): add Clear basket CTA in Quick mode

Mirrors the existing Review-mode "Done shopping" CTA: surfaces a
"Clear basket · N items" button in the green header when Quick mode
has checked items, confirms via native Alert, then calls the existing
useShoppingItems.resetAll to uncheck everything. The single
showCompleteCta flag is split into showReviewCta + showClearCta
(mutually exclusive on mode).

Spec: docs/superpowers/specs/2026-05-27-clear-basket-quick-mode-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Manual smoke check

Automated tests cover the gating, copy strings, and Alert wiring, but the visual placement and haptic feedback require a device check.

- [ ] **Step 1: Start the app on a simulator or device**

Run: `npx expo start`

Open in the iOS or Android simulator. Navigate to the Shop tab.

- [ ] **Step 2: Verify the Quick-mode CTA**

Toggle to Quick mode (segmented control top-right). Tick a few items into the basket. Confirm:
- The orange "Clear basket · N items" CTA appears in the green header, where "Done shopping" sits in Review mode.
- The copy reads `Clear basket · 1 item` (singular) when one item is checked, `Clear basket · 3 items` when three are checked.
- Tapping the CTA fires a light haptic and opens the native confirmation dialog: title "Clear basket?", message "All N items will move back to your list.", buttons Cancel + Clear (with Clear styled destructive on iOS).
- Tapping Cancel leaves the basket untouched.
- Tapping Clear empties the basket; a success haptic fires; the CTA disappears.

- [ ] **Step 3: Verify Review-mode still works**

Toggle to Review mode (you'll be prompted to pick a store). Tick an item; review it; confirm the pending record. The "Done shopping · N of M  $XX ›" CTA should appear in the same slot, and Clear basket CTA should be absent.

- [ ] **Step 4: Verify cross-mode behaviour**

In Quick mode with items in the basket, toggle to Review. The Clear CTA disappears immediately (mode changed); no Review CTA appears until you tick items in Review (because no pending records exist). Toggle back to Quick — the Clear CTA reappears, because the basket state was preserved.

- [ ] **Step 5: Commit follow-up fixes (if any)**

If the smoke check surfaced visual or behavioural issues — wrong padding, missing haptic, copy off — fix them and commit as a follow-up. Otherwise, the work is done.
