import { Pipe, PipeTransform } from '@angular/core';

// Module-level formatter: constructing an Intl.NumberFormat is relatively
// expensive, so reuse one instance across every transform call.
const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats a number as USD, e.g. 1234.56 -> "$1,234.56". Pure pipe (default),
 * so it only re-runs when its input reference changes — fine here since amounts
 * are primitive numbers.
 */
@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
  /** Null/undefined are treated as 0 so templates never render "$NaN". */
  transform(value: number | null | undefined): string {
    const n = value ?? 0;
    return USD.format(n);
  }
}
