/**
 * Geometría pura del gráfico de líneas comparativo (`app-line-comparison-chart`, spec 0044-b).
 * Sin Angular ni DOM: todo se testea con Vitest directo.
 */

/** Tope del eje Y redondeado a un valor "limpio" (1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10 × 10^n). */
export function niceMax(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 1;
  const exp = Math.floor(Math.log10(max));
  const base = 10 ** exp;
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const step = steps.find((s) => s * base >= max) ?? 10;
  return step * base;
}

/** Valores del eje Y de 0 a `max` en `count` tramos iguales. */
export function yTicks(max: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, i) => (max / count) * i);
}

/** Coordenada Y en SVG (0 arriba) para un valor, con `max` en la parte superior. */
export function pointY(value: number, max: number, height: number): number {
  if (max <= 0) return height;
  return height - (value / max) * height;
}

/** Centro X de la columna `index` de `count` columnas equiespaciadas en `width`. */
export function pointX(index: number, count: number, width: number): number {
  return (width / count) * (index + 0.5);
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/**
 * Path SVG de una serie. Un `null` corta la línea: el siguiente punto arranca con `M`
 * (así la serie del año en curso termina en el mes actual en vez de caer a 0).
 */
export function buildLinePath(
  values: (number | null)[],
  max: number,
  width: number,
  height: number,
): string {
  const parts: string[] = [];
  let penDown = false;
  values.forEach((v, i) => {
    if (v === null) {
      penDown = false;
      return;
    }
    const cmd = penDown ? 'L' : 'M';
    parts.push(`${cmd}${fmt(pointX(i, values.length, width))},${fmt(pointY(v, max, height))}`);
    penDown = true;
  });
  return parts.join(' ');
}

/** `6_995_000` → `7M`; `1_250_000` → `1,3M`; `340_000` → `340K`. */
export function formatCompactNumber(n: number, prefix = ''): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const one = (x: number) =>
    x.toLocaleString('es-CL', { maximumFractionDigits: 1, minimumFractionDigits: 0 });
  if (abs >= 1_000_000) return `${sign}${prefix}${one(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}${prefix}${Math.round(abs / 1_000)}K`;
  return `${sign}${prefix}${Math.round(abs)}`;
}
