interface OutgoingRow {
  is_checked: 0 | 1 | number;
  item_key: string | null;
}

/**
 * Describe what a plan switch would strand, or null if nothing would be.
 *
 * Building a new plan deactivates the current one, and its shopping rows stay
 * in the database with no UI to reach them. Two kinds of work are worth
 * warning about: items already checked off in the aisle, and hand-added rows,
 * which no recipe can recreate.
 */
export function describeOutgoingWork(rows: OutgoingRow[]): string | null {
  const checked = rows.filter((r) => r.is_checked === 1).length;
  const manual = rows.filter((r) => r.item_key === null).length;
  if (checked === 0 && manual === 0) return null;

  const parts: string[] = [];
  if (checked > 0) {
    parts.push(`${checked} item${checked === 1 ? ' is' : 's are'} checked off`);
  }
  if (manual > 0) {
    parts.push(`${manual} ${checked > 0 ? '' : `item${manual === 1 ? ' ' : 's '}`}${manual === 1 ? 'was' : 'were'} added by hand`);
  }

  // "They" once more than one thing is at stake, even if each tally is 1.
  const plural = checked + manual > 1;
  return `${parts.join(' and ')}. ${plural ? 'They' : 'It'} will be left behind with the old plan.`;
}
