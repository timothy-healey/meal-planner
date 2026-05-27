---
name: Meal Planner
description: A personal, warm-as-a-recipe-book meal planning and grocery app for one.
colors:
  forest-pantry: "#1C453C"
  baked-terracotta: "#744234"
  persimmon-sprinkle: "#E87B3A"
  cream-linen: "#F4F5EB"
  warm-parchment: "#FAFAF4"
  receipt-paper: "#fbfbf2"
  receipt-edge: "#b8b8a0"
  on-green-bright: "#F4F5EB"
  on-green-mist: "#c4d5d0"
  text-primary: "#1C453C"
  text-secondary: "#666658"
  text-tertiary: "#6c6c5e"
  text-note: "#756347"
  tab-inactive: "#aeae9e"
  stone-edge: "#e9eadc"
  checkbox-stroke: "#ced0c1"
  eucalyptus-pale: "#e8f0ee"
  scrim-forest: "#1C453C73"
  header-pill: "#1C453C40"
  sale-peach: "#FEF0E6"
  scanner-void: "#111111"
  series-teal: "#3B6E8C"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: "32px"
    letterSpacing: "0"
  headline:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, sans-serif"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: "24px"
    letterSpacing: "0"
  title:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: "22px"
    letterSpacing: "0"
  body-large:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: "20px"
    letterSpacing: "0"
  body:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
    letterSpacing: "0"
  label:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "14px"
    letterSpacing: "0.3px"
  overline:
    fontFamily: "Plus Jakarta Sans, system-ui, -apple-system, sans-serif"
    fontSize: "9px"
    fontWeight: 700
    lineHeight: "12px"
    letterSpacing: "1.1px"
rounded:
  xs: "4px"
  sm: "5px"
  md: "10px"
  lg: "16px"
  xl: "20px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
components:
  button-primary:
    backgroundColor: "{colors.forest-pantry}"
    textColor: "{colors.on-green-bright}"
    typography: "{typography.label}"
    rounded: "{rounded.xl}"
    padding: "8px 12px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.warm-parchment}"
    textColor: "{colors.forest-pantry}"
    typography: "{typography.label}"
    rounded: "{rounded.xl}"
    padding: "8px 12px"
    height: "44px"
  card:
    backgroundColor: "{colors.warm-parchment}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "20px"
  card-hero:
    backgroundColor: "{colors.forest-pantry}"
    textColor: "{colors.on-green-bright}"
    rounded: "{rounded.lg}"
    padding: "16px"
  stat-card:
    backgroundColor: "{colors.warm-parchment}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "8px"
  badge-today:
    backgroundColor: "{colors.header-pill}"
    textColor: "{colors.persimmon-sprinkle}"
    typography: "{typography.overline}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  chip-macro:
    backgroundColor: "{colors.eucalyptus-pale}"
    textColor: "{colors.forest-pantry}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  divider:
    backgroundColor: "{colors.stone-edge}"
    height: "1px"
  divider-paper:
    backgroundColor: "{colors.receipt-edge}"
    height: "1px"
---

# Design System: Meal Planner

## 1. Overview

**Creative North Star: "The Sunday Kitchen"**

Sunday morning. Coffee cooling on a butcher-block counter, a well-worn recipe book open to a dog-eared page, a basket of vegetables waiting to be chopped. The app lives inside that scene — earthy, considered, unhurried. Forest-green deep enough to feel like a pantry wall meets cream linen warm enough to feel like an apron. The interface is a kitchen tool, not a tracker; it does not optimize, it nourishes.

This system rejects the entire vocabulary of fitness-tracker UI: clinical white, neon macros, dark-mode dashboards lit like a stock-trading terminal. It rejects the SaaS-cream-with-blue-accent aesthetic that has eaten every productivity app since 2020. Color comes from food and earth — never from a Tailwind preset. The cream surface is the canvas; orange is the verb (CTA fills) and the headline number (prices, calories); terracotta is the seasoning, marking the categories the way a chalk label marks a market crate.

The user holds the phone one-handed in a bright supermarket aisle. Density is low. Tap targets are generous. Words are warm. The kitchen on Sunday, not the gym on Monday.

**Key Characteristics:**
- Cream canvas, never pure white. Every neutral tints toward the forest hue.
- Deep forest-green hero treatment on headers and signature cards.
- A single warm sans (Plus Jakarta Sans) carries everything — display through overline.
- Orange as action: filled CTA pills (shape = tap me) and inline key numbers (text = headline).
- Terracotta as seasoning: category dots, UPPERCASE labels, quantity tags — labels only, never fills.
- Hierarchy through color and weight, never through colored side-stripes or heavy borders.
- Shadows tinted forest green, soft and low. No hard drop shadows.
- 44dp minimum tap targets. Made for one-handed use in a grocery aisle.

## 2. Colors

A palette pulled from a farmers-market crate: pantry green, baked terracotta, a sprinkle of persimmon, on a tablecloth of cream linen. Every neutral is tinted toward the green hue; no pure white, no pure black.

### Primary

- **Forest Pantry** (`#1C453C`): The hero. Headers, the active tab, item names on cream, the checkmark fill, the TodayCard and BatchPlanBanner backdrops. The visual anchor of the entire system.

### Secondary

- **Baked Terracotta** (`#744234`): The seasoning color. Category headers (`PRODUCE`, `MEAT`), quantity tags, the dot that prefixes each section. It labels and classifies — it never fills a button, never tints a CTA, never functions as a key number. Sprinkled across the screen as taxonomy.

### Tertiary

- **Persimmon Sprinkle** (`#E87B3A`): The action color. Fills every primary CTA (FAB, "Done shopping" bar, sheet primary buttons, swipe-to-reveal actions) and tints inline key numbers (prices in the basket, the calorie count in TodayCard, the `TODAY` badge text, the remainder of the progress bar). It carries two registers — a *shape* (a pill or fill) means "tap me", inline *text* means "this is the headline number".

### Neutral

- **Cream Linen** (`#F4F5EB`): Screen background. The default canvas. Also doubles as on-green text.
- **Warm Parchment** (`#FAFAF4`): Card surface, recipe cards, stat pills. A whisper warmer than Cream Linen so cards lift gently off the canvas without a shadow doing all the work.
- **Receipt Paper** (`#fbfbf2`): Background for the receipt screen specifically. Warmer than Cream Linen, evokes till paper.
- **Receipt Edge** (`#b8b8a0`): Dashed dividers on the receipt screen. The desaturated cousin of Cream Linen, doing one job in one place.
- **Stone Edge** (`#e9eadc`): List dividers and the tab-bar border. Quiet. Never a colored stripe.
- **Eucalyptus Pale** (`#e8f0ee`): Background of macro chips in ingredient rows. A breath of pale green-blue.
- **Checkbox Stroke** (`#ced0c1`): The unchecked checkbox border.

### Text Hierarchy (on Cream Linen)

- **Text Primary** = Forest Pantry (`#1C453C`): item names, headings.
- **Text Secondary** (`#666658`): protein values, secondary stats. 4.7:1 contrast on cream (AA).
- **Text Tertiary** (`#6c6c5e`): cook time, tertiary stats, inactive labels. 4.78:1 on cream (AA).
- **Text Note** (`#756347`): notes and captions, warm brown undertone. 5.24:1 on cream (AA).
- **Tab Inactive** (`#aeae9e`): inactive tab labels only. Muted by convention; do not use for body text.

### On Green Header

- **On-Green Bright** (`#F4F5EB`): primary text on the green header.
- **On-Green Mist** (`#c4d5d0`): supporting text on green ("Week of DD MMM", back links). Never apply outside the green surface.

### Series (charts)

- Forest Pantry → Baked Terracotta → **Series Teal** (`#3B6E8C`). Warm-palette siblings; the teal is the third store, chosen to harmonize without competing.

### Overlays

- **Scrim** (`rgba(28,69,60,0.45)`): modal and sheet backdrops. Tinted forest, never pure black.
- **Header Pill** (`rgba(28,69,60,0.25)`): the budget/count pill background on the green header.
- **Sale Peach** (`#FEF0E6`): the "on sale" chart legend swatch. Lives only inside the price-history chart.

### Named Rules

**The Orange-as-Action Rule.** Persimmon Sprinkle (`#E87B3A`) is the action color and has exactly two registers. (1) Filled shapes — the FAB, primary CTA pills inside sheets, the "Done shopping" bar, swipe-to-reveal action panels. These read as *tap me* because of the shape, not the color. (2) Inline text — prices, calorie counts, the `TODAY` badge text, the progress-bar remainder. These read as *this is the headline number*. Orange is forbidden as a page surface, a heading color, a decorative wash, a card background, or a body text color. The shape carries the verb; the inline color carries the number.

**The Terracotta-as-Seasoning Rule.** Baked Terracotta (`#744234`) is the seasoning color. It labels and classifies — category headers, the dots that prefix them, quantity tags. It never fills a button, never backs a CTA, never functions as a key number. The 7×7 terracotta dot before `PRODUCE` is the canonical use; if a new use isn't *labeling* or *classifying*, it shouldn't be terracotta.

**The Cream Canvas Rule.** Backgrounds are Cream Linen or Warm Parchment. `#FFFFFF` is forbidden. If a surface needs to feel "clean", warm it; do not bleach it.

**The Warm-Black Rule.** `#000000` is forbidden. Shadows, scrims, and dark surfaces all carry the forest hue. The Scanner viewfinder (`#111111`) is the only allowed near-black, and it exists for a few hundred milliseconds before the camera takes over.

## 3. Typography

**Single Font:** Plus Jakarta Sans (with system fallback `system-ui, -apple-system, sans-serif`).

**Character:** One warm, slightly rounded humanist sans carries the entire system — display down to overline. No serif/sans pairing, no display face, no italic. The voice is consistent and friendly: a recipe-book voice, not a stockbroker's.

Five weights are loaded: Regular (400), Medium (500), SemiBold (600), Bold (700), ExtraBold (800). Hierarchy is built almost entirely through weight × size × color. There is no italic variant; emphasis comes from weight or from Text Note color.

### Hierarchy

- **Display** (ExtraBold 800, 28px, 32px line-height): primary screen titles — "Shopping List", "Recipes", "Plan". Sits on cream.
- **Headline** (ExtraBold 800, 20px, 24px line-height): recipe detail title, StatStrip values, hero card titles (TodayCard day name, BatchPlanBanner title).
- **Title** (Bold 700, 17px, 22px line-height): secondary screen titles, modal sheet headers.
- **Body Large** (Medium 500, 15px, 20px line-height): plan-day cards, item names in the shopping list, meal rows in TodayCard.
- **Body** (Regular 400, 13px, 18px line-height): default body text, recipe card names, ingredient rows.
- **Label** (SemiBold 600, 11px, 14px line-height, 0.3px tracking): back links, item details, recipe stats, category labels in the food sheet.
- **Overline** (Bold 700, 9px, 12px line-height, 1.1px tracking, UPPERCASE): category headers (`PRODUCE`, `MEAT`), the `TODAY` badge, tab labels.

### Named Rules

**The One-Family Rule.** Plus Jakarta Sans is the only font. Display fonts, monospace, and serif faces are forbidden, including for prices and quantities. Numerals use the same family as letters.

**The No-Italic Rule.** The family ships without italic and we honor that. Captions and notes use the Text Note color (`#756347`) at regular weight to read as "soft" — never an italicized sans approximation.

**The Tracking-On-Overline Rule.** Letter-spacing is reserved. Body and label run at 0; only Overline carries the 1.1px tracking that gives category headers their crate-label feel. Do not add tracking to body text to make it "feel design-y".

## 4. Elevation

Flat by default. Cards rest on the cream surface and lift only barely, on a soft shadow tinted forest green — never pure black. There are exactly **four shadow tokens** and no others. Layered depth is conveyed through tinted neutrals (Warm Parchment lifts a fraction above Cream Linen) more than through shadows.

This is a React Native project, so "elevation" is platform-native: on iOS we use `shadowColor`/`shadowOffset`/`shadowOpacity`/`shadowRadius`; on Android we set `elevation`. Every shadow token colors from Forest Pantry (`#1C453C`), so the cast is warm and a little soft — like a card lit by a kitchen window, not a spotlight.

### Shadow Vocabulary

- **card** (`shadowColor: #1C453C; shadowOffset: 0 1; shadowOpacity: 0.07; shadowRadius: 3; elevation: 2`): the resting state of every card, recipe row, and stat pill.
- **pill** (`shadowColor: #1C453C; shadowOffset: 0 1; shadowOpacity: 0.10; shadowRadius: 4; elevation: 2`): the floating CTAs (the Pill primitive — both green and white variants, plus orange CTA fills). Slightly more pronounced so a tap target lifts off a card surface.
- **sheet** (`shadowColor: #1C453C; shadowOffset: 0 -3; shadowOpacity: 0.12; shadowRadius: 12; elevation: 16`): bottom sheets only. Cast upward from the sheet's top edge so it lifts off the page before the scrim swallows it.
- **lift** (`shadowColor: #1C453C; shadowOffset: 0 2; shadowOpacity: 0.12; shadowRadius: 6; elevation: 4`): drag-state only. Used by sortable rows while being dragged — heavier than `pill` because the row is *picked up*, not just *tappable*.

### Named Rules

**The Warm-Shadow Rule.** Every shadow tints from Forest Pantry. `shadowColor: '#000'` is forbidden. A pure-black shadow on cream looks like a SaaS dashboard; a forest-green shadow on cream looks like a recipe card on a kitchen counter. **Viewfinder exception:** inside the camera scanner, the orange scan-line glow is permitted — the glow IS the affordance, and the surrounding `scannerBg` is dark enough that the rule's intent (no SaaS-dashboard chrome) is preserved.

**The Four-Shadow Rule.** There are four shadow tokens: `card`, `pill`, `sheet`, `lift`. Do not add a fifth. If a component needs more lift than `pill`, it's either a `sheet` (cast upward, used for bottom sheets) or a `lift` (drag state) — or the answer is a different background color (Forest Pantry), not a new shadow.

## 5. Components

Components are touch-first, low-density, warm. Corners are gently rounded (10px on cards, 20px on pills). Borders are rare — when they appear, they are 1–1.5px and use neutral or brand colors, never a colored side-stripe.

### Buttons

Three button languages cover the surface — match the role to the language.

#### CTA fill (the orange action)
- The primary action of any screen or sheet. Persimmon Sprinkle background, On-Green Bright text. Used by the FAB, "Done shopping" bar, sheet primary buttons (Save / Confirm / Done), and swipe-to-reveal action panels.
- **Shape:** `radius.full` for floating CTAs, `radius.full` or `radius.md` for sheet-anchored ones. Minimum 44dp tap height (60dp for the FAB).
- **Press:** light haptic impact + `activeOpacity: 0.85`. The orange already reads loud — opacity dip is enough.

#### Pill (the green/white shoulders)
- The `Pill` primitive carries secondary or supporting actions. Two variants, both 44dp minimum, both with the `pill` shadow underneath.
- **Green variant:** Forest Pantry background, On-Green Bright text and icon. Used for prominent supporting CTAs.
- **White variant:** Warm Parchment background, Forest Pantry text and icon. Used inside content surfaces (EmptyState, the Plan-tab Import button).
- **Press:** light haptic impact + `activeOpacity: 0.7`.

#### Ghost (the icon-only touchable)
- A 44×44dp Touchable with an icon and no fill — used for the Reorder button in the green header, the close (×) in sheets. No shadow, no background; the icon does the work.

### Cards (the `Card` primitive + `RecipeCard`)

- **Corner Style:** 10px (`radius.md`).
- **Background:** Warm Parchment (`#FAFAF4`).
- **Shadow Strategy:** the `card` shadow only. No border.
- **Internal Padding:** 20px (`spacing.5`), with `gap: spacing.2` between stacked text blocks.

### Hero Card (TodayCard, BatchPlanBanner)

- **Corner Style:** 16px (`radius.lg`).
- **Background:** Forest Pantry.
- **Text colors:** On-Green Bright for the primary line, On-Green Mist for supporting.
- **Distinctive accent:** Persimmon Sprinkle is allowed here for one element only (the `TODAY` badge text, the calorie footer). It is the only place orange touches a green surface, and it does so to flag the active day or the headline number.
- **Internal divider:** when a footer is split off the body, use a 1px line at `rgba(255,255,255,0.15)` rather than a colored stripe.

### Checkbox

- **Shape:** 20×20px, 4px corner radius (`radius.xs`).
- **Unchecked:** 1.5px Checkbox Stroke border on transparent.
- **Checked:** Forest Pantry fill, On-Green Bright `checkmark` icon (13px Ionicon).
- **Behavior:** wrapped in a row TouchableOpacity that fires `Haptics.impactAsync(Light)` on toggle.

### Category Header (the crate label)

- A 7×7px Baked Terracotta dot, then the category name in UPPERCASE Overline, in Baked Terracotta, with 1.1px tracking. Stacks directly above the rows it labels — no card, no background, no border. The dot is the affordance.

### Macro Chip

- Eucalyptus Pale background, Forest Pantry label, 5px radius, 2×6px padding. Used inside ingredient rows to show per-serve macros without a card-on-card.

### Divider

- 1px line on Stone Edge (`#e9eadc`). One token, one job, edge-to-edge. On the receipt screen it switches to a dashed pattern on Receipt Edge (`#b8b8a0`) to evoke till paper.

### Inputs

- Cream-tinted background, Forest Pantry text, 5–10px radius, 1px Stone Edge border at rest.
- **Focus:** Forest Pantry border, no glow, no ring. The border weight does not change.
- **Error:** Baked Terracotta border + helper text in Baked Terracotta at Label size.

### Navigation (Tab Bar)

- Bottom tabs on Cream Linen with a 1px Stone Edge top border.
- **Active:** Forest Pantry icon + label.
- **Inactive:** Tab Inactive (`#aeae9e`) icon + label.
- Label typography: Overline (9px, 1.1px tracking, uppercase). Tap targets stretch the full tab cell.

### Green Header (signature surface)

- Forest Pantry background that bleeds edge-to-edge under the system status bar via `SafeAreaView edges={['top']}`. 16px horizontal padding, 12px bottom padding.
- Contents: screen title (Display, On-Green Bright), an optional supporting line (Body, On-Green Mist), and small Header Pills (`rgba(28,69,60,0.25)`) for budget and count summaries.

### Progress Bar

- 4px tall, 2px radius. The track is unset (transparent) so the two colors butt against each other.
- **Filled portion:** On-Green Bright (Cream Linen). **Remaining portion:** Persimmon Sprinkle. This is the only place the orange covers an extended length, and the metaphor is "how much budget is still warm".

### Skeleton

- An animated `View` that pulses backgroundColor between Stone Edge and Cream Linen over 1000ms ease-in-out. There is a `dark` variant for skeletons living on the green header (white 0.10 → 0.25).
- No shimmer gradient, no spinner. The component holds the shape it's loading.

## 6. Do's and Don'ts

### Do:

- **Do** background every screen with Cream Linen (`#F4F5EB`) and float cards on Warm Parchment (`#FAFAF4`). The half-shade between the two is doing most of the visual work.
- **Do** anchor every screen with the Green Header on Forest Pantry — it is the system's primary visual signature.
- **Do** fill primary CTAs (FAB, Done-shopping bar, sheet primary buttons) with Persimmon Sprinkle. The orange fill is the verb of the system.
- **Do** tint inline key numbers with Persimmon Sprinkle — prices, calorie counts, the `TODAY` badge text, the progress-bar remainder. The orange inline text is the headline number.
- **Do** mark categories and taxonomy with Baked Terracotta — the dot prefix, the UPPERCASE label, the quantity tag.
- **Do** color shadows with Forest Pantry at low opacity (0.07 cards, 0.10 pills, 0.12 sheets/lifts). `shadowColor: '#000'` is forbidden.
- **Do** maintain a 44dp minimum tap height on every interactive element. The app is used one-handed in a grocery aisle.
- **Do** fire a Light haptic impact on every toggle (checkbox, pill press). The kitchen-tool feel comes from physical feedback.
- **Do** import all colors, sizes, weights, and radii from `constants/tokens.ts`. No raw hex codes in components, ever.
- **Do** use the `AppText` component with `weight`, `size`, `color` props — never raw `<Text style={{ fontFamily: ... }}>` outside of `<Svg>` and `<TextInput>` contexts (where AppText doesn't fit).
- **Do** lay categories out as a Baked Terracotta dot + UPPERCASE Overline header, never as a colored band or a card.
- **Do** use Eucalyptus Pale chips for inline macros inside ingredient rows.

### Don't:

- **Don't** use `#FFFFFF` or `#000000` anywhere. The warm-black rule (above) and the cream canvas rule (above) both forbid them. The only allowed near-black is `#111` on the camera viewfinder, briefly.
- **Don't** ship designs that feel like a **cold fitness-tracker UI** (PRODUCT.md anti-reference). No saturated activity rings, no dark macro dashboards, no neon accents on charcoal.
- **Don't** ship designs that feel like a **pure-white sterile health app** (PRODUCT.md anti-reference). No clinical white, no Helvetica Neue Thin, no medical-grade emptiness.
- **Don't** ship designs that feel like a **neon dark-mode macro dashboard** (PRODUCT.md anti-reference). The app is light-mode by intention.
- **Don't** add a colored left-stripe to cards or rows. The Hierarchy-Through-Color principle in PRODUCT.md forbids it. Use a tinted background, leading icon, or category dot.
- **Don't** use Persimmon Sprinkle as a page surface, a heading color, a card background, a decorative wash, or body text. Orange is a *shape* (CTA fill) or a *headline number* (inline) — and nothing else.
- **Don't** fill anything with Baked Terracotta. No terracotta buttons, no terracotta backgrounds, no terracotta CTAs. Terracotta labels and classifies, full stop.
- **Don't** introduce a second font family. No serif display, no monospace for prices, no rounded display face. Plus Jakarta Sans carries everything.
- **Don't** italicize. The family has no italic. Use Text Note color (`#756347`) for "soft" captions.
- **Don't** add a fifth shadow token. The four (`card`, `pill`, `sheet`, `lift`) cover every legitimate case.
- **Don't** use a spinner inside content. Skeletons hold the shape until data arrives.
- **Don't** add gradient text. `background-clip: text` is forbidden, regardless of the color combination.
- **Don't** use glassmorphism, blurred cards, or backdrop filters as decoration. The Green Header is opaque, the scrim is a flat tinted-forest fill.
- **Don't** decorate with a hero-metric template (big-number-small-label-supporting-stats). StatStrip is the only place a number sits next to its label, and it's restrained — small label above the value, both on a Warm Parchment card.
