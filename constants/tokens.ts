// Design tokens — single source of truth for the meal planner app.
// Import from here; never hard-code colours, sizes, or font names in components.

// ─── Colour ──────────────────────────────────────────────────────────────────

export const colors = {
  // Brand
  green:      '#1C453C', // hero: headers, item names, checkmarks, active tab
  terracotta: '#744234', // category labels, quantities
  orange:     '#E87B3A', // prices, budget total, calories

  // Surfaces
  cream: '#F4F5EB', // screen background, card surfaces
  card:  '#FAFAF4', // recipe cards, stat pills — warm white tinted toward brand
  paper:        '#fbfbf2', // receipt screen background (warmer than cream)
  paperDivider: '#b8b8a0', // dashed dividers on receipt screen

  // On-green (elements rendered on the dark green header)
  onGreen:       '#F4F5EB', // primary text on green
  onGreenSubtle: '#c4d5d0', // supporting text on green (week label, back link)

  // Text hierarchy (on cream)
  textPrimary:   '#1C453C', // item names, headings
  textSecondary: '#666658', // protein, secondary stats — 4.7:1 on cream (AA)
  textTertiary:  '#6c6c5e', // time, tertiary stats, inactive labels — 4.78:1 on cream (AA normal)
  textNote:      '#756347', // notes, captions (warm brown undertone) — 5.24:1 on cream (AA normal)
  tabInactive:   '#aeae9e', // inactive tab labels — muted by convention, not for body text

  // Structural
  divider:       '#e9eadc', // list dividers, tab bar border
  checkboxBorder:'#ced0c1', // unchecked checkbox border
  chipSurface:   '#e8f0ee', // macro chip backgrounds in ingredient rows

  // Overlays — all tinted toward forest green, never pure black
  scrim:      'rgba(28, 69, 60, 0.45)', // modal/sheet backdrop
  headerPill: 'rgba(28, 69, 60, 0.25)', // budget/count pill background on green header
  saleTint:   '#FEF0E6',                // peach wash for "on sale" chart legend pill

  // Dark surfaces
  scannerBg: '#111111', // camera viewfinder background (shown briefly before camera loads)
} as const;

// Series colors for charts (warm-palette siblings — green, terracotta, muted teal-blue)
export const storeSeries = ['#1C453C', '#744234', '#3B6E8C'] as const;

export type Color = keyof typeof colors;

// ─── Typography ──────────────────────────────────────────────────────────────
// Font: Plus Jakarta Sans (single family — @expo-google-fonts/plus-jakarta-sans)
// No italic variant: use textNote color + regular weight for note-style text.

export const font = {
  family: {
    regular:   'PlusJakartaSans_400Regular',
    medium:    'PlusJakartaSans_500Medium',
    semibold:  'PlusJakartaSans_600SemiBold',
    bold:      'PlusJakartaSans_700Bold',
    extrabold: 'PlusJakartaSans_800ExtraBold',
  },

  // All sizes in dp (React Native logical pixels)
  size: {
    '2xs':  9,  // captions, budget pills, tab labels
    xs:    10,  // supporting header text ("Week of DD MMM")
    sm:    11,  // back links, item detail, recipe stats, plan meal labels, category labels
    md:    13,  // recipe card names, body
    lg:    15,  // plan day names, today card
    xl:    17,  // secondary screen titles
    '2xl': 20,  // recipe detail title, stat strip values
    '3xl': 28,  // primary screen titles (Shopping List, etc.)
  },

  // Letter spacing in dp (React Native does not support em units)
  tracking: {
    normal:   0,
    label:    0.3,  // general UI labels
    caps:     0.8,  // small uppercase labels inside sheets and the scanner result row
    category: 1.1,  // all-caps category headers (≈ 0.12em at 9dp)
  },
} as const;

export type FontFamily = keyof typeof font.family;
export type FontSize   = keyof typeof font.size;

// ─── Spacing ─────────────────────────────────────────────────────────────────
// 4dp base unit. Use these instead of raw numbers in padding/margin/gap.

export const spacing = {
  1:  4,
  2:  8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
} as const;

// ─── Border radius ────────────────────────────────────────────────────────────

export const radius = {
  xs:   4,    // checkbox
  sm:   5,    // small interactive elements
  md:   10,   // cards, recipe cards, batch plan banner
  lg:   16,   // larger panels
  xl:   20,   // pill buttons, import button
  full: 9999, // budget pills, circular badges
} as const;

// ─── Elevation (shadow) ───────────────────────────────────────────────────────
// shadowColor uses the brand green for a warmer shadow than pure black.
// Four tokens, four purposes — see DESIGN.md > Elevation.

export const shadow = {
  card: {
    shadowColor:   colors.green,
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius:  3,
    elevation:     2,
  },
  pill: {
    shadowColor:   colors.green,
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius:  4,
    elevation:     2,
  },
  // Bottom sheets — cast upward from the sheet's top edge.
  sheet: {
    shadowColor:   colors.green,
    shadowOffset:  { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius:  12,
    elevation:     16,
  },
  // Drag-lift state — items picked up during a sortable drag.
  lift: {
    shadowColor:   colors.green,
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius:  6,
    elevation:     4,
  },
} as const;
