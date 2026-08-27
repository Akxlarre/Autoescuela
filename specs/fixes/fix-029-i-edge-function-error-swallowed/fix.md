# Fix: Error real de Edge Function se pierde al editar un instructor (email duplicado sin feedback)

> id: fix-029-i-edge-function-error-swallowed
> refs: docs/UAT-PLAN.md (Paquete 6, caso "Editar email de un usuario (alumno/instructor/secretaria)
>   a uno ya usado por otro → debe rechazar sin desincronizar Auth/tabla pública")
> status: done
> closed: 2026-08-27
> created: 2026-08-27

## Root Cause

`InstructoresFacade.editarInstructor()` (`src/app/core/facades/instructores.facade.ts:600-651`)
invoca el Edge Function `update-instructor` con `this.supabase.client.functions.invoke(...)`.
Cuando el Edge Function responde con status no-2xx (ej. 500 por email duplicado —
`supabase/functions/update-instructor/index.ts:194`, `errorResponse('Error al actualizar
usuario: ' + err.message, 500)`), el SDK de Supabase retorna `data: null` y un `error` de tipo
`FunctionsHttpError` cuyo **`.message` es genérico**: `"Edge Function returned a non-2xx status
code"`. El body real de la respuesta (`{"error":"...duplicate key value violates unique
constraint \"users_email_key\""}"`) queda **sin leer**, disponible solo vía
`error.context.json()` (donde `context` es el `Response` crudo).

El código original hacía:
```typescript
if (error)
  throw new Error(this.sanitizer.sanitize(error).message ?? 'Error al actualizar instructor');
```

`ErrorSanitizerService.sanitize()` no reconoce `FunctionsHttpError` — su chequeo de HTTP es
`error?.name === 'HttpErrorResponse'` (el nombre que usa `HttpErrorResponse` de Angular, no el
de Supabase Functions), y `error?.code` no existe en un `FunctionsHttpError`. Cae al `catch`
genérico (`error instanceof Error` sí, pero `error.constructor.name === 'FunctionsHttpError'
!== 'Error'`), así que retorna el mensaje por defecto: *"Ha ocurrido un error inesperado. Por
favor, intenta de nuevo."*

**Verificado en vivo (UAT + probe con `@supabase/supabase-js` directo, 2026-08-27):** al
editar un instructor con un email ya usado por otro usuario, `functions.invoke()` retorna
`data: null`, `error.name === 'FunctionsHttpError'`, `error.message === 'Edge Function returned
a non-2xx status code'`, `error.context.status === 500` y `await error.context.json()` →
`{"error":"Error al actualizar usuario: duplicate key value violates unique constraint
\"users_email_key\""}`. El toast de error mostrado al usuario (`this.toast.error('Error', msg)`)
usaba el mensaje genérico del sanitizer en vez de ese mensaje real — en la sesión de UAT en vivo
esto se percibió como **ausencia total de feedback** (el mensaje genérico repetido no fue
visible en las capturas tomadas, agravando el problema, aunque el código sí lo invocaba).

**Alcance de la corrección:** se corrige puntualmente `editarInstructor()`, el caso reportado en
UAT. El mismo patrón (`functions.invoke()` sin leer `error.context` en un fallo no-2xx) existe
en otros ~29 archivos que llaman `functions.invoke()` en el proyecto — queda fuera de alcance
de este fix (ver DOMAIN-GOTCHAS DG-085 para el criterio de aplicabilidad al tocar cualquiera de
esos call sites a futuro).

## ACs Afectados

- Ninguno de una spec formal — fix autónomo descubierto en `docs/UAT-PLAN.md` Paquete 6.

## Cambio

- **Archivo:** `src/app/core/facades/instructores.facade.ts`
- **Qué cambia:** `editarInstructor()` ahora relanza el `error` original (no un `Error`
  re-envuelto con el mensaje genérico del sanitizer) para que el `catch` pueda inspeccionarlo.
  Nuevo método privado `resolveEditarInstructorErrorMessage()` — si el error trae
  `.context` (un `Response`), lee su body JSON; si el mensaje contiene
  `users_email_key` devuelve un mensaje de negocio claro ("ya existe otro usuario con ese
  correo"), si no, usa el `body.error` textual; si no hay `.context` parseable, cae al
  `ErrorSanitizerService` como antes.

## Test de Regresión

- `src/app/core/facades/instructores.facade.spec.ts` — nuevo caso: `editarInstructor()` con
  un `FunctionsHttpError` simulado (con `.context.json()` retornando el body de duplicate-key)
  produce el mensaje de negocio esperado vía `toast.error`, no el genérico.
