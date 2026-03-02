import { Pipe, PipeTransform } from '@angular/core';

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
];

/**
 * RelativeTimePipe — Convierte una fecha en texto relativo.
 *
 * Usa `Intl.RelativeTimeFormat` (nativo del navegador, sin librerías).
 *
 * @example
 * {{ notification.createdAt | relativeTime }}
 * // → "hace 5 minutos", "ayer", "hace 2 semanas"
 *
 * @example con locale
 * {{ date | relativeTime:'en' }}
 * // → "5 minutes ago", "yesterday"
 *
 * Nota: Este pipe es impuro (`pure: false`) para que se actualice
 * cuando Angular ejecuta detección de cambios. Para listas largas,
 * considerar usar un intervalo manual con signals.
 */
@Pipe({
    name: 'relativeTime',
    standalone: true,
    pure: false,
})
export class RelativeTimePipe implements PipeTransform {
    transform(value: Date | string | number | null | undefined, locale = 'es'): string {
        if (!value) return '';

        const date = value instanceof Date ? value : new Date(value);
        const now = Date.now();
        const diff = Math.round((date.getTime() - now) / 1000);

        const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

        for (const [unit, seconds] of UNITS) {
            if (Math.abs(diff) >= seconds || unit === 'second') {
                const rounded = Math.round(diff / seconds);
                return formatter.format(rounded, unit);
            }
        }

        return '';
    }
}
