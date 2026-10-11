# Fix: cualquier instructor lee y modifica la asistencia Clase B de cualquier clase
> id: fix-368-m-asistencia-b-abierta-a-instructores
> refs: fix-366-m-testing-asistencia-clase-b (S19, nueva) · ASG-i-027 · 0047-b
> status: done
> closed: 2026-10-11
> created: 2026-10-11

## Síntoma

Hallado en el bloque 1 de `fix-366-m`. La cuenta `instructor@test.com` (instructor 8) cuenta por
API **261 asistencias**, las mismas que el admin: todas las sedes y todos los instructores. Lee la
fila 338 (de una clase del instructor 226), y un `UPDATE` sobre ella afecta 1 fila.

## Root Cause

En `class_b_practice_attendance`, las políticas SELECT, INSERT y UPDATE dan acceso por rol
(`auth_user_role() = ANY (ARRAY['admin','instructor'])`) sin mirar de quién es la clase.
`0047-b` (`20261001150000_rls_aislamiento_por_sede.sql:87`) lo dejó así a propósito porque el
portal Instructor está fuera del piloto. Pero el bloqueo del portal es solo de rutas en el
navegador: los instructores tienen cuenta (invitación de `fix-167-m`) y la API queda abierta.
Un instructor podría pasar una falta ajena a `excused` (le evita la penalización al alumno),
marcar ausente a un alumno que vino, o leer la asistencia de toda la escuela.

## Fix

Migración `20261011120000_fix368_asistencia_b_instructor_solo_sus_clases.sql`: la cláusula del
instructor en SELECT, INSERT y UPDATE pasa a exigir
`class_b_session_id IN (SELECT id FROM class_b_sessions WHERE instructor_id = auth_instructor_id())`.
Admin, secretaria (por sede) y alumno (su fila) quedan iguales. DELETE no cambia (el instructor
nunca lo tuvo).

El único uso del instructor en la app es el `upsert` de "presente" al finalizar **su** clase
(`instructor-clases.facade.ts:367`), que sigue permitido.

## Acceptance Criteria

- [x] AC1 — Un instructor no lee asistencias de clases de otro instructor (0 filas).
- [x] AC2 — Un instructor no puede actualizar ni insertar asistencia de una clase ajena.
- [x] AC3 — Un instructor sí lee, inserta y actualiza la asistencia de sus propias clases.
- [x] AC4 — Admin, secretaria de la sede y alumno (su fila) mantienen su acceso.

## Regression Test

- `supabase/tests/rls/fix-368-m-asistencia-b-instructor.sql` — transacción que simula los roles
  con `request.jwt.claims` y termina con `RAISE EXCEPTION` (revierte todo).
- Re-ejecutar `b1-instr.cjs` (scratchpad) tras aplicar: SELECT ajena `[]`, UPDATE ajena 0 filas.

## Verificación (2026-10-11)

Matías aplicó la migración. `supabase/tests/rls/fix-368-m-asistencia-b-instructor.sql` contra la
BD de dev: `RESULTADO fix-368-m: TODO OK` (instructor: lee ajena 0, update ajena 0, insert ajena
rechazado; lee/actualiza/inserta propia ✓; admin y secretaria intactos). Antes de aplicar, el
mismo test daba FALLA en AC1/AC2, así que discrimina. Por API: el instructor de prueba pasa de
ver 261 asistencias a 0 (no tiene clases propias con asistencia).

## Despliegue

Migración: la aplica Matías.
