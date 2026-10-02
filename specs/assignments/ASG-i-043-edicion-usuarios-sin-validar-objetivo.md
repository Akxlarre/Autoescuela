# Asignación ASG-i-043 — Una secretaria puede editar a cualquier usuario (incluido un admin)

> **status:** reclamada
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P0
> **created:** 2026-09-30
> **created_by:** i
> **claimed_by:** b
> **claimed_at:** 2026-10-01
> **resulting_track:** fix-179-b-edicion-usuarios-sin-validar-objetivo

---

## Contexto / Objetivo

**Sospecha no confirmada en vivo** (tanda de testing 2026-09-29). Tres caminos dejan a una
secretaria modificar usuarios que no le corresponden:

1. **`update-student-profile`** solo verifica que quien llama sea admin o secretaria; después
   usa el `userId` del body sin revisar que sea un alumno ni de su sede, y cambia el email en
   Auth con la clave de servicio. Cambiarle el email a un admin y pedir recuperar contraseña =
   **toma de la cuenta**. (Verificada en código: `update-student-profile/index.ts:78-80,102-121`.)
2. **`update-instructor`** tiene el mismo patrón (`update-instructor/index.ts:97-100,150-195`).
3. **RLS `update_users`**: para secretaria solo exige `branch_visible(branch_id)` y que la fila
   no sea admin, sin restringir columnas. Desde la consola podría darse
   `can_access_both_branches = true` o cambiar el `role_id` de un alumno
   (`20260307120000_fix_users_rls_secretary_enrollment.sql:27-35`).

## Alcance sugerido

- **Paso 1, confirmar** (pasos en §4 de `024b` y `034`). Para (1) y (2) usar una cuenta de prueba
  como víctima, nunca un admin real del equipo, y revertir el email después.
- (1) y (2): validar que el `userId` corresponda al tipo esperado (alumno / el dueño del
  `instructorId`) y a una sede visible para quien llama.
- (3): restringir las columnas que puede cambiar la secretaria (trigger `BEFORE UPDATE` que
  rechace cambios a `role_id`, `can_access_both_branches`, `branch_id`, `active`, etc. si el
  que actualiza no es admin), o mover esas escrituras a funciones controladas. Requiere migración.
- Revisar si `update-secretary` y el resto de funciones de usuarios tienen el mismo patrón.

## Referencias

- `specs/testing-piloto/024b-ficha-ex-alumnos.md` S1 · `034-instructores-secretarias-usuarios.md` S1, S2

## Archivos involucrados (opcional, para detectar solapes)

- `supabase/functions/update-student-profile/index.ts`, `supabase/functions/update-instructor/index.ts`
- Nueva migración para la RLS/trigger de `users`

## Notas para quien la reclame

- Solapa con `ASG-i-044` (cuentas) y `ASG-i-042` (helper de autorización de edge functions).
