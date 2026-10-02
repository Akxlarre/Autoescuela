// supabase/functions/_shared/user-edit-authz.test.ts
//
// Tests de las reglas de autorización sobre el OBJETIVO de una edición de usuario (fix-179-b).
// Funciones puras, sin I/O → `deno test supabase/functions/_shared/user-edit-authz.test.ts`

import { assertEquals } from 'jsr:@std/assert';
import {
  authorizeInstructorEdit,
  authorizeStudentProfileEdit,
  type EditCaller,
} from './user-edit-authz.ts';

const admin: EditCaller = { role: 'admin', branchId: null, bothBranches: true };
const sec1: EditCaller = { role: 'secretary', branchId: 1, bothBranches: false };
const secMulti: EditCaller = { role: 'secretary', branchId: 1, bothBranches: true };

// ── authorizeStudentProfileEdit ─────────────────────────────────────────────

Deno.test('alumno: objetivo inexistente → 404', () => {
  assertEquals(authorizeStudentProfileEdit(sec1, null).status, 404);
});

Deno.test('alumno: objetivo admin → 403 (toma de cuenta)', () => {
  const r = authorizeStudentProfileEdit(sec1, { role: 'admin', branchId: null });
  assertEquals(r.ok, false);
  assertEquals(r.status, 403);
});

Deno.test('alumno: objetivo secretaria o instructor → 403, también para admin', () => {
  assertEquals(authorizeStudentProfileEdit(sec1, { role: 'secretary', branchId: 1 }).status, 403);
  assertEquals(authorizeStudentProfileEdit(admin, { role: 'instructor', branchId: 1 }).status, 403);
});

Deno.test('alumno: secretaria edita alumno de su sede → ok', () => {
  assertEquals(authorizeStudentProfileEdit(sec1, { role: 'student', branchId: 1 }).ok, true);
});

Deno.test('alumno: secretaria edita alumno de otra sede → 403', () => {
  assertEquals(authorizeStudentProfileEdit(sec1, { role: 'student', branchId: 2 }).status, 403);
});

Deno.test('alumno: alumno sin sede → solo admin o multi-sede', () => {
  assertEquals(authorizeStudentProfileEdit(sec1, { role: 'student', branchId: null }).status, 403);
  assertEquals(authorizeStudentProfileEdit(secMulti, { role: 'student', branchId: null }).ok, true);
  assertEquals(authorizeStudentProfileEdit(admin, { role: 'student', branchId: null }).ok, true);
});

Deno.test('alumno: multi-sede y admin editan alumnos de cualquier sede', () => {
  assertEquals(authorizeStudentProfileEdit(secMulti, { role: 'student', branchId: 2 }).ok, true);
  assertEquals(authorizeStudentProfileEdit(admin, { role: 'student', branchId: 2 }).ok, true);
});

Deno.test('alumno: llamador que no es staff → 403', () => {
  const instr: EditCaller = { role: 'instructor', branchId: 1, bothBranches: false };
  assertEquals(authorizeStudentProfileEdit(instr, { role: 'student', branchId: 1 }).status, 403);
});

// ── authorizeInstructorEdit ─────────────────────────────────────────────────

const instr1 = {
  instructorUserId: 50,
  role: 'instructor',
  branchId: 1,
  bothBranches: false,
};

Deno.test('instructor: instructorId inexistente → 404', () => {
  assertEquals(authorizeInstructorEdit(sec1, null, 50, 1).status, 404);
});

Deno.test('instructor: userId no corresponde al instructorId → 400 (userId de un admin)', () => {
  const r = authorizeInstructorEdit(sec1, instr1, 2, 1);
  assertEquals(r.ok, false);
  assertEquals(r.status, 400);
});

Deno.test('instructor: el usuario del instructor no tiene rol instructor → 403', () => {
  assertEquals(authorizeInstructorEdit(admin, { ...instr1, role: 'admin' }, 50, 1).status, 403);
});

Deno.test('instructor: secretaria edita instructor de su sede sin mover la sede → ok', () => {
  assertEquals(authorizeInstructorEdit(sec1, instr1, 50, 1).ok, true);
});

Deno.test('instructor: secretaria edita instructor de otra sede → 403', () => {
  assertEquals(authorizeInstructorEdit(sec1, { ...instr1, branchId: 2 }, 50, 2).status, 403);
});

Deno.test('instructor: secretaria edita instructor "ambas sedes" de otra sede → ok', () => {
  assertEquals(
    authorizeInstructorEdit(sec1, { ...instr1, branchId: 2, bothBranches: true }, 50, 2).ok,
    true,
  );
});

Deno.test('instructor: secretaria no puede cambiarle la sede → 403', () => {
  assertEquals(authorizeInstructorEdit(sec1, instr1, 50, 2).status, 403);
  assertEquals(authorizeInstructorEdit(sec1, instr1, 50, null).status, 403);
});

Deno.test('instructor: admin y multi-sede pueden cambiar la sede', () => {
  assertEquals(authorizeInstructorEdit(admin, instr1, 50, 2).ok, true);
  assertEquals(authorizeInstructorEdit(secMulti, instr1, 50, 2).ok, true);
});

Deno.test('instructor: branchId omitido (undefined) = no cambia la sede', () => {
  assertEquals(authorizeInstructorEdit(sec1, instr1, 50, undefined).ok, true);
});
