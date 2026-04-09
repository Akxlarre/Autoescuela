import { Pipe, PipeTransform } from '@angular/core';

/**
 * Convierte montos grandes en formato abreviado (K, M) con prefijo de moneda.
 * Diseñado específicamente para métricas (KPIs) en Dashboards.
 * 
 * Reglas para CLP:
 * - < 10,000 -> Devuelve el monto íntegro (ej: $5.000)
 * - >= 10,000 y < 1M -> Devuelve en miles con 1 decimal máximo (ej: $12,5K, $450K)
 * - >= 1M -> Devuelve en millones con 1 decimal máximo (ej: $1,2M, $15M)
 * 
 * @example
 * {{ 1450000 | shortCurrency }} -> $1,4M
 * {{ 850000 | shortCurrency }} -> $850K
 */
@Pipe({
  name: 'shortCurrency',
  standalone: true
})
export class ShortCurrencyPipe implements PipeTransform {
  transform(value: number | null | undefined, symbol: string = '$'): string {
    if (value == null) return '';
    if (value < 0) return '-' + this.transform(Math.abs(value), symbol);
    
    if (value >= 1000000) {
      const formatted = (value / 1000000).toLocaleString('es-CL', { maximumFractionDigits: 1 });
      return `${symbol}${formatted}M`;
    }
    
    if (value >= 10000) {
      const formatted = (value / 1000).toLocaleString('es-CL', { maximumFractionDigits: 1 });
      return `${symbol}${formatted}K`;
    }
    
    return `${symbol}${value.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`;
  }
}
