# Hotfix: orden de nombre incorrecto en Pagos

## Problema
`PagosFacade` arma el nombre del alumno manualmente en 3 lugares, con orden
`nombres apellido_paterno` (y sin apellido materno, que ni siquiera se
selecciona en la query), distinto al orden canónico de Base de Alumnos
(`apellido_paterno apellido_materno nombres`, via `buildStudentDisplayName`):

- `fetchAlumnosConDeuda()` (línea ~271) → "Alumnos con saldo pendiente" (lista principal)
- `fetchPagosRecientes()` (línea ~296) → "Pagos recientes"
- `fetchEstadoCuentaResumen()` (línea ~459) → card de alumno en drawer "Registrar pago" / detalle

## Fix
- Agregar `maternal_last_name` a las 3 queries de Supabase que seleccionan `users`.
- Usar `buildStudentDisplayName()` (mismo util que Base de Alumnos) en vez de
  construir el string manualmente en los 3 mappers.

## AC
- "Alumnos con saldo pendiente" y "Pagos recientes" muestran el nombre como
  "apellido paterno apellido materno nombres", igual que Base de Alumnos.
- El card de alumno en el drawer de detalle/registrar pago también queda consistente.

## Cierre
- `PagosFacade.fetchAlumnosConDeuda()`, `fetchPagosRecientes()` y `fetchEstadoCuentaResumen()` ahora seleccionan `maternal_last_name` y usan `buildStudentDisplayName()`, igual que Base de Alumnos.
- `tsc --noEmit` limpio; `pagos.facade.spec.ts` — 6/6 tests pasan.
