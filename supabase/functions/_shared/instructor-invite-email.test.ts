// supabase/functions/_shared/instructor-invite-email.test.ts
//
// Correo de activación de la cuenta de un instructor (spec 0061-b, AC3/AC4).
//
//   deno test supabase/functions/_shared/instructor-invite-email.test.ts

import { assert, assertStringIncludes } from 'jsr:@std/assert';
import { resolveSender } from './school-email.ts';
import { buildInstructorInviteEmailHtml } from './instructor-invite-email.ts';
import { CONTRACT_EMAIL_THEMES } from './contract-email.ts';

const AUTOESCUELA = resolveSender(
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

Deno.test(
  'AC4: encabezado y pie con la escuela del instructor, no "Conductores Chillán" fijo',
  () => {
    const html = buildInstructorInviteEmailHtml('Juan Soto', 'https://x.test/v?t=1', AUTOESCUELA);
    assertStringIncludes(html, 'Autoescuela Chillán');
    assertStringIncludes(html, '<span>AC</span>');
    assert(!html.includes('Conductores Chillán'));
    assertStringIncludes(html, 'Enviado por Autoescuela Chillán mediante Gestor de Autoescuelas');
  },
);

Deno.test('AC8: incluye la línea que explica el dominio', () => {
  const html = buildInstructorInviteEmailHtml('Juan Soto', 'https://x.test', AUTOESCUELA);
  assertStringIncludes(html, 'app.gestordeautoescuelas.cl');
});

Deno.test('escapa el nombre y el enlace', () => {
  const html = buildInstructorInviteEmailHtml(
    '<b>Juan</b>',
    'https://x.test/?a=1&b=2',
    AUTOESCUELA,
  );
  assert(!html.includes('<b>Juan</b>'));
  assertStringIncludes(html, 'https://x.test/?a=1&amp;b=2');
});

Deno.test(
  '0061-b: colores de la escuela del instructor y línea del dominio para el personal',
  () => {
    const html = buildInstructorInviteEmailHtml(
      'Juan Soto',
      'https://x.test',
      AUTOESCUELA,
      CONTRACT_EMAIL_THEMES.roja,
    );
    assertStringIncludes(html, CONTRACT_EMAIL_THEMES.roja.gradientHero);
    assert(!html.includes(CONTRACT_EMAIL_THEMES.azul.gradientHero));
    assert(!html.includes('portal de alumnos'));
  },
);
