// supabase/functions/_shared/staff-auth.test.ts
//
// Tests del Núcleo Funcional de autorización de staff (spec 0009-i). `decideStaffAccess` es pura:
// recibe lo ya resuelto desde Auth y desde `users`/`roles`, sin I/O.
//
//   npx deno test supabase/functions/_shared/staff-auth.test.ts

import { assertEquals } from 'jsr:@std/assert';
import { canAccessBranch, decideStaffAccess, resolveBranchScope } from './staff-auth.ts';

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
  assertEquals(r, { ok: true, userId: 1, role: 'admin', branchId: null, canAccessBothBranches: false });
});

Deno.test('secretary permitida → ok con su id y rol', () => {
  const r = decideStaffAccess({ authUserId: 'uid-2', dbUserId: 2, roleName: 'secretary' }, STAFF);
  assertEquals(r, { ok: true, userId: 2, role: 'secretary', branchId: null, canAccessBothBranches: false });
});

Deno.test('admin en una función solo-admin → ok', () => {
  const r = decideStaffAccess({ authUserId: 'uid-1', dbUserId: 1, roleName: 'admin' }, ADMIN_ONLY);
  assertEquals(r, { ok: true, userId: 1, role: 'admin', branchId: null, canAccessBothBranches: false });
});

Deno.test('los rechazos traen un mensaje legible en `error`', () => {
  const r401 = decideStaffAccess({ authUserId: null, dbUserId: null, roleName: null }, STAFF);
  const r403 = decideStaffAccess({ authUserId: 'uid-1', dbUserId: 10, roleName: 'student' }, STAFF);
  if (!r401.ok) assertEquals(typeof r401.error, 'string');
  if (!r403.ok) assertEquals(typeof r403.error, 'string');
});

// ── Alcance por sede (fix-430-m) ────────────────────────────────────────────────────────────
// Las funciones que exportan listados usan la clave de servicio: la sede no puede salir del body
// sin validar, o la secretaria de una sede descarga los datos de la otra.

Deno.test('el ok trae la sede y el grant multi-sede del usuario', () => {
  const r = decideStaffAccess(
    { authUserId: 'uid-2', dbUserId: 2, roleName: 'secretary', branchId: 1, canAccessBothBranches: true },
    STAFF,
  );
  assertEquals(r, { ok: true, userId: 2, role: 'secretary', branchId: 1, canAccessBothBranches: true });
});

const ADMIN = { role: 'admin', branchId: null, canAccessBothBranches: false } as const;
const SEC_A = { role: 'secretary', branchId: 1, canAccessBothBranches: false } as const;
const SEC_MULTI = { role: 'secretary', branchId: 1, canAccessBothBranches: true } as const;
const SEC_SIN_SEDE = { role: 'secretary', branchId: null, canAccessBothBranches: false } as const;

Deno.test('admin: la sede pedida se respeta, null = todas', () => {
  assertEquals(resolveBranchScope(ADMIN, 2), { ok: true, branchId: 2 });
  assertEquals(resolveBranchScope(ADMIN, null), { ok: true, branchId: null });
});

Deno.test('secretaria con grant: puede pedir cualquier sede o todas', () => {
  assertEquals(resolveBranchScope(SEC_MULTI, 2), { ok: true, branchId: 2 });
  assertEquals(resolveBranchScope(SEC_MULTI, null), { ok: true, branchId: null });
});

Deno.test('secretaria sin grant: su propia sede → ok', () => {
  assertEquals(resolveBranchScope(SEC_A, 1), { ok: true, branchId: 1 });
});

Deno.test('secretaria sin grant: sin sede pedida → se acota a la suya, nunca a todas', () => {
  assertEquals(resolveBranchScope(SEC_A, null), { ok: true, branchId: 1 });
  assertEquals(resolveBranchScope(SEC_A, undefined), { ok: true, branchId: 1 });
});

Deno.test('secretaria sin grant: otra sede → 403', () => {
  const r = resolveBranchScope(SEC_A, 2);
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.status, 403);
});

Deno.test('secretaria sin grant y sin sede asignada → 403 (nunca todas las sedes)', () => {
  const r = resolveBranchScope(SEC_SIN_SEDE, null);
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.status, 403);
});

Deno.test('una sede que no es un entero se trata como "sin sede pedida"', () => {
  assertEquals(resolveBranchScope(SEC_A, '2'), { ok: true, branchId: 1 });
  assertEquals(resolveBranchScope(ADMIN, 'x'), { ok: true, branchId: null });
});

// ── Alcance por matrícula (fix-431-m) ───────────────────────────────────────────────────────
// Las funciones que reciben un enrollment_id leen con la clave de servicio: la matrícula tiene
// que ser de una sede que quien llama puede ver (misma regla que la RLS de enrollments).

Deno.test('canAccessBranch: admin y secretaria con grant ven cualquier sede', () => {
  assertEquals(canAccessBranch(ADMIN, 2), true);
  assertEquals(canAccessBranch(SEC_MULTI, 2), true);
});

Deno.test('canAccessBranch: secretaria sin grant ve su sede y las filas sin sede', () => {
  assertEquals(canAccessBranch(SEC_A, 1), true);
  assertEquals(canAccessBranch(SEC_A, null), true);
});

Deno.test('canAccessBranch: secretaria sin grant no ve la otra sede', () => {
  assertEquals(canAccessBranch(SEC_A, 2), false);
});
