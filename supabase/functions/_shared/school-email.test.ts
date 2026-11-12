// supabase/functions/_shared/school-email.test.ts
//
// Tests del remitente, la respuesta, el asunto y el pie por escuela (spec 0061-b).
//
//   deno test supabase/functions/_shared/school-email.test.ts

import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import {
  PLATFORM_NAME,
  domainLineHtml,
  isAllowedSenderAddress,
  loadSchoolSender,
  mailFrom,
  platformSender,
  resolveSender,
  schoolFooterHtml,
  withSchool,
  type BranchEmailRow,
} from './school-email.ts';

const PLATFORM = 'cuentas@gestordeautoescuelas.cl';

const CONDUCTORES: BranchEmailRow = {
  id: 2,
  name: 'Conductores Chillán',
  email_sender_name: 'Conductores Chillán',
  email_sender_address: 'conductores-chillan@gestordeautoescuelas.cl',
  email: 'conductorchillan@gmail.com',
  phone: '+56 42 224 4030',
};

// ── resolveSender ───────────────────────────────────────────────────────────────────────────

Deno.test('AC1/AC2: escuela completa → su nombre, su dirección y su correo de respuesta', () => {
  const s = resolveSender(CONDUCTORES, PLATFORM);
  assertEquals(s.schoolName, 'Conductores Chillán');
  assertEquals(s.fromName, 'Conductores Chillán');
  assertEquals(s.fromAddress, 'conductores-chillan@gestordeautoescuelas.cl');
  assertEquals(s.replyTo, 'conductorchillan@gmail.com');
  assertEquals(s.phone, '+56 42 224 4030');
});

Deno.test(
  'AC-E2: escuela sin dirección de envío → dirección neutra con el nombre de la escuela',
  () => {
    const s = resolveSender({ ...CONDUCTORES, email_sender_address: null }, PLATFORM);
    assertEquals(s.fromAddress, PLATFORM);
    assertEquals(s.fromName, 'Conductores Chillán');
  },
);

Deno.test(
  'AC-E2: dirección fuera del dominio autenticado → se ignora y sale desde la neutra',
  () => {
    const s = resolveSender(
      { ...CONDUCTORES, email_sender_address: 'escuela@gmail.com' },
      PLATFORM,
    );
    assertEquals(s.fromAddress, PLATFORM);
  },
);

Deno.test('sin nombre visible configurado → usa el nombre de la escuela', () => {
  const s = resolveSender({ ...CONDUCTORES, email_sender_name: '  ' }, PLATFORM);
  assertEquals(s.fromName, 'Conductores Chillán');
});

Deno.test('AC-E1: escuela sin correo de respuesta → replyTo null', () => {
  assertEquals(resolveSender({ ...CONDUCTORES, email: '' }, PLATFORM).replyTo, null);
  assertEquals(resolveSender({ ...CONDUCTORES, email: null }, PLATFORM).replyTo, null);
  assertEquals(resolveSender({ ...CONDUCTORES, email: 'no-es-correo' }, PLATFORM).replyTo, null);
});

Deno.test('fila nula → remitente de la plataforma, sin escuela', () => {
  const s = resolveSender(null, PLATFORM);
  assertEquals(s, platformSender(PLATFORM));
  assertEquals(s.schoolName, '');
  assertEquals(s.fromName, PLATFORM_NAME);
  assertEquals(s.replyTo, null);
});

Deno.test('AC-E4: el nombre se normaliza a NFC (tilde compuesta)', () => {
  const decomposed = 'Autoescuela Chillán';
  const s = resolveSender(
    { ...CONDUCTORES, name: decomposed, email_sender_name: decomposed },
    PLATFORM,
  );
  assertEquals(s.fromName, 'Autoescuela Chillán');
  assertEquals(s.schoolName, 'Autoescuela Chillán');
});

Deno.test(
  'AC-E4: mailFrom entrega nombre y dirección separados (nodemailer codifica el nombre)',
  () => {
    const sender = resolveSender(
      { ...CONDUCTORES, email_sender_name: 'Escuela "Chillán", sede centro' },
      PLATFORM,
    );
    assertEquals(mailFrom(sender), {
      name: 'Escuela "Chillán", sede centro',
      address: 'conductores-chillan@gestordeautoescuelas.cl',
    });
  },
);

// ── isAllowedSenderAddress ──────────────────────────────────────────────────────────────────

Deno.test('AC-E6: solo direcciones del dominio autenticado', () => {
  assert(isAllowedSenderAddress('autoescuela-chillan@gestordeautoescuelas.cl'));
  assert(isAllowedSenderAddress('Cuentas@GestorDeAutoescuelas.cl'));
  assert(!isAllowedSenderAddress('escuela@gmail.com'));
  assert(!isAllowedSenderAddress('x@gestordeautoescuelas.cl.evil.com'));
  assert(!isAllowedSenderAddress('x@sub.gestordeautoescuelas.cl'));
  assert(!isAllowedSenderAddress(''));
  assert(!isAllowedSenderAddress(null));
});

// ── withSchool ──────────────────────────────────────────────────────────────────────────────

Deno.test('AC3: el asunto incluye el nombre de la escuela', () => {
  const s = resolveSender(CONDUCTORES, PLATFORM);
  assertEquals(
    withSchool('Enlace Zoom · Clase 3', s),
    'Enlace Zoom · Clase 3 — Conductores Chillán',
  );
});

Deno.test('AC3: no duplica el nombre si el asunto ya lo trae', () => {
  const s = resolveSender(CONDUCTORES, PLATFORM);
  const subject = 'Tu certificado — conductores chillán';
  assertEquals(withSchool(subject, s), subject);
});

Deno.test('sin escuela → el asunto queda igual', () => {
  assertEquals(
    withSchool('Restablece tu contraseña', platformSender(PLATFORM)),
    'Restablece tu contraseña',
  );
});

// ── schoolFooterHtml ────────────────────────────────────────────────────────────────────────

Deno.test(
  'AC3: pie con "Enviado por [escuela] mediante Gestor de Autoescuelas", teléfono y respuesta',
  () => {
    const html = schoolFooterHtml(resolveSender(CONDUCTORES, PLATFORM));
    assertStringIncludes(html, 'Enviado por Conductores Chillán mediante Gestor de Autoescuelas');
    assertStringIncludes(html, '+56 42 224 4030');
    assertStringIncludes(html, 'conductorchillan@gmail.com');
    assertStringIncludes(html, 'responder este correo');
    assert(!/no responder/i.test(html), 'no debe decir "no responder"');
  },
);

Deno.test('AC-E1: sin correo de respuesta, el pie no invita a responder', () => {
  const html = schoolFooterHtml(resolveSender({ ...CONDUCTORES, email: null }, PLATFORM));
  assert(!/responder/i.test(html), 'no debe mencionar responder');
  assertStringIncludes(html, '+56 42 224 4030');
});

Deno.test('pie promocional: indica cómo darse de baja con el correo de la escuela', () => {
  const html = schoolFooterHtml(resolveSender(CONDUCTORES, PLATFORM), { promocional: true });
  assertStringIncludes(html, 'no quieres recibir más promociones');
  assertStringIncludes(html, 'conductorchillan@gmail.com');
});

Deno.test('pie promocional sin correo de respuesta: pide avisar en la escuela', () => {
  const html = schoolFooterHtml(resolveSender({ ...CONDUCTORES, email: null }, PLATFORM), {
    promocional: true,
  });
  assertStringIncludes(html, 'avísanos en la escuela');
});

Deno.test('el pie escapa HTML en nombre, teléfono y correo', () => {
  const html = schoolFooterHtml(
    resolveSender(
      { ...CONDUCTORES, email_sender_name: '<b>X</b>', name: '<b>X</b>', phone: '<i>1</i>' },
      PLATFORM,
    ),
  );
  assert(!html.includes('<b>X</b>'));
  assert(!html.includes('<i>1</i>'));
  assertStringIncludes(html, '&lt;b&gt;X&lt;/b&gt;');
});

Deno.test('pie de la plataforma (sin escuela): no nombra escuelas', () => {
  const html = schoolFooterHtml(platformSender(PLATFORM));
  assertStringIncludes(html, 'Gestor de Autoescuelas');
  assert(!html.includes('Enviado por  mediante'));
  assert(!/Chillán/.test(html));
});

// ── domainLineHtml ──────────────────────────────────────────────────────────────────────────

Deno.test('AC8: línea que explica el dominio, con el nombre de la escuela', () => {
  const html = domainLineHtml(resolveSender(CONDUCTORES, PLATFORM));
  assertStringIncludes(html, 'El portal de alumnos de Conductores Chillán funciona en');
  assertStringIncludes(html, 'https://app.gestordeautoescuelas.cl');
});

Deno.test('AC8: sin escuela, la línea no nombra ninguna', () => {
  const html = domainLineHtml(platformSender(PLATFORM));
  assertStringIncludes(html, 'app.gestordeautoescuelas.cl');
  assert(!/de\s+funciona/.test(html));
});

// ── loadSchoolSender ────────────────────────────────────────────────────────────────────────

function fakeService(result: { data: unknown; error: unknown }) {
  const calls: Record<string, unknown> = {};
  const chain = {
    select(cols: string) {
      calls.select = cols;
      return chain;
    },
    eq(col: string, val: unknown) {
      calls.eq = [col, val];
      return chain;
    },
    maybeSingle() {
      return Promise.resolve(result);
    },
  };
  return {
    calls,
    from(table: string) {
      calls.table = table;
      return chain;
    },
  };
}

Deno.test('loadSchoolSender lee la escuela de branches', async () => {
  const service = fakeService({ data: CONDUCTORES, error: null });
  const s = await loadSchoolSender(service, 2, PLATFORM);
  assertEquals(service.calls.table, 'branches');
  assertEquals(service.calls.eq, ['id', 2]);
  assertEquals(s.fromAddress, 'conductores-chillan@gestordeautoescuelas.cl');
});

Deno.test('AC-E2: loadSchoolSender nunca lanza (sin escuela, error de lectura)', async () => {
  assertEquals(
    await loadSchoolSender(fakeService({ data: null, error: null }), null, PLATFORM),
    platformSender(PLATFORM),
  );
  const failed = await loadSchoolSender(
    fakeService({ data: null, error: { message: 'boom' } }),
    2,
    PLATFORM,
  );
  assertEquals(failed.fromAddress, PLATFORM);
});

Deno.test('AC8: en un correo al personal la línea no habla del portal de alumnos', () => {
  const html = domainLineHtml(resolveSender(CONDUCTORES, PLATFORM), 'personal');
  assertStringIncludes(html, 'La plataforma de Conductores Chillán funciona en');
  assert(!html.includes('alumnos'));
});
