/**
 * Convierte un array de valores normalizados (0-1) en una cadena de puntos
 * SVG para el elemento <polyline points="...">
 *
 * @param data   Valores entre 0 y 1 (6-8 puntos típicos)
 * @param w      Ancho del viewport SVG (default 40)
 * @param h      Alto del viewport SVG (default 20)
 * @returns      Cadena "x1,y1 x2,y2 ..." o "" si hay menos de 2 puntos
 */
export function getSparklinePoints(data: number[], w = 40, h = 20): string {
  if (data.length < 2) return '';
  return data
    .map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${((1 - v) * h).toFixed(1)}`)
    .join(' ');
}
