# Keyboard avoidance for all text inputs

**Date:** 2026-05-27
**Status:** Spec

## Problem

Text inputs in the app's bottom sheets are covered by the on-screen keyboard
on Android when focused. The user discovered this while testing in shops, where
they need to type into fields like quantity, price, and notes.

All text inputs in the app live inside five bottom-sheet components rendered
inside `<Modal>`. On Android, `<Modal>` opens a new window that does not
participate in the activity's soft-input layout, so React Native's built-in
`KeyboardAvoidingView` is unreliable inside it — which is why three of the
sheets already use `KeyboardAvoidingView` but still get covered.

## Goal

When any text input is focused, it must remain visible above the keyboard.
For sheets containing long forms, the focused input should be auto-scrolled
into view rather than only lifting the sheet as a whole.

This must work on Android (primary target) and not regress iOS behavior.

## Approach

Adopt `react-native-keyboard-controller`. Its `KeyboardAvoidingView` and
`KeyboardAwareScrollView` are designed to work correctly inside Android
`<Modal>` and across both platforms with a single `behavior="padding"`
configuration. The alternative (built-in `KeyboardAvoidingView` with
per-platform tuning) does not reliably solve the Android-Modal case, and a
custom Reanimated solution would reinvent what the library provides while
adding maintenance burden across five sheets.

## Components affected

All five sheets containing `TextInput`:

- `components/AddItemSheet.tsx` — currently has no `KeyboardAvoidingView`
- `components/AddPriceSheet.tsx` — currently has no `KeyboardAvoidingView`
- `components/StorePickerSheet.tsx` — has RN's `KeyboardAvoidingView`
- `components/FoodNutritionSheet.tsx` — has RN's `KeyboardAvoidingView`
- `components/ReviewItemSheet.tsx` — has RN's `KeyboardAvoidingView`

No top-level screens in `app/` contain `TextInput`, so the change is fully
scoped to these components plus the app root.

## Changes

### App root

In `app/_layout.tsx`, wrap the rendered tree in `<KeyboardProvider>` from
`react-native-keyboard-controller`. This installs the native keyboard event
listeners the library's components depend on.

### Sheets that already wrap in `KeyboardAvoidingView`

For `StorePickerSheet`, `FoodNutritionSheet`, and `ReviewItemSheet`:

- Import `KeyboardAvoidingView` and `KeyboardAwareScrollView` from
  `react-native-keyboard-controller` instead of `react-native`.
- Replace the inner `<ScrollView>` with `<KeyboardAwareScrollView>` (same
  props apply).
- Remove the `Platform.OS === 'ios' ? 'padding' : undefined` branching;
  use `behavior="padding"` unconditionally (the library normalizes Android).

### Sheets missing keyboard avoidance

For `AddItemSheet`:

- Wrap the inner sheet content (header + body + footer) in a
  `KeyboardAvoidingView` with `behavior="padding"` so the footer's primary
  action button lifts with the keyboard.
- Replace the body `<ScrollView>` with `<KeyboardAwareScrollView>`.
- The existing Reanimated slide-in animation continues to wrap the whole
  sheet — no interaction with keyboard avoidance.

For `AddPriceSheet`:

- Wrap the `<View style={styles.sheet}>` content in `KeyboardAvoidingView`
  with `behavior="padding"`.
- Replace the inner `<ScrollView>` with `<KeyboardAwareScrollView>`.

## Behavior

- `KeyboardAvoidingView behavior="padding"` lifts the sheet as a whole so the
  footer action button remains visible.
- `KeyboardAwareScrollView` auto-scrolls the focused `TextInput` into the
  visible area above the keyboard (defaults are appropriate; no overrides
  needed unless testing reveals issues).

## Testing

Manual verification on Android device:

- Open each of the five sheets in turn.
- Tap every `TextInput` and confirm no field is covered by the keyboard.
- Specifically exercise the worst cases:
  - `AddItemSheet` "Note" field (bottom of sheet).
  - `FoodNutritionSheet` lower fields after the form is fully expanded.
  - `ReviewItemSheet` lower fields after the form is fully expanded.
- Dismiss keyboard and confirm sheet returns to position without jank.

Sanity check on iOS to confirm no regression of existing behavior.

No automated tests — keyboard avoidance does not lend itself to meaningful
unit testing in this codebase.

## Risks and verification

- **Expo SDK 56 compatibility:** Per `AGENTS.md`, verify the
  `react-native-keyboard-controller` version against
  `https://docs.expo.dev/versions/v56.0.0/` before installing. If the
  library is not compatible with SDK 56, fall back to a custom Reanimated
  `useAnimatedKeyboard` solution applied to each sheet.
- **Native build:** Confirm the library does not require an
  `expo-build-properties` tweak or any custom native config in `app.json`.
  If it does, capture that in the implementation plan.

## Non-goals

- No changes to inputs outside the five sheets (there are none today).
- No redesign of any sheet layout, animation, or visual style.
- No automated testing of keyboard behavior.
