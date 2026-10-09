import { Pipe, PipeTransform } from '@angular/core';
import { formatChilePattern } from '@core/utils/chile-time.utils';

/**
 * ChileDatePipe — Fecha u hora con la zona de Chile fija.
 *
 * Reemplaza al pipe `date` de Angular, que formatea con la zona horaria del navegador.
 * Acepta los mismos patrones que se usaban con él (yyyy, MM, MMM, MMMM, dd, d, EEEE, HH,
 * mm, ss y texto entre comillas simples). Una fecha pura ('YYYY-MM-DD') no se desplaza.
 *
 * @example
 * {{ pago.paidAt | chileDate: 'dd/MM/yyyy HH:mm' }}
 * // → "06/10/2026 23:30"
 *
 * Devuelve null si no hay fecha, igual que el pipe `date`: permite `?? '—'`.
 */
@Pipe({
  name: 'chileDate',
  standalone: true,
})
export class ChileDatePipe implements PipeTransform {
  transform(
    value: Date | string | number | null | undefined,
    pattern = 'dd/MM/yyyy',
  ): string | null {
    if (value === null || value === undefined || value === '') return null;
    return formatChilePattern(typeof value === 'number' ? new Date(value) : value, pattern);
  }
}
