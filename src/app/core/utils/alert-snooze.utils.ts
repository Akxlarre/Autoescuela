/**
 * Descarte temporal de alertas del dashboard ("Descartar", fix-415-m).
 *
 * Funciones puras: quién las usa decide dónde se guarda el mapa (hoy, `localStorage`).
 *
 * Un descarte recuerda QUIÉN descartó y CUÁNTOS casos tenía la alerta. Hasta fix-415-m solo se
 * guardaba el id fijo de la alerta: descartar "1 documento vencido" escondía también el segundo
 * documento que venciera ese día, y se lo escondía a cualquier otra persona en ese navegador.
 */

/** Cuánto dura un descarte. */
export const ALERT_SNOOZE_MS = 24 * 60 * 60 * 1000;

export interface AlertSnooze {
  /** Momento del descarte (epoch ms). */
  at: number;
  /** Casos que tenía la alerta al descartarla (0 si la alerta no lleva conteo). */
  count: number;
}

/** Descartes guardados, por `snoozeKey(usuario, alerta)`. */
export type AlertSnoozeMap = Record<string, AlertSnooze>;

/** Lo mínimo que se necesita de una alerta para decidir si está descartada. */
export interface SnoozableAlert {
  id: string;
  count?: number;
}

export function snoozeKey(userId: string | null, alertId: string): string {
  return `${userId ?? 'anon'}::${alertId}`;
}

/** Devuelve el mapa con la alerta descartada por ese usuario. No muta el original. */
export function snoozeAlert(
  snoozes: AlertSnoozeMap,
  userId: string | null,
  alert: SnoozableAlert,
  now: number,
): AlertSnoozeMap {
  return { ...snoozes, [snoozeKey(userId, alert.id)]: { at: now, count: alert.count ?? 0 } };
}

/** Quita los descartes vencidos. */
export function pruneSnoozes(snoozes: AlertSnoozeMap, now: number): AlertSnoozeMap {
  return Object.fromEntries(
    Object.entries(snoozes).filter(([, snooze]) => now - snooze.at <= ALERT_SNOOZE_MS),
  );
}

/**
 * Alertas que ese usuario debe ver: fuera las que descartó hace menos de 24 h, salvo que ahora
 * tengan más casos que cuando las descartó.
 */
export function filterSnoozedAlerts<T extends SnoozableAlert>(
  alerts: T[],
  snoozes: AlertSnoozeMap,
  userId: string | null,
  now: number,
): T[] {
  return alerts.filter((alert) => {
    const snooze = snoozes[snoozeKey(userId, alert.id)];
    if (!snooze || now - snooze.at > ALERT_SNOOZE_MS) return true;
    return (alert.count ?? 0) > snooze.count;
  });
}

/** Lee el mapa guardado. Lo que no tenga el formato actual se descarta. */
export function parseSnoozes(raw: string | null): AlertSnoozeMap {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, AlertSnooze] => {
          const value = entry[1] as Partial<AlertSnooze> | null;
          return (
            !!value &&
            typeof value === 'object' &&
            typeof value.at === 'number' &&
            typeof value.count === 'number'
          );
        },
      ),
    );
  } catch {
    return {};
  }
}
