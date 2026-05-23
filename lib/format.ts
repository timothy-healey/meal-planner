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
