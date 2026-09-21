# Fix: Botón "Reenviar invitación" de alumno no aparece si el link de activación se quemó sin completar el primer login

> id: fix-253-m
> refs: fix-168-m, fix-169-m
> status: done
> closed: 2026-09-15
> created: 2026-09-15

## Root Cause

`admin-editar-perfil-drawer.component.ts:147` muestra el botón "Enviar invitación" solo
cuando `!facade.alumno()!.hasAuthAccount` (es decir, `supabase_uid IS NULL`). Pero el
link de invitación de Supabase (`inviteUserByEmail`) es de un solo uso: se invalida en
cuanto el alumno lo abre, incluso si cierra la ventana antes de terminar de crear su
contraseña, o si la app no estaba disponible en ese momento (caso real reportado: el
dueño abrió el link de activación con el servidor caído). En ese estado, `supabase_uid`
ya quedó seteado (`hasAuthAccount = true`) pero `first_login` sigue en `true` porque
`user_complete_first_login` (RPC que lo pone en `false`) nunca se ejecutó — el alumno
queda con la cuenta a medio activar y sin ninguna vía desde la UI para reenviarle un
link nuevo.

Este es el mismo bug que `fix-168-m`/`fix-169-m` ya corrigieron para instructores: la
condición correcta es "no tiene cuenta Auth **o** la tiene pero nunca completó el primer
login", no solo "no tiene cuenta Auth". La corrección nunca se replicó al lado de
alumnos.

## ACs Afectados

Ninguno — fix autónomo (mismo patrón que fix-168-m/fix-169-m, sin spec previa).

- AC-1: El botón "Enviar invitación" en el drawer de edición de perfil de alumno se
  muestra tanto cuando `!hasAuthAccount` como cuando `hasAuthAccount && firstLogin`.
- AC-2: El modelo `AlumnoDetalle` (`ui/alumno-detalle.model.ts`) expone `firstLogin`,
  igual que ya lo hace `InstructorTableRow`.
- AC-3: `AdminAlumnoDetalleFacade` mapea `first_login` de la fila de `users` al campo
  `firstLogin` del modelo de UI.

## Cambio

- **Archivo:** `src/app/core/models/ui/alumno-detalle.model.ts`
  — Agrega `firstLogin: boolean` junto a `hasAuthAccount`.
- **Archivo:** `src/app/core/facades/admin-alumno-detalle.facade.ts`
  — Selecciona `first_login` (si no estaba ya en el `select`) y lo mapea a `firstLogin`
  en el mismo lugar donde se arma `hasAuthAccount: !!u.supabase_uid` (línea ~530).
- **Archivo:** `src/app/features/admin/alumno-detalle/editar-perfil-drawer/admin-editar-perfil-drawer.component.ts`
  — Condición del botón pasa de `!facade.alumno()!.hasAuthAccount` a
  `!facade.alumno()!.hasAuthAccount || facade.alumno()!.firstLogin`.

## Test de Regresión

- `admin-editar-perfil-drawer.component.spec.ts` — agregar caso con
  `hasAuthAccount: true, firstLogin: true` → botón visible (hoy el spec solo cubre
  `hasAuthAccount: false` y `hasAuthAccount: true` con `firstLogin` implícito en
  `false`).
- Verificación manual: alumno con `supabase_uid` seteado y `first_login = true` (estado
  real de Andy Fernández, id 3221) → abrir su ficha → confirmar que aparece "Enviar
  invitación" → clic → confirmar que llega un nuevo correo con link válido.
