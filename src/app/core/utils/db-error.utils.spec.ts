import { toFriendlyDbMessage } from './db-error.utils';

/**
 * fix-015 AC2 — Sanitización de errores de BD.
 * Ningún mensaje devuelto puede contener texto crudo de PostgreSQL
 * (nombres de columnas, constraints, códigos).
 */
describe('toFriendlyDbMessage', () => {
  const FALLBACK = 'Error al inscribir al alumno';

  it('devuelve el fallback para errores desconocidos', () => {
    expect(toFriendlyDbMessage(new Error('boom'), FALLBACK)).toBe(FALLBACK);
    expect(toFriendlyDbMessage(null, FALLBACK)).toBe(FALLBACK);
    expect(toFriendlyDbMessage('texto suelto', FALLBACK)).toBe(FALLBACK);
    expect(toFriendlyDbMessage(undefined, FALLBACK)).toBe(FALLBACK);
  });

  it('NUNCA filtra el mensaje crudo de PostgreSQL al resultado', () => {
    const rawPgError = {
      code: '23502',
      message:
        'null value in column "birth_date" of relation "students" violates not-null constraint',
    };
    const result = toFriendlyDbMessage(rawPgError, FALLBACK);
    expect(result).not.toContain('birth_date');
    expect(result).not.toContain('students');
    expect(result).not.toContain('constraint');
    expect(result).not.toContain('23502');
  });

  it('mapea not_null_violation (23502) a mensaje de datos faltantes', () => {
    const result = toFriendlyDbMessage({ code: '23502', message: 'x' }, FALLBACK);
    expect(result).toContain('datos obligatorios');
  });

  it('mapea check_violation (23514) a mensaje de edad mínima', () => {
    const result = toFriendlyDbMessage({ code: '23514', message: 'x' }, FALLBACK);
    expect(result).toContain('17 años');
  });

  it('mapea unique_violation (23505) a mensaje de duplicado', () => {
    const result = toFriendlyDbMessage({ code: '23505', message: 'x' }, FALLBACK);
    expect(result).toContain('Ya existe');
  });

  it('mapea error de permisos RLS (42501)', () => {
    const result = toFriendlyDbMessage({ code: '42501', message: 'x' }, FALLBACK);
    expect(result).toContain('permisos');
  });

  it('errores Postgrest con código no mapeado caen al fallback', () => {
    expect(toFriendlyDbMessage({ code: '99999', message: 'raro' }, FALLBACK)).toBe(FALLBACK);
  });

  it('fix-016: token CUPOS_AGOTADOS del trigger se traduce sin exponer detalles', () => {
    const result = toFriendlyDbMessage({ code: 'P0001', message: 'CUPOS_AGOTADOS' }, FALLBACK);
    expect(result).toContain('cupos');
    expect(result).not.toContain('CUPOS_AGOTADOS');
  });
});
