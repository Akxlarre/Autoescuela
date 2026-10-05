// supabase/functions/_shared/contract-email.test.ts
//
// Tests del contenido del correo con el contrato firmado (fix-318-m).
//
//   npx deno test supabase/functions/_shared/contract-email.test.ts

import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import {
  CONTRACT_EMAIL_THEMES,
  buildContractEmailHtml,
  contractAttachment,
  contractEmailSubject,
  resolveContractEmailTheme,
  schoolInitials,
} from './contract-email.ts';

const DATA = {
  studentName: 'Ana Pérez',
  schoolName: 'Conductores Chillán',
  courseName: 'Clase B',
  enrollmentNumber: '0083',
};

Deno.test('el asunto lleva el Nº de matrícula y la escuela', () => {
  assertEquals(
    contractEmailSubject(DATA),
    'Tu contrato de matrícula Nº 0083 — Conductores Chillán',
  );
});

Deno.test('sin Nº de matrícula, el asunto no deja un hueco', () => {
  assertEquals(
    contractEmailSubject({ ...DATA, enrollmentNumber: null }),
    'Tu contrato de matrícula — Conductores Chillán',
  );
});

Deno.test('el adjunto conserva el tipo con que se subió el contrato', () => {
  assertEquals(contractAttachment('contracts/6248/contract.pdf', '0083'), {
    filename: 'Contrato_Matricula_0083.pdf',
    contentType: 'application/pdf',
  });
  assertEquals(contractAttachment('contracts/6248/contract.JPG', '0083'), {
    filename: 'Contrato_Matricula_0083.jpg',
    contentType: 'image/jpeg',
  });
  assertEquals(contractAttachment('contracts/6248/contract.png', null), {
    filename: 'Contrato_Matricula.png',
    contentType: 'image/png',
  });
});

Deno.test('no se adjunta un archivo de tipo desconocido', () => {
  assertEquals(contractAttachment('contracts/6248/contract.exe', '0083'), null);
  assertEquals(contractAttachment('contracts/6248/contract', '0083'), null);
});

Deno.test('el nombre del adjunto no arrastra caracteres raros del Nº de matrícula', () => {
  assertEquals(
    contractAttachment('contracts/1/contract.pdf', '00/83 "x"')?.filename,
    'Contrato_Matricula_0083x.pdf',
  );
});

Deno.test('tema de la sede: el configurado, o azul si falta o no se reconoce', () => {
  assertEquals(resolveContractEmailTheme('roja'), CONTRACT_EMAIL_THEMES.roja);
  assertEquals(resolveContractEmailTheme(undefined), CONTRACT_EMAIL_THEMES.azul);
  assertEquals(resolveContractEmailTheme('verde'), CONTRACT_EMAIL_THEMES.azul);
});

Deno.test('iniciales de la escuela', () => {
  assertEquals(schoolInitials('Conductores Chillán'), 'CC');
  assertEquals(schoolInitials('Autoescuela de Chillán'), 'AC');
});

Deno.test('el correo nombra al alumno, el curso, la matrícula y la escuela', () => {
  const html = buildContractEmailHtml(DATA, CONTRACT_EMAIL_THEMES.roja);
  assertStringIncludes(html, 'Hola, Ana Pérez');
  assertStringIncludes(html, 'Clase B');
  assertStringIncludes(html, '0083');
  assertStringIncludes(html, 'Conductores Chillán');
  assertStringIncludes(html, CONTRACT_EMAIL_THEMES.roja.brandColor);
});

Deno.test('los datos del alumno no pueden inyectar HTML en el correo', () => {
  const html = buildContractEmailHtml(
    { ...DATA, studentName: '<script>alert(1)</script>' },
    CONTRACT_EMAIL_THEMES.azul,
  );
  assert(!html.includes('<script>'));
  assertStringIncludes(html, '&lt;script&gt;');
});

Deno.test('sin Nº de matrícula no aparece la fila vacía', () => {
  const html = buildContractEmailHtml(
    { ...DATA, enrollmentNumber: null },
    CONTRACT_EMAIL_THEMES.azul,
  );
  assert(!html.includes('Nº de matrícula'));
});
