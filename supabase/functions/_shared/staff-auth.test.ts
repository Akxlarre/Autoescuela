// supabase/functions/_shared/staff-auth.test.ts
//
// Tests del Núcleo Funcional de autorización de staff (spec 0009-i). `decideStaffAccess` es pura:
// recibe lo ya resuelto desde Auth y desde `users`/`roles`, sin I/O.
//
//   npx deno test supabase/functions/_shared/staff-auth.test.ts

import { assertEquals } from 'jsr:@std/assert';
import { decideStaffAccess } from './staff-auth.ts';

const STAFF = ['admin', 'secretary'] as const;
const ADMIN_ONLY = ['admin'] as const;

Deno.test('sin usuario de Auth (sin header, anon key, token vencido) → 401', () => {
  const r = decideStaffAccess({ authUserId: null, dbUserId: null, roleName: null }, STAFF);
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.status, 401);
});

Deno.test('usuario de Auth sin fila en users → 403', () => {
  const r = decideStaffAccess({ authUserId: 'uid-1', dbUserId: null, roleName: null }, STAFF);
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.status, 403);
});

Deno.test('rol student → 403', () => {
  const r = decideStaffAccess({ authUserId: 'uid-1', dbUserId: 10, roleName: 'student' }, STAFF);
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.status, 403);
});

Deno.test('rol instructor → 403', () => {
  const r = decideStaffAccess({ authUserId: 'uid-1', dbUserId: 11, roleName: 'instructor' }, STAFF);
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.status, 403);
});

Deno.test('rol desconocido → 403 (nunca 500)', () => {
  const r = decideStaffAccess({ authUserId: 'uid-1', dbUserId: 12, roleName: 'superuser' }, STAFF);
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.status, 403);
});

Deno.test(
  'el rol en español no se confunde con el real de la BD (secretaria ≠ secretary) → 403',
  () => {
    const r = decideStaffAccess(
      { authUserId: 'uid-1', dbUserId: 13, roleName: 'secretaria' },
      STAFF,
    );
    assertEquals(r.ok, false);
    if (!r.ok) assertEquals(r.status, 403);
  },
);

Deno.test('secretary en una función solo-admin → 403', () => {
  const r = decideStaffAccess(
    { authUserId: 'uid-1', dbUserId: 14, roleName: 'secretary' },
    ADMIN_ONLY,
  );
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.status, 403);
});

Deno.test('admin permitido → ok con su id y rol', () => {
  const r = decideStaffAccess({ authUserId: 'uid-1', dbUserId: 1, roleName: 'admin' }, STAFF);
  assertEquals(r, { ok: true, userId: 1, role: 'admin' });
});

Deno.test('secretary permitida → ok con su id y rol', () => {
  const r = decideStaffAccess({ authUserId: 'uid-2', dbUserId: 2, roleName: 'secretary' }, STAFF);
  assertEquals(r, { ok: true, userId: 2, role: 'secretary' });
});

Deno.test('admin en una función solo-admin → ok', () => {
  const r = decideStaffAccess({ authUserId: 'uid-1', dbUserId: 1, roleName: 'admin' }, ADMIN_ONLY);
  assertEquals(r, { ok: true, userId: 1, role: 'admin' });
});

Deno.test('los rechazos traen un mensaje legible en `error`', () => {
  const r401 = decideStaffAccess({ authUserId: null, dbUserId: null, roleName: null }, STAFF);
  const r403 = decideStaffAccess({ authUserId: 'uid-1', dbUserId: 10, roleName: 'student' }, STAFF);
  if (!r401.ok) assertEquals(typeof r401.error, 'string');
  if (!r403.ok) assertEquals(typeof r403.error, 'string');
});
