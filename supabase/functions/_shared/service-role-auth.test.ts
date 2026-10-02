// supabase/functions/_shared/service-role-auth.test.ts
//
// Ejecutar:
//   npx --yes deno test --no-lock --node-modules-dir=none supabase/functions/_shared/service-role-auth.test.ts

import { assertEquals } from 'jsr:@std/assert@1';
import { isServiceRoleRequest, readJwtRole } from './service-role-auth.ts';

function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.firma`;
}

const SERVICE = fakeJwt({ role: 'service_role', iss: 'supabase' });
const ANON = fakeJwt({ role: 'anon', iss: 'supabase' });
const USER = fakeJwt({ role: 'authenticated', sub: 'uuid' });

Deno.test('readJwtRole lee el claim role', () => {
  assertEquals(readJwtRole(SERVICE), 'service_role');
  assertEquals(readJwtRole(ANON), 'anon');
});

Deno.test('readJwtRole devuelve null ante basura', () => {
  assertEquals(readJwtRole('no-es-un-jwt'), null);
  assertEquals(readJwtRole('a.%%%.c'), null);
  assertEquals(readJwtRole(''), null);
});

Deno.test('acepta token de rol de servicio', () => {
  assertEquals(isServiceRoleRequest(`Bearer ${SERVICE}`), true);
});

Deno.test('acepta la service key exacta del entorno aunque no sea JWT', () => {
  assertEquals(isServiceRoleRequest('Bearer sb_secret_xyz', 'sb_secret_xyz'), true);
});

Deno.test('rechaza anon key, usuario logueado, header vacío o ausente', () => {
  assertEquals(isServiceRoleRequest(`Bearer ${ANON}`), false);
  assertEquals(isServiceRoleRequest(`Bearer ${USER}`), false);
  assertEquals(isServiceRoleRequest('Bearer '), false);
  assertEquals(isServiceRoleRequest(null), false);
});

Deno.test('no confunde una service key distinta con la del entorno', () => {
  assertEquals(isServiceRoleRequest('Bearer otra', 'sb_secret_xyz'), false);
});
