# Clear basket in Quick mode

**Date:** 2026-05-27

## Overview

Quick mode (no purchase tracking) lets the user tick items into the basket as they shop, but offers no way to clear the basket short of un-ticking each item by hand. Review mode already has a "Done shopping" CTA in the green header ([shop.tsx:221-239](app/(tabs)/shop.tsx#L221-L239)) that wraps up the shop and clears state; Quick mode has nothing in that slot. This spec adds a mirrored "Clear basket" CTA for Quick mode in the same header slot.

Scope is intentionally narrow: one CTA, one confirmation, one new hook method. No new sheets, no `BasketSection` changes.

## User-visible behaviour

### When the CTA shows

The Quick-mode CTA appears in the green header whenever:

- `mode === 'quick'`, AND
- `checkedItems.length > 0` (i.e., at least one item is in the basket).

It occupies the same slot as the existing Review-mode CTA. The two are mutually exclusive — `mode` partitions them — so they never overlap.

### Copy

- Left: `Clear basket · {N} items` (singular `1 item` when `N === 1`).
- Right: empty. The Review CTA shows `{pendingTotal} ›`; Quick mode has nothing equivalent (no prices in the basket yet) and the chevron is dropped to signal the action terminates here rather than navigating.

### Tap → confirmation

A native `Alert.alert` (no new sheet):

- Title: `Clear basket?`
- Message: `Remove {N} items from this week's list?` (`Remove 1 item …` when `N === 1`.)
- Buttons:
  - `Cancel` — `style: 'cancel'`, no-op.
  - `Clear` — `style: 'destructive'`, deletes the items.

### On confirm

- Light haptic was already triggered on initial press; on confirm fire `Haptics.notificationAsync(NotificationFeedbackType.Success)`.
- **Permanently removes** all currently-checked items from the active plan via a single SQL delete. The items are gone from this week's plan — they don't move back to the unchecked sections. (The user can re-add via the FAB if needed; next week's import from a fresh meal-plan JSON brings recurring items back automatically.)
- After the delete completes, `useShoppingItems` reloads and the basket empties. The CTA disappears (because `checkedItems.length === 0`).

## CTA gating in the shop screen

Replace the single `showCompleteCta` flag in [shop.tsx:108](app/(tabs)/shop.tsx#L108) with two:

```ts
const showReviewCta = mode === 'review' && pendingCount > 0;
const showClearCta  = mode === 'quick'  && checkedItems.length > 0;
```

Render the existing block when `showReviewCta` is true; render a new analogous block when `showClearCta` is true. They cannot both be true (mutually exclusive on `mode`).

### CTA component

A second `TouchableOpacity` mirrors the existing one's styling (`styles.completeCta`) so the visual treatment is identical: orange pill, full-width, `paddingHorizontal: spacing[4]`, `paddingVertical: 11`, `borderRadius: radius.full`, `marginTop: spacing[1]`. The contents differ:

```tsx
{showClearCta && (
  <TouchableOpacity
    style={styles.completeCta}
    onPress={handleClearBasketPress}
    activeOpacity={0.85}
    accessibilityRole="button"
    accessibilityLabel={`Clear basket — ${checkedItems.length} items`}
  >
    <AppText weight="extrabold" size="sm" color="onGreen">
      {`Clear basket · ${checkedItems.length} ${checkedItems.length === 1 ? 'item' : 'items'}`}
    </AppText>
  </TouchableOpacity>
)}
```

Single `AppText` child (no right-hand element) — the existing `space-between` `flexDirection: 'row'` on `styles.completeCta` will left-align the text, which is the intended look.

### Press handler

```ts
function handleClearBasketPress() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  const n = checkedItems.length;
  Alert.alert(
    'Clear basket?',
    `Remove ${n} ${n === 1 ? 'item' : 'items'} from this week's list?`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await deleteChecked();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ],
  );
}
```

`Alert` is imported from `react-native`; `Haptics` is already imported at the top of the file.

## Data hook

Add a new method `deleteChecked` to `useShoppingItems`. It runs a single SQL delete scoped to the active plan's checked rows and refreshes the in-memory list.

```ts
const deleteChecked = useCallback(async () => {
  if (!planId) return;
  await db.runAsync(
    'DELETE FROM shopping_items WHERE plan_id = ? AND is_checked = 1',
    [planId],
  );
  setItems((prev) => prev.filter((i) => i.isChecked === false));
}, [planId, db]);
```

Exposed alongside the existing `toggleItem`, `addItem`, `updateItem`, `deleteItem`, `resetAll`. The existing `resetAll` stays in place (still unused after this work) — removing it is out of scope for this spec.

Pulled into the shop screen via the existing destructure:

```ts
const { items, ..., toggleItem, addItem, updateItem, deleteItem, deleteChecked } = useShoppingItems(planId);
```

The press handler calls `deleteChecked()` (no arg — the hook already knows `planId` via its closure).

## Interaction with existing flows

- **Quick → Review mid-shop.** If the user has Quick-mode-checked items in the basket and toggles to Review, the basket carries over (those items remain `is_checked = 1`). The Quick CTA disappears (mode changed) and the Review CTA appears only if `pendingCount > 0` — which it isn't, because Quick mode doesn't create `purchase_history` rows. So neither CTA shows until the user starts ticking items in Review. This is the existing behaviour; the new CTA does not introduce any cross-mode side effect.
- **Review → Quick.** Symmetric. The existing `setMode('quick')` call already runs through `useShoppingMode` and does not touch shopping_items. Any prior basket state remains; if `checkedItems.length > 0`, the new Clear CTA will surface immediately.
- **No items in basket.** Neither CTA shows. The header collapses to its non-CTA state (title row + week/store row only). Same as today's behaviour when `pendingCount === 0`.

## Accessibility

- `accessibilityRole="button"`.
- `accessibilityLabel={`Clear basket — ${checkedItems.length} items`}` (no en-dash issues — using a regular hyphen and "items" suffix for screen reader clarity).
- The destructive `Clear` button in `Alert.alert` uses iOS/Android system styling; no extra a11y work needed.

## Testing

- **`useShoppingItems.deleteChecked` unit test:**
  - Three items, two checked, one unchecked → `deleteChecked()` → the two checked rows are deleted; only the unchecked row remains in local state.
  - SQL is `DELETE FROM shopping_items WHERE plan_id = ? AND is_checked = 1` with the active planId bound.
  - Calling on an empty basket is a no-op (no error).
  - `deleteChecked()` is a no-op when `planId` is null.
- **`shop.tsx` integration:**
  - Quick mode + 0 checked → no CTA.
  - Quick mode + ≥1 checked → CTA visible with correct count + pluralisation.
  - Tap CTA → `Alert.alert` invoked with the correct message string.
  - Confirm `Clear` in alert → `deleteChecked` called, basket empties, CTA disappears.
  - Cancel in alert → no state change.
  - Review mode + ≥1 pending → Review CTA visible, Clear CTA hidden.
  - Switch Quick → Review while basket has items → Clear CTA disappears immediately.

## Out of scope

- Clearing the basket in Review mode (the existing Confirm-from-receipt flow already does this).
- A "Clear" affordance inside `BasketSection` itself.
- Multi-step undo of a clear (the confirmation alert is the protection layer).
- Recovering items after a clear — the operation is intentionally destructive: deleted shopping_items rows are gone for this plan. Re-add via the FAB if needed. (Recurring items return on next week's plan import.)
