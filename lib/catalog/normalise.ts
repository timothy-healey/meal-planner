/**
 * Reduce an ingredient or shopping-item name to a comparable form.
 *
 * Recipe names carry prep instructions ("cubed") and recipe-specific asides
 * ("reserve ~400g for wraps"); shopping names carry buying detail ("(lean)").
 * Stripping both lets the two vocabularies meet.
 *
 * Measured against the sample plan, this roughly doubles the rate at which an
 * ingredient finds a category in shopping history — 10/45 raw to 21/45.
 */
export function normaliseItemName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')   // drop parentheticals
    .split(',')[0]                 // prep detail follows the first comma
    .replace(/[^a-z0-9 ]/g, ' ')   // strip punctuation
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}
