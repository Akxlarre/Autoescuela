import { describe, expect, it } from 'vitest';
import { pickFichaEnrollment } from './ficha-enrollment.utils';

const row = (id: number, status: string | null, created_at: string) => ({ id, status, created_at });

describe('pickFichaEnrollment — fix-265-m', () => {
  it('sin matrículas → null', () => {
    expect(pickFichaEnrollment([])).toBeNull();
  });

  it('elige la más reciente por created_at, sin depender del orden de entrada', () => {
    const picked = pickFichaEnrollment([
      row(1, 'completed', '2025-01-10T12:00:00Z'),
      row(2, 'active', '2026-03-01T12:00:00Z'),
      row(3, 'completed', '2024-06-01T12:00:00Z'),
    ]);
    expect(picked?.id).toBe(2);
  });

  it('un borrador más reciente no reemplaza a la matrícula activa (B15)', () => {
    const picked = pickFichaEnrollment([
      row(10, 'draft', '2026-09-30T12:00:00Z'),
      row(11, 'active', '2026-09-01T12:00:00Z'),
    ]);
    expect(picked?.id).toBe(11);
  });

  it('una matrícula cancelada o con pago online pendiente más reciente tampoco la reemplaza', () => {
    expect(
      pickFichaEnrollment([
        row(20, 'cancelled', '2026-09-30T12:00:00Z'),
        row(21, 'pending_payment', '2026-09-29T12:00:00Z'),
        row(22, 'completed', '2026-01-01T12:00:00Z'),
      ])?.id,
    ).toBe(22);
  });

  it('si solo hay canceladas o con pago pendiente, muestra la más reciente de ellas', () => {
    expect(
      pickFichaEnrollment([
        row(30, 'cancelled', '2026-01-01T12:00:00Z'),
        row(31, 'pending_payment', '2026-05-01T12:00:00Z'),
      ])?.id,
    ).toBe(31);
  });

  it('si solo hay borradores → null: un borrador nunca es la matrícula mostrada', () => {
    expect(pickFichaEnrollment([row(40, 'draft', '2026-05-01T12:00:00Z')])).toBeNull();
  });

  it('respeta la matrícula elegida aunque no sea la más reciente (B21)', () => {
    const picked = pickFichaEnrollment(
      [row(50, 'active', '2026-09-01T12:00:00Z'), row(51, 'completed', '2025-01-01T12:00:00Z')],
      51,
    );
    expect(picked?.id).toBe(51);
  });

  it('respeta una elegida cancelada: el selector la ofrece, así que se puede mirar', () => {
    const picked = pickFichaEnrollment(
      [row(60, 'active', '2026-09-01T12:00:00Z'), row(61, 'cancelled', '2025-01-01T12:00:00Z')],
      61,
    );
    expect(picked?.id).toBe(61);
  });

  it('si la elegida ya no existe o es un borrador, vuelve a la regla por defecto', () => {
    const enrollments = [
      row(70, 'draft', '2026-09-30T12:00:00Z'),
      row(71, 'active', '2026-09-01T12:00:00Z'),
    ];
    expect(pickFichaEnrollment(enrollments, 999)?.id).toBe(71);
    expect(pickFichaEnrollment(enrollments, 70)?.id).toBe(71);
  });

  it('trata un status nulo como matrícula válida (datos legacy)', () => {
    expect(pickFichaEnrollment([row(80, null, '2026-01-01T12:00:00Z')])?.id).toBe(80);
  });
});
