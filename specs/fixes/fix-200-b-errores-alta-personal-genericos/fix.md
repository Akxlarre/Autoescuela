# Fix: Crear instructor, crear/editar secretaria y reenviar invitación muestran un error genérico
> id: fix-200-b-errores-alta-personal-genericos
> refs: ASG-i-034 (sospecha S6 —parte front—, confirmada en fix-197-b) · DG-085 · fix-029-i
> status: done
> created: 2026-10-07

## Root Cause
[Confirmado leyendo el código el 2026-10-07.] `functions.invoke()` devuelve, ante un no-2xx, un
error cuyo `.message` es "Edge Function returned a non-2xx status code"; lo que la función
respondió queda en `error.context` (DG-085). `fix-029-i` lo resolvió solo para **Editar
instructor**. En `InstructoresFacade.crearInstructor()`, `enviarInvitacion()` y en
`SecretariasFacade.crearSecretaria()` / `editarSecretaria()` el error se re-envuelve en
`new Error(sanitize(error).message)` y el toast muestra un texto genérico en vez de "Ya existe un
usuario con ese correo electrónico", "Ese RUT ya está registrado…", "No se puede registrar un
instructor con licencia vencida" o "No puedes crear instructores en otra sede" (fix-198/199-b).

## ACs Afectados
Ninguno de una spec previa. ACs propios (mismo criterio que `admin-alumno-detalle`):

- **F1:** si la función responde 4xx con `{ error }`, el toast muestra ese mensaje.
- **F2:** si responde 5xx (o no hay respuesta), se muestra el mensaje genérico de cada acción (un
  5xx puede traer texto técnico de Postgres).
- **F3:** sin cambios en el camino feliz.

## Cambio
- `src/app/core/utils/edge-function-error.utils.ts` (+ spec) — `edgeFunctionUserMessage(err, fallback)`.
- `src/app/core/facades/instructores.facade.ts`, `secretarias.facade.ts` (+ specs) — lo usan en
  crear/reenviar y crear/editar.

## Test de Regresión
- `npx vitest run src/app/core/utils/edge-function-error.utils.spec.ts src/app/core/facades/instructores.facade.spec.ts src/app/core/facades/secretarias.facade.spec.ts`

## Resultado (2026-10-07)
- Vitest de los 3 specs: 37/37 (8 nuevos; los 5 de los facades en rojo antes del cambio).
- `npm run test:ci` 3426 ✓, `ng build` ✓, `lint:arch` 0 errores.
