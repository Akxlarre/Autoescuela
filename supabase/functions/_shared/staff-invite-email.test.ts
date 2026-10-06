// supabase/functions/_shared/staff-invite-email.test.ts
//
// Tests del correo de activación de cuentas de personal (fix-182-b). Función pura.
//   deno test supabase/functions/_shared/staff-invite-email.test.ts

import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { buildStaffInviteEmail } from './staff-invite-email.ts';

const LINK = 'https://example.supabase.co/auth/v1/verify?token=abc&type=invite&redirect_to=x';

Deno.test('secretaria: asunto, nombre, rol y link de activación', () => {
  const { subject, html } = buildStaffInviteEmail({
    name: 'Ana Pérez',
    roleLabel: 'secretaria',
    actionLink: LINK,
  });

  assertEquals(subject, 'Activa tu cuenta de secretaria');
  assertStringIncludes(html, 'Ana Pérez');
  assertStringIncludes(html, 'Cuenta de secretaria');
  assertStringIncludes(
    html,
    'href="https://example.supabase.co/auth/v1/verify?token=abc&amp;type=invite',
  );
});

Deno.test('no menciona el RUT ni una contraseña temporal', () => {
  const { html } = buildStaffInviteEmail({
    name: 'Ana',
    roleLabel: 'secretaria',
    actionLink: LINK,
  });
  assert(!/RUT|contraseña temporal|contraseña inicial/i.test(html));
  assertStringIncludes(html, 'crear tu contraseña');
});

Deno.test('escapa el nombre: no se puede inyectar HTML en el correo', () => {
  const { html } = buildStaffInviteEmail({
    name: '<img src=x onerror=alert(1)>',
    roleLabel: 'secretaria',
    actionLink: LINK,
  });
  assert(!html.includes('<img src=x'));
  assertStringIncludes(html, '&lt;img src=x onerror=alert(1)&gt;');
});

Deno.test('rechaza links que no son https', () => {
  let threw = false;
  try {
    buildStaffInviteEmail({
      name: 'Ana',
      roleLabel: 'secretaria',
      actionLink: 'javascript:alert(1)',
    });
  } catch {
    threw = true;
  }
  assert(threw);
});
