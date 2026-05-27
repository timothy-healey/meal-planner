const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function formatCookTime(prep_minutes: number, cook_minutes: number): string {
  if (cook_minutes >= 60) {
    return `${Math.round((prep_minutes + cook_minutes) / 60)}h`;
  }
  return `${prep_minutes + cook_minutes} min`;
}

export function formatWeekOf(isoDate: string): string {
  const [, month, day] = isoDate.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

export function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function formatItemCount(checked: number, total: number): string {
  return `✓ ${checked} / ${total}`;
}

export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const ms = now - Date.parse(iso);
  const days = Math.max(0, Math.floor(ms / 86_400_000));
  if (days < 1)   return 'today';
  if (days < 7)   return `${days}d ago`;
  if (days < 14)  return 'last week';
  if (days < 30)  return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
