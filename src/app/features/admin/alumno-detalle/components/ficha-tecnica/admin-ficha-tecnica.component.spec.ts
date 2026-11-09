import { accionDeClase } from './admin-ficha-tecnica.component';
import type { ClasePracticaUI } from '@core/models/ui/alumno-detalle.model';

// ─── fix-246-b (I08): una clase en curso no se reprograma desde la ficha ─────
// La decisión vive en una función pura: los tests que renderizan templates están excluidos
// en vitest.config.ts (limitación de compilación), así que se prueba la decisión, no el binding.

function clase(over: Partial<ClasePracticaUI> = {}): ClasePracticaUI {
  return {
    numero: 1,
    sessionId: 55,
    fecha: '10/11',
    scheduledDate: '2026-11-10',
    scheduledAt: '2026-11-10T13:30:00.000Z',
    hora: '10:30-11:15',
    instructor: 'Gonzalo Muñoz',
    kmInicio: null,
    kmFin: null,
    observaciones: null,
    completada: false,
    enCurso: false,
    ausente: false,
    cancelada: false,
    justificada: false,
    justificacion: null,
    alumnoFirmo: false,
    instructorFirmo: false,
    ...over,
  };
}

describe('accionDeClase — fix-246-b (I08)', () => {
  it('una clase en curso no ofrece reprogramar: muestra "En curso"', () => {
    expect(accionDeClase(clase({ enCurso: true, kmInicio: 15230 }))).toBe('en-curso');
  });

  it('una clase agendada ofrece el lápiz', () => {
    expect(accionDeClase(clase())).toBe('reprogramar');
  });

  it('una inasistencia o una cancelada siguen ofreciendo el lápiz', () => {
    expect(accionDeClase(clase({ ausente: true }))).toBe('reprogramar');
    expect(accionDeClase(clase({ cancelada: true }))).toBe('reprogramar');
  });

  it('una clase pendiente sin sesión ofrece el lápiz (agendarla)', () => {
    expect(accionDeClase(clase({ sessionId: null, scheduledAt: null }))).toBe('reprogramar');
  });

  it('una clase completada no ofrece nada', () => {
    expect(accionDeClase(clase({ completada: true }))).toBeNull();
  });
});
