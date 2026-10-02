import { describe, expect, it } from 'vitest';
import { canJustificarInasistencia } from './inasistencia.utils';

describe('canJustificarInasistencia() — hotfix-128-m', () => {
  it('una inasistencia vigente y sin justificar se puede justificar', () => {
    expect(canJustificarInasistencia({ justificada: false, reagendada: false })).toBe(true);
  });

  it('una ya justificada no ofrece justificar de nuevo', () => {
    expect(canJustificarInasistencia({ justificada: true, reagendada: false })).toBe(false);
  });

  it('una ya reagendada no se puede justificar: quedó archivada y no penaliza', () => {
    expect(canJustificarInasistencia({ justificada: false, reagendada: true })).toBe(false);
  });
});
