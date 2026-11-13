// supabase/functions/_shared/staff-invite-email.test.ts
//
// Tests del correo de activación de cuentas de personal (fix-182-b). Función pura.
//   deno test supabase/functions/_shared/staff-invite-email.test.ts

import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { buildStaffInviteEmail } from './staff-invite-email.ts';
import { resolveSender } from './school-email.ts';
import { CONTRACT_EMAIL_THEMES } from './contract-email.ts';

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

Deno.test('el encabezado lleva el nombre de la sede de la persona (hotfix-072-b)', () => {
  const { html } = buildStaffInviteEmail({
    name: 'Ana',
    roleLabel: 'secretaria',
    actionLink: LINK,
    schoolName: 'Autoescuela Chillán',
  });
  assertStringIncludes(html, '<p class="company">Autoescuela Chillán</p>');
  assert(!html.includes('Conductores Chillán'));
});

Deno.test('sin sede conocida no se nombra ninguna: marca genérica', () => {
  const { html } = buildStaffInviteEmail({
    name: 'Ana',
    roleLabel: 'secretaria',
    actionLink: LINK,
  });
  assertStringIncludes(html, '<p class="company">Autoescuela</p>');
});

Deno.test('escapa el nombre de la sede', () => {
  const { html } = buildStaffInviteEmail({
    name: 'Ana',
    roleLabel: 'secretaria',
    actionLink: LINK,
    schoolName: '<b>X</b>',
  });
  assert(!html.includes('<b>X</b>'));
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

Deno.test('spec 0061-b: con remitente, pie de la escuela y línea del dominio', () => {
  const sender = resolveSender(
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
  const { html } = buildStaffInviteEmail({
    name: 'Ana',
    roleLabel: 'secretaria',
    actionLink: LINK,
    sender,
  });
  assertStringIncludes(html, '<p class="company">Autoescuela Chillán</p>');
  assertStringIncludes(html, 'Enviado por Autoescuela Chillán mediante Gestor de Autoescuelas');
  assertStringIncludes(html, 'app.gestordeautoescuelas.cl');
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

Deno.test('0061-b: colores de la escuela y línea del dominio para el personal', () => {
  const sender = resolveSender(
    {
      id: 1,
      name: 'Autoescuela Chillán',
      email_sender_name: 'Autoescuela Chillán',
      email_sender_address: 'autoescuela-chillan@gestordeautoescuelas.cl',
      email: 'otecchillan@gmail.com',
      phone: null,
    },
    'cuentas@gestordeautoescuelas.cl',
  );
  const { html } = buildStaffInviteEmail({
    name: 'Ana',
    roleLabel: 'secretaria',
    actionLink: LINK,
    sender,
    theme: CONTRACT_EMAIL_THEMES.roja,
  });
  assertStringIncludes(html, CONTRACT_EMAIL_THEMES.roja.gradientHero);
  assert(!html.includes(CONTRACT_EMAIL_THEMES.azul.gradientHero));
  assertStringIncludes(html, 'La plataforma de Autoescuela Chillán funciona en');
  assert(!html.includes('portal de alumnos'));
});
