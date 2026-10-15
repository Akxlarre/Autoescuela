import { describe, expect, it } from 'vitest';
import {
  ALERT_SNOOZE_MS,
  filterSnoozedAlerts,
  parseSnoozes,
  pruneSnoozes,
  snoozeAlert,
  snoozeKey,
} from './alert-snooze.utils';

const NOW = new Date('2026-10-13T15:00:00.000Z').getTime();
const HORA = 60 * 60 * 1000;

const alerta = (id: string, count?: number) => ({ id, count });

describe('alert-snooze.utils (fix-415-m)', () => {
  it('una alerta descartada queda oculta para ese usuario', () => {
    const snoozes = snoozeAlert({}, 'uid-1', alerta('alert-docs-expired', 1), NOW);

    const visibles = filterSnoozedAlerts(
      [alerta('alert-docs-expired', 1), alerta('alert-pending-payments', 5)],
      snoozes,
      'uid-1',
      NOW + HORA,
    );

    expect(visibles.map((a) => a.id)).toEqual(['alert-pending-payments']);
  });

  it('vuelve a mostrarse si ahora tiene más casos que al descartarla', () => {
    const snoozes = snoozeAlert({}, 'uid-1', alerta('alert-docs-expired', 1), NOW);

    const visibles = filterSnoozedAlerts(
      [alerta('alert-docs-expired', 2)],
      snoozes,
      'uid-1',
      NOW + HORA,
    );

    expect(visibles).toHaveLength(1);
  });

  it('sigue oculta con los mismos casos o con menos', () => {
    const snoozes = snoozeAlert({}, 'uid-1', alerta('alert-docs-expired', 3), NOW);

    for (const count of [3, 2]) {
      expect(
        filterSnoozedAlerts([alerta('alert-docs-expired', count)], snoozes, 'uid-1', NOW + HORA),
      ).toEqual([]);
    }
  });

  it('una alerta sin conteo (p. ej. "Caja sin cerrar") queda oculta hasta que venza el descarte', () => {
    const snoozes = snoozeAlert({}, 'uid-1', alerta('alert-cash-not-closed'), NOW);

    expect(
      filterSnoozedAlerts([alerta('alert-cash-not-closed')], snoozes, 'uid-1', NOW + HORA),
    ).toEqual([]);
  });

  it('otro usuario en el mismo navegador sigue viéndola', () => {
    const snoozes = snoozeAlert({}, 'uid-1', alerta('alert-docs-expired', 1), NOW);

    expect(
      filterSnoozedAlerts([alerta('alert-docs-expired', 1)], snoozes, 'uid-2', NOW + HORA),
    ).toHaveLength(1);
  });

  it('pasadas 24 horas vuelve a mostrarse y el registro se limpia', () => {
    const snoozes = snoozeAlert({}, 'uid-1', alerta('alert-docs-expired', 1), NOW);
    const despues = NOW + ALERT_SNOOZE_MS + 1;

    expect(
      filterSnoozedAlerts([alerta('alert-docs-expired', 1)], snoozes, 'uid-1', despues),
    ).toHaveLength(1);
    expect(pruneSnoozes(snoozes, despues)).toEqual({});
    expect(pruneSnoozes(snoozes, NOW + HORA)).toEqual(snoozes);
  });

  it('snoozeKey separa por usuario; sin usuario usa una clave propia', () => {
    expect(snoozeKey('uid-1', 'a')).not.toBe(snoozeKey('uid-2', 'a'));
    expect(snoozeKey(null, 'a')).not.toBe(snoozeKey('uid-1', 'a'));
  });

  describe('parseSnoozes', () => {
    it('lee lo guardado con el formato actual', () => {
      const snoozes = snoozeAlert({}, 'uid-1', alerta('a', 2), NOW);

      expect(parseSnoozes(JSON.stringify(snoozes))).toEqual(snoozes);
    });

    it('ignora el formato anterior (id → hora), texto roto y vacío', () => {
      expect(parseSnoozes('{"alert-docs-expired":1791944541806}')).toEqual({});
      expect(parseSnoozes('{no es json')).toEqual({});
      expect(parseSnoozes(null)).toEqual({});
    });
  });
});
