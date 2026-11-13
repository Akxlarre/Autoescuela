// supabase/functions/_shared/student-invite-email.test.ts
//
// Correo de activación del alumno (spec 0061-b, AC6).
//
//   deno test supabase/functions/_shared/student-invite-email.test.ts

import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { resolveSender } from './school-email.ts';
import {
  STUDENT_INVITE_THEMES,
  buildStudentInviteEmailHtml,
  resolveStudentInviteBrand,
  schoolInitials,
} from './student-invite-email.ts';

const SENDER = resolveSender(
  {
    id: 1,
    name: 'Autoescuela Chillán',
    email_sender_name: 'Autoescuela Chillán',
    email_sender_address: 'autoescuela-chillan@gestordeautoescuelas.cl',
    email: 'otecchillan@gmail.com',
    phone: '+56 42 232 7800',
  },
  'cuentas@gestordeautoescuelas.cl',
);

Deno.test('resolveStudentInviteBrand: tema, nombre e iniciales desde website_config', () => {
  const brand = resolveStudentInviteBrand({
    brand: { theme: 'roja', name: 'Conductores Chillán' },
  });
  assertEquals(brand.colors, STUDENT_INVITE_THEMES.roja);
  assertEquals(brand.schoolName, 'Conductores Chillán');
  assertEquals(brand.initials, 'CC');
});

Deno.test('resolveStudentInviteBrand: sin config → azul y nombre genérico', () => {
  const brand = resolveStudentInviteBrand(null);
  assertEquals(brand.colors, STUDENT_INVITE_THEMES.azul);
  assertEquals(brand.schoolName, 'Autoescuela');
});

Deno.test('schoolInitials ignora palabras cortas', () => {
  assertEquals(schoolInitials('Escuela de Conductores Chillán'), 'EC');
});

Deno.test('AC6: el correo lleva el enlace, el pie de la escuela y la línea del dominio', () => {
  const html = buildStudentInviteEmailHtml(
    'https://x.supabase.co/auth/v1/verify?token=t&type=invite',
    STUDENT_INVITE_THEMES.azul,
    'Autoescuela Chillán',
    'AC',
    SENDER,
  );
  assertStringIncludes(html, 'https://x.supabase.co/auth/v1/verify?token=t&amp;type=invite');
  assertStringIncludes(html, 'Enviado por Autoescuela Chillán mediante Gestor de Autoescuelas');
  assertStringIncludes(html, 'otecchillan@gmail.com');
  assertStringIncludes(html, 'El portal de alumnos de Autoescuela Chillán funciona en');
  assert(!html.includes('© 2026 '), 'sin año fijo en el código');
});

Deno.test('el nombre de la marca se escapa', () => {
  const html = buildStudentInviteEmailHtml(
    'https://x.test',
    STUDENT_INVITE_THEMES.azul,
    '<b>X</b>',
    'X',
    SENDER,
  );
  assert(!html.includes('<b>X</b>'));
});

Deno.test(
  '0061-b AC13: el nombre de la escuela configurado por el admin manda sobre el de la web',
  () => {
    const brand = resolveStudentInviteBrand(
      { brand: { theme: 'roja', name: 'AutoEscuela Chillán' } },
      'Autoescuela Chillán',
    );
    assertEquals(brand.schoolName, 'Autoescuela Chillán');
    assertEquals(brand.colors, STUDENT_INVITE_THEMES.roja);
    // Sin nombre de escuela (vacío), el de la web.
    assertEquals(
      resolveStudentInviteBrand({ brand: { name: 'Conductores Chillán' } }, '').schoolName,
      'Conductores Chillán',
    );
  },
);
