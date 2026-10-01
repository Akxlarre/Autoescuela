# Fix: "Editar Perfil" del alumno muestra un error genérico cuando el email ya está en uso
> id: fix-268-m-editar-perfil-alumno-error-real-edge-function
> refs: fix-264-m (bug B17), fix-029-i
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Root Cause

`AdminAlumnoDetalleFacade.actualizarPerfilAlumno()` llama a la edge function
`update-student-profile` y, si falla, hace
`throw new Error(this.sanitizer.sanitize(error).message ?? '…')`.

Cuando la función responde con un status no-2xx, `functions.invoke()` devuelve un
`FunctionsHttpError` cuyo `.message` es siempre "Edge Function returned a non-2xx status code".
El mensaje real queda sin leer en `error.context` (el `Response` crudo), y
`ErrorSanitizerService` no reconoce ese tipo de error, así que el usuario ve "Ha ocurrido un
error inesperado. Por favor, intenta de nuevo." Es la trampa documentada en DG-085; `fix-029-i`
la corrigió solo para instructores.

Confirmado en navegador por `fix-264-m` (B17, caso M02 de `024b`): al poner el email de otro
usuario, el drawer muestra el mensaje genérico y no se entiende qué hay que corregir.

La función responde ese caso de dos maneras:
- alumno **con** cuenta Auth → `409` "Ya existe un usuario con ese correo electrónico";
- alumno **sin** cuenta Auth → `500` "Error al actualizar el alumno: duplicate key value
  violates unique constraint \"users_email_key\"" (el caso reproducido por el test E2E).

## ACs Afectados

Ninguno de una spec previa. Fix autónomo.

- AC-1: con un email ya usado por otro usuario, el drawer muestra "Ya existe otro usuario
  registrado con ese correo electrónico.", tenga o no cuenta Auth el alumno.
- AC-2: los demás rechazos de negocio de la función (status 4xx) muestran el mensaje que la
  función envió.
- AC-3: un fallo interno (5xx) que no sea el email duplicado sigue mostrando el mensaje
  genérico: no se exponen textos técnicos de Postgres al usuario.

## Cambio

- **Archivo:** `src/app/core/utils/edge-function-error.utils.ts` (nuevo)
- **Qué cambia:** `readEdgeFunctionError()` lee status y mensaje del body de un
  `FunctionsHttpError`.
- **Archivo:** `src/app/core/facades/admin-alumno-detalle.facade.ts`
- **Qué cambia:** `actualizarPerfilAlumno()` usa ese mensaje según AC-1…AC-3.

No se toca la edge function (`ASG-i-043`, de Benjamín, la tiene abierta) ni
`InstructoresFacade` (su copia local de esta lógica queda como está).

## Test de Regresión

- `src/app/core/utils/edge-function-error.utils.spec.ts` ✓
- `src/app/core/facades/admin-alumno-detalle.facade.spec.ts > actualizarPerfilAlumno` ✓
- `e2e/alumnos-b-ficha.spec.ts > M02 (S8)` — deja de estar marcado `knownBug` ✓

## Verificación
Verificado el 2026-10-01: `npx vitest run` (2848 tests) y `npm run lint:arch` (0 errores) en verde; `npm run test:e2e` con 58/58 esperados en dos corridas seguidas. El test E2E M02 pasa en navegador sin la marca `knownBug` (caso: alumno sin cuenta Auth, respuesta 500 con `users_email_key`). El caso 409 (alumno con cuenta Auth) está cubierto solo por test unitario.
