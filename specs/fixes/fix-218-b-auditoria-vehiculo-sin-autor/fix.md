# Fix: La auditoría de instructores registra el cambio de vehículo sin autor y deja columnas en inglés
> id: fix-218-b-auditoria-vehiculo-sin-autor
> refs: ASG-i-034 (manuales grupo 1, casos E10/E12 y T02) — hallazgos 1 y 3; extiende fix-206-b
> status: done
> created: 2026-10-09

## Root Cause
[Confirmado en vivo el 2026-10-09, con la sesión admin del owner.]
1. **Vehículo sin autor.** `update-instructor` (cerrar la asignación vigente y crear la nueva) y
   `create-instructor` (asignación inicial) escriben `vehicle_assignments` con `supabaseAdmin`, que
   no lleva el header `x-audit-user-id`. El trigger `log_change()` no encuentra autor (la tabla no
   tiene `registered_by`) y el movimiento queda como "Sistema" (`audit_log.user_id = NULL`). Las
   demás escrituras de esas funciones (`users`, `instructors`) ya usaban `supabaseAudit`.
2. **Columnas en inglés.** `audit_humanize_column()` no tiene `phone` y cae al fallback `initcap`:
   cambiar el teléfono de una secretaria se ve como "Phone". Un barrido de las tablas con trigger
   `log_change` encontró 47 columnas más en la misma situación (48 con `phone`) (todas las de `users`: email,
   first_names, rut…; y varias de matrículas, pre-inscripciones, libro de clases y ventas).

### Hallazgo adicional (2026-10-09, al preparar el deploy)
El deploy de la spec 0024-m (v22 de `create-instructor`) salió de una rama anterior a fix-214-b:
**en producción se perdió `sendInvite`** y la función vuelve a mandar el correo de invitación aun
con el portal de instructores en piloto, y deja de devolver `inviteEmailSent`. Redesplegar desde
`main` lo repone. `update-instructor` v22 quedó además con `verify_jwt=false` (antes `true`); la
función valida el token con `getUser()`, así que no queda abierta, pero se repone `true`.

## ACs Afectados
Ninguno de una spec previa (fix-206-b auditó instructores, pero no cubrió el autor de
`vehicle_assignments` ni las etiquetas de `users`). ACs propios:
- **F1:** cambiar o quitar el vehículo de un instructor deja en Auditoría el nombre de quien lo hizo,
  no "Sistema". Igual al crear un instructor con vehículo.
- **F2:** ninguna columna de una tabla auditada se muestra con el fallback en inglés: "Teléfono",
  "Correo", "Nombres", "RUT", etc.
- **F3:** `create-instructor` en producción vuelve a respetar `sendInvite` (fix-214-b).

## Cambio
- `supabase/functions/update-instructor/index.ts` y `create-instructor/index.ts` — `vehicle_assignments`
  con `supabaseAudit`. **Requiere deploy** (aprobación del owner).
- `supabase/migrations/20261009120000_fix218_audit_humanize_columnas_faltantes.sql` — +48 etiquetas
  sobre la definición vigente en producción. **Requiere aplicar** (aprobación del owner).

## Test de Regresión
- `supabase/tests/audit/fix-218-b-etiquetas-auditoria.sql` — falla si alguna columna auditada cae al
  fallback (contra producción hoy: falla con `phone`; con la migración en una transacción con ROLLBACK: pasa).
- F1: tras el deploy, cambiar el vehículo de un instructor de prueba y comprobar `audit_log.user_id`.

## Progreso
- [x] Funciones: `vehicle_assignments` con `supabaseAudit` en las dos.
- [x] Desplegado (v22) comparado con `main`: `update-instructor` idéntico; `create-instructor` sin fix-214-b (hallazgo adicional).
- [x] Migración + test SQL: rojo contra producción, verde en transacción con ROLLBACK.
- [x] Deploy (aprobado 2026-10-09): `update-instructor` v23 (verify_jwt=true) y `create-instructor` v23 (verify_jwt=false), ambos idénticos a `main` → fix-214-b repuesto.
- [x] Migración aplicada y registrada en `schema_migrations`; test SQL `fix-218-b OK`; `phone` → "Teléfono", `email` → "Correo".
- [x] F1 en vivo (sesión admin del owner, botón Guardar del drawer): quitar y devolver AB1234 a "Instructor Prueba Test" → `audit_log` 100888 (UPDATE, cierra asignación 7) y 100889 (INSERT, asignación 55) con `user_id = 2` (PEPITO ADMI), no "Sistema".
