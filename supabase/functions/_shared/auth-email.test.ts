// supabase/functions/_shared/auth-email.test.ts
//
// Correos de cuenta que dispara Supabase Auth vía Send Email Hook (spec 0061-b, AC7).
//
//   deno test supabase/functions/_shared/auth-email.test.ts

import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { authEmailContent, buildAuthVerifyUrl } from './auth-email.ts';

const SUPABASE_URL = 'https://skvekggejikzxhzsjmkz.supabase.co';
const PLATFORM = 'cuentas@gestordeautoescuelas.cl';

const RECOVERY = {
  token: '123456',
  token_hash: 'abc123hash',
  redirect_to: 'https://app.gestordeautoescuelas.cl/recuperar-contrasena',
  email_action_type: 'recovery',
  site_url: 'https://app.gestordeautoescuelas.cl',
};

Deno.test(
  'buildAuthVerifyUrl arma el enlace /auth/v1/verify con token_hash, tipo y redirect',
  () => {
    const url = new URL(buildAuthVerifyUrl(SUPABASE_URL, RECOVERY));
    assertEquals(url.origin + url.pathname, `${SUPABASE_URL}/auth/v1/verify`);
    assertEquals(url.searchParams.get('token'), 'abc123hash');
    assertEquals(url.searchParams.get('type'), 'recovery');
    assertEquals(
      url.searchParams.get('redirect_to'),
      'https://app.gestordeautoescuelas.cl/recuperar-contrasena',
    );
  },
);

Deno.test(
  'buildAuthVerifyUrl tolera la URL con barra final y sin redirect_to (usa site_url)',
  () => {
    const url = new URL(buildAuthVerifyUrl(`${SUPABASE_URL}/`, { ...RECOVERY, redirect_to: '' }));
    assertEquals(url.pathname, '/auth/v1/verify');
    assertEquals(url.searchParams.get('redirect_to'), 'https://app.gestordeautoescuelas.cl');
  },
);

Deno.test('AC7: recuperar contraseña → texto neutro, sin nombre de escuela, con el enlace', () => {
  const link = buildAuthVerifyUrl(SUPABASE_URL, RECOVERY);
  const { subject, html } = authEmailContent('recovery', link, 'ana@example.com', PLATFORM);
  assertEquals(subject, 'Restablece tu contraseña');
  assertStringIncludes(html, 'ana@example.com');
  assertStringIncludes(html, link.replace(/&/g, '&amp;'));
  assertStringIncludes(html, 'Gestor de Autoescuelas');
  assert(!/Chill[aá]n/i.test(html), 'no debe nombrar a una escuela');
  assert(!/Chill[aá]n/i.test(subject));
  assert(!/no responder/i.test(html));
});

Deno.test('tipo desconocido → texto genérico neutro con el enlace', () => {
  const { subject, html } = authEmailContent(
    'email_change',
    'https://x.test/v?a=1',
    'a@b.cl',
    PLATFORM,
  );
  assertEquals(subject, 'Confirma esta acción en tu cuenta');
  assertStringIncludes(html, 'https://x.test/v?a=1');
  assert(!/Chill[aá]n/i.test(html));
});

Deno.test('el correo del destinatario se escapa', () => {
  const { html } = authEmailContent('recovery', 'https://x.test', '<script>@x.cl', PLATFORM);
  assert(!html.includes('<script>'));
});
