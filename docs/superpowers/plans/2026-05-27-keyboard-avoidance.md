# Keyboard Avoidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every text input across the app stays visible above the on-screen keyboard when focused, with the focused field auto-scrolled into view in long forms.

**Architecture:** Add `react-native-keyboard-controller` (Expo SDK 56 compatible). Wrap the app root in `<KeyboardProvider>`. Replace `KeyboardAvoidingView` from `react-native` with the library's drop-in equivalent (which works correctly inside Android `<Modal>`), and replace inner `<ScrollView>` instances with `<KeyboardAwareScrollView>` so the focused input auto-scrolls into view.

**Tech Stack:** React Native (Expo SDK 56), `react-native-keyboard-controller`, `react-native-reanimated` (already installed), TypeScript.

**Spec:** [docs/superpowers/specs/2026-05-27-keyboard-avoidance-design.md](../specs/2026-05-27-keyboard-avoidance-design.md)

**Note on TDD:** Keyboard avoidance behavior cannot be meaningfully unit-tested in this codebase (it requires a real keyboard on a real device). Each task includes a **manual verification** step in place of an automated test. Do not skip verification — open the affected sheet on an Android device and confirm the fix.

---

## Files Touched

- **Modify:** `package.json` — add `react-native-keyboard-controller`
- **Modify:** `app/_layout.tsx` — wrap tree in `<KeyboardProvider>`
- **Modify:** `components/StorePickerSheet.tsx` — swap imports + ScrollView
- **Modify:** `components/FoodNutritionSheet.tsx` — swap imports + ScrollView
- **Modify:** `components/ReviewItemSheet.tsx` — swap imports + ScrollView
- **Modify:** `components/AddItemSheet.tsx` — wrap overlay in `KeyboardAvoidingView` + use `KeyboardAwareScrollView`
- **Modify:** `components/AddPriceSheet.tsx` — wrap Modal contents in `KeyboardAvoidingView` + use `KeyboardAwareScrollView`

No new files. No tests added.

---

## Task 1: Install react-native-keyboard-controller

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Check Expo SDK 56 compatibility**

Run:
```bash
npx expo install react-native-keyboard-controller --check
```

This consults Expo's compatibility tables for SDK 56. If it reports an incompatible version, install the highest version it does accept (note that in the worktree's `package.json`, Expo is pinned at `~56.0.4`). If `expo install` reports no compatibility data at all, install `react-native-keyboard-controller@^1.18.0` directly — version 1.16+ supports React Native 0.81 (which SDK 56 uses).

Expected: prints a recommended version or installs without error.

- [ ] **Step 2: Install the package**

Run:
```bash
npx expo install react-native-keyboard-controller
```

Expected: package added to `dependencies` in `package.json` and resolved in `node_modules`. No errors.

- [ ] **Step 3: Verify no native-config tweak is needed**

The library is supposed to work in an Expo managed prebuild with no extra plugin entry. Confirm by checking:

```bash
grep -E "react-native-keyboard-controller" app.json
```

Expected: no match (no plugin entry needed).

If the library docs (in `node_modules/react-native-keyboard-controller/README.md`) say a config plugin is required for the version installed, add it to `app.json` `plugins`. Otherwise skip.

- [ ] **Step 4: Run the dev server to confirm it bundles**

Run:
```bash
npx expo start --clear
```

Expected: server starts, Metro bundles without errors mentioning `react-native-keyboard-controller`. Stop the server once confirmed (Ctrl+C).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install react-native-keyboard-controller"
```

(If the project uses `yarn.lock` or `bun.lock` instead of `package-lock.json`, add that file.)

---

## Task 2: Add KeyboardProvider at the app root

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Add the import**

In `app/_layout.tsx`, add this import alongside the existing imports near the top of the file (after the existing `react-native-safe-area-context` import on line 5):

```tsx
import { KeyboardProvider } from 'react-native-keyboard-controller';
```

- [ ] **Step 2: Wrap the tree**

The current return block (lines 35–51) looks like:

```tsx
return (
  <SafeAreaProvider>
  <GestureHandlerRootView style={{ flex: 1 }}>
    <DatabaseProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="recipe/[id]" />
        <Stack.Screen name="batch-plan" />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        <Stack.Screen name="category-order" options={{ presentation: 'modal' }} />
        <Stack.Screen name="shop-receipt" options={{ presentation: 'modal' }} />
        <Stack.Screen name="barcode-scanner" options={{ presentation: 'fullScreenModal', headerShown: false }} />
      </Stack>
    </DatabaseProvider>
  </GestureHandlerRootView>
  </SafeAreaProvider>
);
```

Wrap `<GestureHandlerRootView>` with `<KeyboardProvider>` (inside `SafeAreaProvider`, outside `GestureHandlerRootView`):

```tsx
return (
  <SafeAreaProvider>
    <KeyboardProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <DatabaseProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="recipe/[id]" />
            <Stack.Screen name="batch-plan" />
            <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
            <Stack.Screen name="category-order" options={{ presentation: 'modal' }} />
            <Stack.Screen name="shop-receipt" options={{ presentation: 'modal' }} />
            <Stack.Screen name="barcode-scanner" options={{ presentation: 'fullScreenModal', headerShown: false }} />
          </Stack>
        </DatabaseProvider>
      </GestureHandlerRootView>
    </KeyboardProvider>
  </SafeAreaProvider>
);
```

- [ ] **Step 3: Manual verification — app still launches**

Run:
```bash
npx expo start --clear
```

Open the app on an Android device or emulator. Expected: the app loads to the home screen exactly as before. No keyboard behavior changes yet — this step just confirms `KeyboardProvider` did not break rendering.

Stop the server (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(keyboard): mount KeyboardProvider at app root"
```

---

## Task 3: Update StorePickerSheet

**Files:**
- Modify: `components/StorePickerSheet.tsx`

The sheet currently imports `KeyboardAvoidingView` from `react-native` and uses an inner `<ScrollView>`. Swap both to the library equivalents and drop the `Platform.OS === 'ios'` branching.

- [ ] **Step 1: Update imports**

The current `react-native` import (lines 2–5) is:

```tsx
import {
  View, Modal, TouchableOpacity, TextInput,
  ScrollView, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
```

Remove `ScrollView`, `KeyboardAvoidingView`, and `Platform` from the `react-native` import. Add a new import line from `react-native-keyboard-controller`:

```tsx
import {
  View, Modal, TouchableOpacity, TextInput,
  StyleSheet,
} from 'react-native';
import { KeyboardAvoidingView, KeyboardAwareScrollView } from 'react-native-keyboard-controller';
```

- [ ] **Step 2: Update the `KeyboardAvoidingView` behavior prop**

At line 52–55 the current usage is:

```tsx
<KeyboardAvoidingView
  style={styles.overlay}
  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
>
```

Change to use `behavior="padding"` unconditionally:

```tsx
<KeyboardAvoidingView
  style={styles.overlay}
  behavior="padding"
>
```

- [ ] **Step 3: Replace ScrollView with KeyboardAwareScrollView**

At line 66 the current usage is:

```tsx
<ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
```

Change to:

```tsx
<KeyboardAwareScrollView
  style={styles.list}
  showsVerticalScrollIndicator={false}
  keyboardShouldPersistTaps="handled"
>
```

The matching closing tag at line 125 changes from `</ScrollView>` to `</KeyboardAwareScrollView>`.

- [ ] **Step 4: Manual verification on Android**

Run:
```bash
npx expo start --clear
```

In the app, open the shop flow that triggers `StorePickerSheet` (start a new shopping session). Then:

1. Tap **Add new store…** to reveal the chain/branch text inputs.
2. Tap the **Chain** input — keyboard appears. Confirm both inputs and the **Start reviewing** button remain visible above the keyboard.
3. Tap the **Branch** input — confirm it scrolls into view above the keyboard.
4. Dismiss the keyboard — sheet returns to position smoothly without jank.

Expected: all inputs and the action button are above the keyboard at all times. If a regression is visible, stop and investigate before continuing.

Stop the server (Ctrl+C).

- [ ] **Step 5: Commit**

```bash
git add components/StorePickerSheet.tsx
git commit -m "fix(StorePickerSheet): keyboard-safe inputs on Android via keyboard-controller"
```

---

## Task 4: Update FoodNutritionSheet

**Files:**
- Modify: `components/FoodNutritionSheet.tsx`

Same pattern as Task 3.

- [ ] **Step 1: Update imports**

The current `react-native` import (lines 2–12):

```tsx
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
```

Remove `KeyboardAvoidingView`, `Platform`, and `ScrollView`, then add a new import for the library:

```tsx
import {
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { KeyboardAvoidingView, KeyboardAwareScrollView } from "react-native-keyboard-controller";
```

- [ ] **Step 2: Drop the Platform.OS branching on KeyboardAvoidingView**

At lines 133–136 the current usage is:

```tsx
<KeyboardAvoidingView
  style={styles.overlay}
  behavior={Platform.OS === "ios" ? "padding" : undefined}
>
```

Change to:

```tsx
<KeyboardAvoidingView
  style={styles.overlay}
  behavior="padding"
>
```

- [ ] **Step 3: Replace ScrollView with KeyboardAwareScrollView**

At lines 177–181 the current usage is:

```tsx
<ScrollView
  style={styles.fields}
  showsVerticalScrollIndicator={false}
  keyboardShouldPersistTaps="handled"
>
```

Change to:

```tsx
<KeyboardAwareScrollView
  style={styles.fields}
  showsVerticalScrollIndicator={false}
  keyboardShouldPersistTaps="handled"
>
```

The matching closing tag at line 259 changes from `</ScrollView>` to `</KeyboardAwareScrollView>`.

- [ ] **Step 4: Manual verification on Android**

Run:
```bash
npx expo start --clear
```

In the app, open any recipe and tap an ingredient that opens `FoodNutritionSheet` (e.g. on a plan/recipe detail screen). Then:

1. Tap **Brand** input — keyboard appears. Confirm input + Done button still visible.
2. Tap **Product Name** — confirm it scrolls into view.
3. Scroll the body and tap **Calories**, **Protein**, **Carbs**, **Fat** in turn. Each focused field should sit above the keyboard.
4. Confirm the **Done** button at the bottom of the sheet is never covered by the keyboard.

Expected: every input above the keyboard line when focused; Done button always reachable. Stop the server (Ctrl+C).

- [ ] **Step 5: Commit**

```bash
git add components/FoodNutritionSheet.tsx
git commit -m "fix(FoodNutritionSheet): keyboard-safe inputs on Android via keyboard-controller"
```

---

## Task 5: Update ReviewItemSheet

**Files:**
- Modify: `components/ReviewItemSheet.tsx`

Same pattern as Task 4.

- [ ] **Step 1: Update imports**

The current `react-native` import (lines 4–15):

```tsx
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
```

Change to:

```tsx
import {
  Modal,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { KeyboardAvoidingView, KeyboardAwareScrollView } from "react-native-keyboard-controller";
```

- [ ] **Step 2: Drop the Platform.OS branching on KeyboardAvoidingView**

At lines 160–163 the current usage is:

```tsx
<KeyboardAvoidingView
  style={styles.overlay}
  behavior={Platform.OS === "ios" ? "padding" : undefined}
>
```

Change to:

```tsx
<KeyboardAvoidingView
  style={styles.overlay}
  behavior="padding"
>
```

- [ ] **Step 3: Replace ScrollView with KeyboardAwareScrollView**

At lines 189–193 the current usage is:

```tsx
<ScrollView
  showsVerticalScrollIndicator={false}
  style={styles.fields}
  keyboardShouldPersistTaps="handled"
>
```

Change to:

```tsx
<KeyboardAwareScrollView
  showsVerticalScrollIndicator={false}
  style={styles.fields}
  keyboardShouldPersistTaps="handled"
>
```

The matching closing tag (around line 351, the `</ScrollView>` immediately before the `</View>` for the sheet container at line 362) changes from `</ScrollView>` to `</KeyboardAwareScrollView>`.

- [ ] **Step 4: Manual verification on Android**

Run:
```bash
npx expo start --clear
```

In the app, get into a shopping session that opens `ReviewItemSheet` (Shop tab → start shopping → tap an item to review). Then:

1. Tap **Brand** input — keyboard appears. Confirm input + Done button still visible.
2. Tap **Product name** — confirm scroll-into-view.
3. Tap **Qty amount**, **Price**, and **Barcode** in turn. Each focused field should sit above the keyboard.
4. Confirm the **Done** button is never covered.

Expected: every input above the keyboard line when focused; Done button always reachable. Stop the server (Ctrl+C).

- [ ] **Step 5: Commit**

```bash
git add components/ReviewItemSheet.tsx
git commit -m "fix(ReviewItemSheet): keyboard-safe inputs on Android via keyboard-controller"
```

---

## Task 6: Update AddItemSheet

**Files:**
- Modify: `components/AddItemSheet.tsx`

This sheet has no `KeyboardAvoidingView` today. Add one by wrapping the overlay, and swap the inner `ScrollView` for `KeyboardAwareScrollView`.

Sheet shape (current): the `<View style={styles.overlay}>` at line 122 is `flex: 1` with `justifyContent: 'flex-end'`. Children: a scrim and a closing `Pressable` (both `absoluteFill`), then the `<Animated.View style={[styles.sheet, sheetStyle]}>` (height = `SHEET_HEIGHT`, the only non-absolute child — anchored at the bottom via `flex-end`). Inside the animated sheet is header → `<ScrollView>` body → footer with the add button.

The `KeyboardAvoidingView` from `react-native-keyboard-controller` accepts the same `style` and `behavior` props as the RN built-in. We replace the outer overlay `<View>` with `<KeyboardAvoidingView>` carrying the same `styles.overlay`. Because the scrim and pressable are absolute, they ignore the layout shift; only the animated sheet (the flex child) moves up.

- [ ] **Step 1: Update imports**

The current `react-native` import (lines 2–11):

```tsx
import {
  Modal,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
```

Remove `ScrollView` from `react-native`, then add a new import for the library:

```tsx
import {
  Modal,
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import { KeyboardAvoidingView, KeyboardAwareScrollView } from 'react-native-keyboard-controller';
```

- [ ] **Step 2: Replace the outer overlay View with KeyboardAvoidingView**

The current block (lines 121–127):

```tsx
<View style={styles.overlay}>
  <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />
  <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

  <Animated.View style={[styles.sheet, sheetStyle]}>
    <View style={styles.handle} />
```

Change the opening `<View style={styles.overlay}>` to `<KeyboardAvoidingView style={styles.overlay} behavior="padding">`:

```tsx
<KeyboardAvoidingView style={styles.overlay} behavior="padding">
  <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />
  <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

  <Animated.View style={[styles.sheet, sheetStyle]}>
    <View style={styles.handle} />
```

At the matching closing tag (currently `</View>` at line 274, immediately after the closing `</Animated.View>` for the sheet), change `</View>` to `</KeyboardAvoidingView>`:

Before (lines 273–275):

```tsx
        </Animated.View>
      </View>
    </Modal>
```

After:

```tsx
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
```

- [ ] **Step 3: Replace ScrollView with KeyboardAwareScrollView**

The current block (lines 143–148):

```tsx
<ScrollView
  style={styles.body}
  contentContainerStyle={styles.bodyContent}
  keyboardShouldPersistTaps="handled"
  showsVerticalScrollIndicator={false}
>
```

Change to:

```tsx
<KeyboardAwareScrollView
  style={styles.body}
  contentContainerStyle={styles.bodyContent}
  keyboardShouldPersistTaps="handled"
  showsVerticalScrollIndicator={false}
>
```

The matching closing tag at line 256 changes from `</ScrollView>` to `</KeyboardAwareScrollView>`.

- [ ] **Step 4: Manual verification on Android**

Run:
```bash
npx expo start --clear
```

In the app, open the Shop tab and tap **+ Add item**. The `AddItemSheet` opens. Then:

1. The **Item name** input has `autoFocus` — keyboard appears immediately on open. Confirm the input and the **+ Add to list** button at the bottom both remain visible above the keyboard.
2. Tap **Quantity** and **Price** — confirm each focused field is visible.
3. Tap **Add note**, then tap the **Note** input (which appears near the bottom of the form). Confirm the Note input scrolls into view above the keyboard.
4. Dismiss keyboard — sheet returns to position smoothly.

Expected: every input visible, **+ Add to list** never covered. The slide-up entry animation still works on open. Stop the server (Ctrl+C).

- [ ] **Step 5: Commit**

```bash
git add components/AddItemSheet.tsx
git commit -m "fix(AddItemSheet): keyboard-safe inputs on Android via keyboard-controller"
```

---

## Task 7: Update AddPriceSheet

**Files:**
- Modify: `components/AddPriceSheet.tsx`

This sheet has no `KeyboardAvoidingView` today. Wrap the Modal's contents in one.

Sheet shape (current): the `<Modal>` directly contains a `<TouchableOpacity style={styles.backdrop}>` (flex: 1) and a `<View style={styles.sheet}>` (no flex positioning, `maxHeight: '80%'`). The sheet flows below the backdrop's flexed area, anchoring it visually to the bottom. Inside the sheet is a `<ScrollView>` containing all fields.

We add a `<KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">` directly inside the Modal, with the backdrop and sheet as children. This lifts the sheet above the keyboard. We also swap the inner `<ScrollView>` for `<KeyboardAwareScrollView>`.

- [ ] **Step 1: Update imports**

The current `react-native` import (lines 2–5):

```tsx
import {
  View, TextInput, TouchableOpacity, Switch,
  StyleSheet, Modal, ScrollView, Platform,
} from 'react-native';
```

Remove `ScrollView` from `react-native` (keep `Platform` — it is still used elsewhere in the file for the date picker). Add a new import for the library:

```tsx
import {
  View, TextInput, TouchableOpacity, Switch,
  StyleSheet, Modal, Platform,
} from 'react-native';
import { KeyboardAvoidingView, KeyboardAwareScrollView } from 'react-native-keyboard-controller';
```

(Verify `Platform` is still referenced in the file before removing — line 206 uses `Platform.OS === 'ios'` for the date picker. Keep it.)

- [ ] **Step 2: Wrap Modal contents in KeyboardAvoidingView**

The current block (lines 76–86):

```tsx
return (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <TouchableOpacity
      style={styles.backdrop}
      activeOpacity={1}
      onPress={onClose}
      accessibilityLabel="Dismiss"
      accessibilityRole="button"
    />
    <View style={styles.sheet}>
      <View style={styles.handle} />
```

Wrap both children of the Modal in a `<KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">`:

```tsx
return (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
        accessibilityLabel="Dismiss"
        accessibilityRole="button"
      />
      <View style={styles.sheet}>
        <View style={styles.handle} />
```

The matching closing tag — currently `</Modal>` at line 237, preceded by `</View>` at line 236 (the closing of `<View style={styles.sheet}>`) — becomes:

Before (lines 235–237):

```tsx
        </ScrollView>
      </View>
    </Modal>
```

After:

```tsx
        </KeyboardAwareScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>
```

(The `</ScrollView>` → `</KeyboardAwareScrollView>` change is covered in Step 3 below; the close-tag addition for `</KeyboardAvoidingView>` happens here.)

- [ ] **Step 3: Replace ScrollView with KeyboardAwareScrollView**

The current opening tag (line 87):

```tsx
<ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
```

Change to:

```tsx
<KeyboardAwareScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
```

The matching closing tag at line 235 changes from `</ScrollView>` to `</KeyboardAwareScrollView>` (already incorporated in Step 2's diff).

- [ ] **Step 4: Manual verification on Android**

Run:
```bash
npx expo start --clear
```

In the app, get to a place that opens `AddPriceSheet` (e.g. tap the **Log price** action on an item with nutrition data — typically from the Plan or Recipe screen via a price chart). Then:

1. Tap **Add new store…** → keyboard appears for the new-store name. Confirm input + **Save price** button visible.
2. Tap **Price** input — confirm it's visible above the keyboard.
3. Tap **Qty** input — confirm visible.
4. Dismiss keyboard — sheet returns smoothly.

Expected: every input visible, Save button never covered. Stop the server (Ctrl+C).

- [ ] **Step 5: Commit**

```bash
git add components/AddPriceSheet.tsx
git commit -m "fix(AddPriceSheet): keyboard-safe inputs on Android via keyboard-controller"
```

---

## Task 8: End-to-end manual verification + iOS sanity check

**Files:** none (verification only).

- [ ] **Step 1: Run typecheck and test suite**

Run:
```bash
npx tsc --noEmit
npm test -- --watchAll=false
```

Expected: no new TypeScript errors. Tests pass (no test changes were made; pre-existing failures, if any, must not be newly introduced by this work — compare against `git stash`-ed pre-change state if needed).

- [ ] **Step 2: Full Android run-through**

Run:
```bash
npx expo start --clear
```

On an Android device, exercise the full set in one session:

1. **AddItemSheet** — Shop tab → + Add item → focus every input, confirm note input scrolls into view, add button stays above keyboard.
2. **AddPriceSheet** — Plan/recipe → log price → focus every input.
3. **StorePickerSheet** — Start a shopping session → Add new store → focus chain and branch.
4. **ReviewItemSheet** — In a shopping session, tap an item → focus brand, product, qty, price, barcode.
5. **FoodNutritionSheet** — Recipe → tap an ingredient to open nutrition → focus all six inputs.

In each case: focused input must be above the keyboard, action button at sheet bottom must remain reachable, dismissing the keyboard must not leave visual artifacts.

- [ ] **Step 3: iOS sanity check (no regression)**

On an iOS simulator or device, repeat at least one sheet from each category:

1. `AddItemSheet` (newly-wrapped sheet).
2. `FoodNutritionSheet` (existing-wrapper sheet).

Confirm behavior is at least as good as before — focused fields stay above the keyboard. If iOS shows the sheet shifting too aggressively or oddly, the library accepts a `keyboardVerticalOffset` prop; only adjust if needed.

- [ ] **Step 4: Final commit (only if any tweaks were made)**

If steps 1–3 surfaced any minor adjustment (e.g. a `keyboardVerticalOffset` tweak), commit it now:

```bash
git add <changed files>
git commit -m "fix(keyboard): adjust offset after device verification"
```

If no tweaks were needed, skip this step.

---

## Done

All text inputs across the five sheets now lift above the keyboard on Android (and continue to behave on iOS), with the focused field auto-scrolled into view in the longer forms.
