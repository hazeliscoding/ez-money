import { Pipe, PipeTransform } from '@angular/core';

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats a number as USD, e.g. 1234.56 -> "$1,234.56". */
@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    const n = value ?? 0;
    return USD.format(n);
  }
}
