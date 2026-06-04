// supabase/functions/_shared/anti-abuse.ts
//
// Núcleo Funcional anti-abuso para la Edge Function `public-enrollment` (Spec 0010).
// Funciones PURAS — sin I/O ni globals de Deno — para poder testearlas aisladas
// (`deno test`) sin levantar la función completa. Hallazgos S1/S2/S6.

/** Ventana y umbral por defecto del rate-limit por (ip, action). Decidido en plan.md. */
export const RATE_LIMIT_MAX = 10;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutos

/**
 * Rate-limit por (ip, action). `countInWindow` es el nº de requests dentro de la
 * ventana deslizante INCLUYENDO el actual (se cuenta post-insert). Bloquea cuando
 * supera `max` (el request nº max+1). S1.
 */
export function isRateLimited(countInWindow: number, max: number = RATE_LIMIT_MAX): boolean {
  return countInWindow > max;
}

/**
 * CORS allowlist (S2). Devuelve true solo si `origin` (no nulo, sin espacios)
 * coincide exactamente con una entrada de la allowlist. Las entradas vacías de la
 * allowlist (p.ej. de un CSV con comas sobrantes) se ignoran.
 */
export function isOriginAllowed(origin: string | null | undefined, allowlist: string[]): boolean {
  if (!origin) return false;
  const normalized = origin.trim();
  if (!normalized) return false;
  return allowlist.some((entry) => entry.trim() === normalized);
}

/**
 * Reconciliación de monto (S6). true solo si ambos montos son finitos e iguales.
 * Los montos CLP son enteros; se compara el monto confirmado por Webpay contra el
 * monto esperado calculado server-side (mismo cálculo, incluido `Math.ceil(base/2)`
 * del modo partial).
 */
export function amountsMatch(a: number, b: number): boolean {
  return Number.isFinite(a) && Number.isFinite(b) && a === b;
}

/**
 * Honeypot (S1). Campo oculto que un humano nunca llena. Devuelve true si trae
 * algún valor no vacío (lo llenó un bot) → el request debe rechazarse.
 * Vacío / null / undefined = humano legítimo (false).
 */
export function isHoneypotTripped(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  return String(value).trim() !== '';
}
