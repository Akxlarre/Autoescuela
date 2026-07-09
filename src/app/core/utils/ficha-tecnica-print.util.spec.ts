import { describe, it, expect } from 'vitest';
import { buildFichaTecnicaPrintHtml } from './ficha-tecnica-print.util';
import type { ClasePracticaUI } from '@core/models/ui/alumno-detalle.model';

function makeClase(over: Partial<ClasePracticaUI> = {}): ClasePracticaUI {
  return {
    numero: 1,
    sessionId: 1,
    fecha: '09-07',
    scheduledDate: '2026-07-09',
    scheduledAt: '2026-07-09T11:00:00',
    hora: '11:00-11:45',
    instructor: 'Roberto Andrés Soto',
    kmInicio: null,
    kmFin: null,
    observaciones: null,
    completada: false,
    ausente: false,
    cancelada: false,
    justificada: false,
    justificacion: null,
    alumnoFirmo: false,
    instructorFirmo: false,
    ...over,
  };
}

describe('buildFichaTecnicaPrintHtml', () => {
  it('genera un documento HTML autocontenido con el título del informe', () => {
    const html = buildFichaTecnicaPrintHtml([]);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Ficha Técnica');
  });

  it('renderiza una fila por clase con N°, instructor y kilometraje', () => {
    const clase = makeClase({
      numero: 3,
      instructor: 'Gran Instructor Torres',
      kmInicio: 1000,
      kmFin: 1045,
      completada: true,
    });
    const html = buildFichaTecnicaPrintHtml([clase]);
    expect(html).toContain('#3');
    expect(html).toContain('Gran Instructor Torres');
    expect(html).toContain('1.000 km');
    expect(html).toContain('1.045 km');
  });

  it('muestra el badge de clase cancelada', () => {
    const clase = makeClase({ numero: 4, cancelada: true });
    const html = buildFichaTecnicaPrintHtml([clase]);
    expect(html).toContain('Cancelada — pendiente reagendar');
    expect(html).toContain('badge-warning');
  });

  it('muestra el badge de inasistencia justificada', () => {
    const clase = makeClase({ numero: 2, ausente: true, justificada: true });
    const html = buildFichaTecnicaPrintHtml([clase]);
    expect(html).toContain('Inasistencia justificada');
    expect(html).toContain('badge-ok');
  });

  it('no rompe con lista vacía de clases', () => {
    const html = buildFichaTecnicaPrintHtml([]);
    expect(html).toContain('<tbody>');
    expect(html).not.toContain('undefined');
  });

  it('incluye nombre y matrícula del alumno cuando se proporcionan', () => {
    const html = buildFichaTecnicaPrintHtml([], {
      studentName: 'Erling Haaland Braut',
      matricula: '#0015',
    });
    expect(html).toContain('Erling Haaland Braut');
    expect(html).toContain('#0015');
  });

  it('deja líneas en blanco cuando faltan los datos del alumno', () => {
    const html = buildFichaTecnicaPrintHtml([]);
    expect(html).toContain('class="blank"');
  });

  it('escapa caracteres HTML para evitar inyección', () => {
    const html = buildFichaTecnicaPrintHtml([], {
      studentName: '<script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
