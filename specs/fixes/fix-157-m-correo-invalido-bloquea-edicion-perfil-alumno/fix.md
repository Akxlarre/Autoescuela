# Fix: Correo inválido en matrícula deja al alumno sin cuenta Auth y bloquea la corrección desde el perfil
> id: fix-157-m-correo-invalido-bloquea-edicion-perfil-alumno
> refs: —
> status: done
> closed: 2026-08-12
> created: 2026-08-12

## Root Cause
Al confirmar una matrícula, `enrollment.facade.ts` (`confirmEnrollment()` / `confirmWithPayment()`)
invoca la Edge Function `activate-student-account` en modo fire-and-forget (`.catch(err =>
console.error(...))`, sin retry ni feedback al usuario). Si el email guardado tiene un formato
inválido (ej. un símbolo extra pegado al final), `inviteUserByEmail` de Supabase Auth rechaza la
invitación por validación de formato, el error se pierde en la consola del navegador, y
`users.supabase_uid` queda en `NULL` para siempre — sin que nadie en el sistema se entere.

Consecuencia: cuando alguien intenta corregir el email desde "Editar Perfil" (drawer),
`update-student-profile/index.ts` exige encontrar un `supabase_uid` para sincronizar el cambio de
email con Auth (líneas 102-111) **antes** de guardar nada en `public.users`. Como el alumno nunca
tuvo cuenta Auth, la función devuelve 404 "No se encontró al alumno en la BD" y ni siquiera el
correo corregido llega a guardarse — el alumno queda atascado sin forma de arreglarlo desde la UI.

Caso real: alumno matriculado a Refuerzo Clase B con email `...gmail.cl|` (símbolo extra al final).

## ACs Afectados
Ninguno — fix autónomo (no hay spec previa que declare este comportamiento).

- AC-1: Si `users.supabase_uid` es `NULL`, editar el email desde el drawer de perfil actualiza
  `public.users.email` directamente, sin intentar sincronizar con Supabase Auth (no hay cuenta que
  sincronizar).
- AC-2: Tras guardar un email válido para un alumno sin cuenta Auth (`supabase_uid IS NULL`), el
  drawer ofrece una acción "Enviar invitación" que invoca `activate-student-account` para crear la
  cuenta y notificar al alumno.
- AC-3: Si `activate-student-account` falla (silencioso o no) durante la confirmación de matrícula,
  el fallo queda visible para el admin/secretaria (no solo en consola del navegador).

## Cambio
- **Archivo:** `supabase/functions/update-student-profile/index.ts`
  **Qué cambia:** si `emailChanged` y el alumno no tiene `supabase_uid`, saltar la sincronización
  con Auth y actualizar `public.users.email` directamente (sin el 404 actual).
- **Archivo:** `src/app/features/admin/.../editar-perfil-alumno-drawer` (o equivalente) + su Facade
  **Qué cambia:** agregar botón "Enviar invitación" visible cuando `supabase_uid` es `NULL`, que
  invoca `activate-student-account` (mismo flujo que ya usa `enrollment.facade.ts`).
- **Archivo:** `src/app/core/facades/enrollment.facade.ts`
  **Qué cambia:** el fallo de `activate-student-account` en `confirmEnrollment()` /
  `confirmWithPayment()` deja de ser solo `console.error` — debe quedar visible para el staff
  (ej. toast de advertencia o notificación interna), ya que hoy es indetectable hasta que alguien
  intenta editar el perfil del alumno.

## Test de Regresión
- `update-student-profile` (o su test de integración equivalente) > "actualiza el email en
  public.users cuando supabase_uid es NULL, sin llamar a Auth" ✓
- Facade/drawer del perfil > "muestra botón 'Enviar invitación' cuando supabase_uid es NULL" ✓
