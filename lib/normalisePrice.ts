import type { QtyUnit } from '../types/db';

/** Returns price per 100g/mL in dollars, or total price for unit items. */
export function normalisePrice(
  price: number,
  qtyAmount: number,
  qtyUnit: QtyUnit,
): number {
  switch (qtyUnit) {
    case 'g':
    case 'mL':
      return (price / qtyAmount) * 100;
    case 'kg':
    case 'L':
      return (price / (qtyAmount * 1000)) * 100;
    case 'units':
      return price;
  }
}
