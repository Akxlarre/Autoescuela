import { describe, expect, it } from 'vitest';
import { buildMarcarExAlumnoMessage } from './egreso-confirmation.utils';

describe('buildMarcarExAlumnoMessage() — hotfix-125-m', () => {
  const BASE =
    'Ana Pérez pasará a la lista de Ex-Alumnos y dejará de aparecer en Alumnos. Esta acción no se puede deshacer desde la interfaz.';

  it('sin deuda: solo el texto de siempre', () => {
    expect(buildMarcarExAlumnoMessage('Ana Pérez', 0)).toBe(BASE);
  });

  it('con deuda: advierte el monto antes del texto de siempre', () => {
    const message = buildMarcarExAlumnoMessage('Ana Pérez', 90000);

    expect(message).toContain('<strong>Tiene un saldo pendiente de $90.000.</strong>');
    expect(message).toContain('Seguirá figurando con deuda en Ex-Alumnos.');
    expect(message.endsWith(BASE)).toBe(true);
  });

  it('un saldo negativo o nulo no se trata como deuda', () => {
    expect(buildMarcarExAlumnoMessage('Ana Pérez', -500)).toBe(BASE);
  });
});
