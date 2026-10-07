# Fix: El apellido materno es obligatorio — no se puede registrar a personas sin segundo apellido
> id: fix-204-b-apellido-materno-opcional
> refs: ASG-i-034 (sospecha S12, confirmada en fix-197-b) — decisión del owner 2026-10-07: opcional
> status: done
> created: 2026-10-07

## Root Cause
[Confirmado leyendo el código el 2026-10-07.] `users.maternal_last_name` admite NULL y
`create-instructor`/`update-instructor` ya lo tratan como opcional, pero:
- Los 4 formularios (crear/editar secretaria, crear/editar instructor) lo marcan "*" y exigen
  ≥ 2 caracteres.
- `create-secretary` y `update-secretary` lo exigen en el body (400 "Faltan campos requeridos").
Una persona sin segundo apellido (p. ej. extranjeros) no se puede registrar, y una secretaria
antigua sin materno no se puede editar ni desactivar.

## ACs Afectados
Ninguno de una spec previa. ACs propios:
- **F1:** en los 4 formularios el materno es opcional: vacío es válido; si se escribe, ≥ 2 caracteres.
- **F2:** `create-secretary` y `update-secretary` aceptan el materno vacío o ausente y guardan NULL.
- **F3:** sin cambios para quien sí tiene materno.

## Cambio
- `src/app/core/utils/optional-surname.utils.ts` (+ spec) — `isOptionalSurnameValid(v)`.
- Formularios: `admin-secretarias-crear-drawer`, `admin-secretarias-editar-drawer`,
  `admin-instructor-crear-drawer`, `admin-instructor-editar-drawer` (sin "*", usan la util).
- `supabase/functions/create-secretary/index.ts`, `update-secretary/index.ts` — materno opcional → NULL.

## Test de Regresión
- `npx vitest run src/app/core/utils/optional-surname.utils.spec.ts`
- Tras el deploy: crear/editar secretaria sin materno (sin efectos: con un correo ya usado la
  función responde 409 después de validar los campos, no 400 "Faltan campos requeridos").

## Progreso
- [x] `optional-surname.utils.spec.ts` 2/2; 4 formularios sin "*" y con la util; `ng build` ✓, `lint:arch` 0 errores (182, sin nuevas).
- [x] `create-secretary` y `update-secretary`: materno opcional → NULL (el encabezado de ambas ya decía "opcional"). Sintaxis OK; lo desplegado es idéntico a `main`.
- [x] Desplegadas `create-secretary` v18 y `update-secretary` v19 (aprobado por el owner, 2026-10-07; `verify_jwt:false`, como estaban).
- [x] En vivo, como admin y SIN materno: `update-secretary` con el correo de otro usuario → 409 de correo (antes 400 "Faltan campos requeridos"); `create-secretary` con un RUT existente → 409 "Ese RUT ya está registrado como secretaria…". secretaria2 sin cambios y no se creó ninguna cuenta.
