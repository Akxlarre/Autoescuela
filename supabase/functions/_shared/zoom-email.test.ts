// supabase/functions/_shared/zoom-email.test.ts
//
// Tests del núcleo de `send-zoom-email` (fix-367-m). Puro, sin I/O.
//
//   npx deno test supabase/functions/_shared/zoom-email.test.ts

import { assertEquals } from 'jsr:@std/assert';
import {
  buildZoomEmailContent,
  escapeHtml,
  isSafeZoomLink,
  parseEnrollmentIds,
  selectZoomRecipients,
  type ZoomEnrollmentRow,
} from './zoom-email.ts';

const session = {
  id: 11,
  cycle_id: 5,
  class_number: 1,
  class_date: '2026-03-09',
  topic: 'Reglamento',
  zoom_link: 'https://zoom.us/j/1',
};

function enrollment(
  id: number,
  over: Partial<ZoomEnrollmentRow> = {},
  email = `a${id}@x.cl`,
): ZoomEnrollmentRow {
  return {
    id,
    theory_cycle_id: 5,
    status: 'active',
    students: { users: { first_names: 'Juan', paternal_last_name: 'Pérez', email } },
    ...over,
  };
}

Deno.test('escapeHtml neutraliza etiquetas y comillas de atributo', () => {
  assertEquals(
    escapeHtml(`<a href="x" onclick='y'>&</a>`),
    '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
  );
});

Deno.test('isSafeZoomLink: solo https', () => {
  assertEquals(isSafeZoomLink('https://zoom.us/j/1'), true);
  assertEquals(isSafeZoomLink('  https://zoom.us/j/1  '), true);
  assertEquals(isSafeZoomLink('http://zoom.us/j/1'), false);
  assertEquals(isSafeZoomLink('javascript:alert(1)'), false);
  assertEquals(isSafeZoomLink('hola'), false);
  assertEquals(isSafeZoomLink(''), false);
  assertEquals(isSafeZoomLink(null), false);
});

Deno.test('buildZoomEmailContent arma asunto con tema y fecha larga en Chile', () => {
  const c = buildZoomEmailContent(session)!;
  assertEquals(c.topic, 'Clase 1 — Reglamento');
  assertEquals(c.subject, 'Enlace Zoom · Clase 1 — Reglamento');
  assertEquals(c.date, 'lunes, 9 de marzo');
  assertEquals(c.zoomLink, 'https://zoom.us/j/1');
});

Deno.test('buildZoomEmailContent sin tema usa "Clase Teórica N"', () => {
  assertEquals(buildZoomEmailContent({ ...session, topic: '  ' })!.topic, 'Clase Teórica 1');
});

Deno.test('buildZoomEmailContent con enlace inseguro → null', () => {
  assertEquals(buildZoomEmailContent({ ...session, zoom_link: 'javascript:alert(1)' }), null);
  assertEquals(buildZoomEmailContent({ ...session, zoom_link: null }), null);
});

Deno.test(
  'selectZoomRecipients: solo pedidas, del ciclo, activas, con correo, sin duplicados',
  () => {
    const rows = [
      enrollment(1),
      enrollment(2, { theory_cycle_id: 6 }), // otro ciclo
      enrollment(3, { status: 'withdrawn' }), // no activa
      enrollment(4, {}, ''), // sin correo
      enrollment(5, {}, 'A1@x.cl'), // mismo correo que la 1
      enrollment(6), // no pedida
    ];
    assertEquals(selectZoomRecipients(rows, 5, [1, 2, 3, 4, 5]), [
      { name: 'Juan Pérez', email: 'a1@x.cl' },
    ]);
  },
);

Deno.test('selectZoomRecipients: sesión sin ciclo → nadie', () => {
  assertEquals(selectZoomRecipients([enrollment(1)], null, [1]), []);
});

Deno.test('parseEnrollmentIds valida y deduplica', () => {
  assertEquals(parseEnrollmentIds([3, 3, 4]), [3, 4]);
  assertEquals(parseEnrollmentIds([]), null);
  assertEquals(parseEnrollmentIds('1'), null);
  assertEquals(parseEnrollmentIds([1, 'x']), null);
  assertEquals(parseEnrollmentIds([0]), null);
  assertEquals(parseEnrollmentIds([1.5]), null);
  assertEquals(parseEnrollmentIds([1, 2, 3], 2), null);
});
