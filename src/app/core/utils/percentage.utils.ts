/**
 * Reparte un conjunto de valores en porcentajes enteros que siempre suman
 * exactamente 100 (cuando el total de entrada es > 0), usando el método del
 * mayor remanente (largest remainder / método de Hamilton). Redondear cada
 * porcentaje de forma independiente puede hacer que la suma no dé 100 exacto
 * (ej. 87.5% y 12.5% redondean ambos hacia arriba a 88% y 13% = 101%).
 */
export function roundPercentagesTo100(values: number[]): number[] {
  const total = values.reduce((acc, v) => acc + v, 0);
  if (total <= 0) return values.map(() => 0);

  const raw = values.map((v) => (v / total) * 100);
  const floors = raw.map((r) => Math.floor(r));
  const remainder = 100 - floors.reduce((acc, f) => acc + f, 0);

  const order = raw
    .map((r, i) => ({ index: i, fraction: r - floors[i] }))
    .sort((a, b) => b.fraction - a.fraction);

  const result = [...floors];
  for (let k = 0; k < remainder; k++) {
    result[order[k].index] += 1;
  }
  return result;
}
