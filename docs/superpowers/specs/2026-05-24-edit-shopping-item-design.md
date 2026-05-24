# Edit Shopping Item

**Date:** 2026-05-24

## Overview

Users need to edit shopping list items after import — e.g. moving "Mixed berries" from Fresh Produce to the Freezer section. Editing is triggered by swiping left on any item to reveal Edit and Delete actions.

## Swipe Actions

`SwipeableShoppingItem` gains a second right-side action. Total reveal width is 160px (two 80px buttons).

- **Edit** (left button): `colors.green` background, `create-outline` Ionicon, label "EDIT"
- **Delete** (right button): `colors.orange` background, `trash-outline` Ionicon, label "DELETE" (existing, unchanged)

Tapping Edit closes the swipeable and fires `onEdit`. The component receives a new `onEdit: () => void` prop (closure pattern, matching `onToggle` and `onDelete`).

`CategorySection` receives `onEdit: (item: ShoppingItemRow) => void` from its parent and passes `onEdit={() => onEdit(item)}` to each `SwipeableShoppingItem`.

## Unified Add/Edit Sheet

`AddItemSheet` is extended to handle both add and edit modes. No second component is created.

### New props

```ts
initialItem?: ShoppingItemRow   // when present: edit mode
onSave?: (id: string, data: ItemFormData) => void  // edit mode callback

interface ItemFormData {
  name: string;
  qty: string;
  estimatedPrice: number;
  category: string;
  note: string | null;
}
```

Existing `onAdd` prop is unchanged and used for add mode. `AddItemData` is extended to include `note` so both modes share the same shape.

### Behaviour by mode

| | Add mode | Edit mode |
|---|---|---|
| Title | "Add item" | "Edit item" |
| CTA | "+ Add to list" | "Save changes" |
| Initial values | empty | pre-populated from `initialItem` |

### Fields

Always visible: **name**, **qty**, **price**, **category**

Collapsed by default: **note** — shown behind a small "+ Add note" tappable row. If the item already has a note, the field is expanded and the label reads "Edit note".

### Category selection

The category list shows all existing categories. The currently selected one is pre-highlighted when in edit mode.

## Data Layer

`useShoppingItems` gains `updateItem`:

```ts
updateItem(itemId: string, data: {
  name: string;
  qty: string;
  estimatedPrice: number;
  category: string;
  note: string | null;
}): Promise<void>
```

**Category change logic:**
- If the new category already exists among current items, use its existing `category_order` and set `item_order` to one above the max in that category.
- If the new category name is brand new, assign `category_order` one above the current maximum across all items and `item_order` to 0.

Runs as a single `db.runAsync` UPDATE. State is updated optimistically via `setItems` — no full reload.

## Wiring in shop.tsx

- Add `editingItem: ShoppingItemRow | null` state (default `null`)
- Pull `updateItem` from `useShoppingItems`
- Pass `onEdit={(item) => setEditingItem(item)}` down through `CategorySection`
- Render `AddItemSheet` with `initialItem={editingItem}` and `onSave` handler that calls `updateItem` then `setEditingItem(null)`
- `onClose` clears `editingItem`

## Out of scope

- `actual_price` and `store` fields on `ShoppingItemRow` are not editable here
- Editing checked (basket) items — the basket section does not use `SwipeableShoppingItem` and is not changed
