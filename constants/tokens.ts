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
  card:  '#FFFFFF', // recipe cards, stat pills (white on cream)

  // On-green (elements rendered on the dark green header)
  onGreen:       '#F4F5EB', // primary text on green
  onGreenSubtle: '#c4d5d0', // supporting text on green (week label, back link)

  // Text hierarchy (on cream)
  textPrimary:   '#1C453C', // item names, headings
  textSecondary: '#9a9a8a', // protein, secondary stats
  textTertiary:  '#b0b1a5', // time, tertiary stats, inactive labels
  textNote:      '#888',    // notes, captions (replaces italic on this font)
  tabInactive:   '#bbb',    // inactive tab labels

  // Structural
  divider:       '#e9eadc', // list dividers, tab bar border
  checkboxBorder:'#ced0c1', // unchecked checkbox border

  // Overlays
  headerPill: 'rgba(0,0,0,0.25)', // budget/count pill background on header
} as const;

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
    '2xs':  9,  // captions, category labels, budget pills, tab labels
    xs:    10,  // supporting header text ("Week of DD MMM")
    sm:    11,  // back links, item detail, recipe stats, plan meal labels
    md:    13,  // recipe card names, body
    lg:    15,  // plan day names, today card
    xl:    17,  // screen titles (Shopping List, etc.)
    '2xl': 20,  // recipe detail title, stat strip values
  },

  // Letter spacing in dp (React Native does not support em units)
  tracking: {
    normal:   0,
    label:    0.3,  // general UI labels
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
} as const;
