// supabase/functions/_shared/ficha-tecnica-pdf.test.ts
//
//   deno test supabase/functions/_shared/ficha-tecnica-pdf.test.ts

import { assert, assertEquals } from 'jsr:@std/assert';
import {
  FICHA_TECNICA_COLUMNS,
  FICHA_TECNICA_PAGE,
  buildFichaTecnicaPdf,
  fechaHoraClase,
  observacionesTexto,
  type ClasePractica,
} from './ficha-tecnica-pdf.ts';

function clase(overrides: Partial<ClasePractica> = {}): ClasePractica {
  return {
    numero: 1,
    fecha: '18-08',
    hora: '16:40',
    instructor: 'Carla Soto',
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
    ...overrides,
  };
}

Deno.test('observacionesTexto: una clase completada sin observaciones queda vacía', () => {
  assertEquals(observacionesTexto(clase({ completada: true })), '');
});

Deno.test('observacionesTexto: una clase que aún no ocurre dice "Pendiente de sesión"', () => {
  assertEquals(observacionesTexto(clase()), 'Pendiente de sesión');
});

Deno.test('observacionesTexto: inasistencia o cancelada sin texto quedan vacías', () => {
  assertEquals(observacionesTexto(clase({ ausente: true })), '');
  assertEquals(observacionesTexto(clase({ cancelada: true })), '');
});

Deno.test('observacionesTexto: las observaciones mandan sobre la justificación', () => {
  const c = clase({ completada: true, observaciones: 'Buen dominio', justificacion: 'Médica' });
  assertEquals(observacionesTexto(c), 'Buen dominio');
  assertEquals(observacionesTexto(clase({ ausente: true, justificacion: 'Médica' })), 'Médica');
});

Deno.test('fechaHoraClase: día-mes con dos dígitos y hora de 24 h, en hora de Chile', () => {
  // 18 de agosto, 16:40 en Santiago (UTC-4 en invierno).
  assertEquals(fechaHoraClase(new Date('2026-08-18T20:40:00Z')), {
    fecha: '18-08',
    hora: '16:40',
  });
  // 3 de septiembre, 08:05: no pierde los ceros.
  assertEquals(fechaHoraClase(new Date('2026-09-03T12:05:00Z')), {
    fecha: '03-09',
    hora: '08:05',
  });
});

Deno.test('fechaHoraClase: una clase de la noche no pasa al día siguiente por UTC', () => {
  // 21:30 del 5 de octubre en Santiago (UTC-3 en verano) = 00:30 UTC del día 6.
  assertEquals(fechaHoraClase(new Date('2026-10-06T00:30:00Z')), {
    fecha: '05-10',
    hora: '21:30',
  });
});

Deno.test('la tabla cabe entre los márgenes de la página', () => {
  const { width, margin } = FICHA_TECNICA_PAGE;
  const tableWidth = FICHA_TECNICA_COLUMNS.reduce((sum, c) => sum + c.width, 0);
  assert(margin + tableWidth <= width - margin, `tabla ${tableWidth} en ${width - margin * 2}`);
});

Deno.test('el PDF no escribe "Pendiente de sesión" en una clase completada', () => {
  const bytes = buildFichaTecnicaPdf([clase({ completada: true }), clase({ numero: 2 })], {
    studentName: 'Ana Pérez',
    matricula: '#0018',
  });
  const pdf = new TextDecoder('latin1').decode(bytes);
  assert(pdf.startsWith('%PDF-'));
  // Solo la clase #2 (que aún no ocurre) lleva el texto.
  assertEquals(pdf.split('Pendiente de sesi').length - 1, 1);
});

Deno.test('el PDF de 30 clases con observaciones largas pagina sin fallar', () => {
  const clases = Array.from({ length: 30 }, (_, i) =>
    clase({
      numero: i + 1,
      completada: true,
      observaciones: 'Maneja con seguridad en ciudad y respeta la distancia. '.repeat(3),
    }),
  );
  const bytes = buildFichaTecnicaPdf(clases, { studentName: 'Ana Pérez', matricula: '#0018' });
  const pdf = new TextDecoder('latin1').decode(bytes);
  assert((pdf.match(/\/Type \/Page\b/g) ?? []).length >= 2, 'debe ocupar más de una página');
});
