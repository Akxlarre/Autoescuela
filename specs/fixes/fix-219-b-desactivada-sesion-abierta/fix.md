# Fix: Una secretaria desactivada con la sesión abierta sigue dentro, viendo todo vacío
> id: fix-219-b-desactivada-sesion-abierta
> refs: ASG-i-034 (checklist 034, caso M05) — completa fix-180-b (F4)
> status: done
> created: 2026-10-10

## Root Cause
[Confirmado el 2026-10-10 con `e2e/personal-dos-sesiones.spec.ts`: admin y secretaria2 abiertos a la vez.]
Al desactivar a una secretaria, fix-180-b corta bien en el servidor (`auth_user_role()` es NULL y
Auth queda baneado), pero su pantalla abierta no se entera:

- La policy `select_users` depende del rol en todas sus ramas. Sin rol, la persona **no puede leer
  ni su propia fila** de `users`.
- Por eso el evento de tiempo real de su fila (canal `user-self`, el mismo que trae en vivo el
  cambio de sede y el grant multi-sede) no le llega: Realtime solo entrega filas que el usuario
  puede leer.
- Y si recarga, el perfil vuelve sin fila → `isActive` queda `undefined`, no `false`, y el
  `authGuard` (F4 de fix-180-b) no la saca.

Resultado medido: 20 s después de desactivarla sigue en `/app/secretaria/instructores`; navega a
Base Alumnos y ve "Aún no hay alumnos", sin ningún aviso. Así hasta que venza su token (hasta 1 h).

## ACs Afectados
- fix-180-b **F4** ("si el perfil cargado tiene `isActive === false`, el guard cierra la sesión"):
  hoy no se cumple porque el perfil de un inactivo nunca llega a cargarse.

ACs propios:
- **F1:** Given una secretaria (o instructor) con la app abierta, When el admin la desactiva, Then en
  segundos y sin recargar ve "Tu cuenta fue desactivada. Contacta al administrador." y queda en el login.
- **F2:** un usuario inactivo puede leer **solo su propia fila** de `users` (nada más: ninguna otra
  fila ni tabla cambia). Los activos leen exactamente lo mismo que antes.
- **F3:** un cambio que no desactiva (sede, grant) sigue sin cerrar la sesión.

## Cambio
- `supabase/migrations/20261010120000_fix219_users_lectura_fila_propia.sql` — `select_users` suma
  `OR id = (SELECT auth_user_id())` para cualquier autenticado (`auth_user_id()` no mira `active`).
  El resto de la policy queda igual que en spec 0049-b. **Requiere aplicar** (aprobación del owner).
- `src/app/core/facades/auth.facade.ts` (+ spec) — `refreshProfile()`: si el perfil recargado viene
  con `isActive === false`, avisa con un toast y cierra la sesión.

## Test de Regresión
- `npx vitest run src/app/core/facades/auth.facade.spec.ts`
- `supabase/tests/rls/fix-180-b-usuario-inactivo.sql` (actualizado) — F2, impersonando, sin efectos.
- `npx playwright test e2e/personal-dos-sesiones.spec.ts --workers=1` — M05 (y N01, N02, M04).

## Progreso
- [x] vitest rojo → verde: `auth.facade.spec.ts` 34/34 (+2). `ToastService` se resuelve al usarlo (inyectarlo de entrada rompía 32 tests que arman el facade sin `MessageService`).
- [x] Migración + test SQL en transacción con ROLLBACK: `fix-180-b-usuario-inactivo.sql` (actualizado: la inactiva lee 1 usuario, el propio, y 0 ajenos) rojo contra producción → verde; `0049-b` verde; admin, 3 secretarias, instructor y alumno leen las mismas filas antes y después (302/114/198/302/1/1).
- [x] Migración aplicada (aprobada 2026-10-10) y registrada en `schema_migrations`. `fix-180-b-usuario-inactivo.sql` verde contra producción; `0049-b`: 9 casos ok (la fila "info … antes → después" marca FALLA porque compara contra el estado previo a 0049-b y hoy da 198 = 198: es informativa, no una regresión).
- [x] `e2e/personal-dos-sesiones.spec.ts` 3/3 (N01+N02, M04, M05): a la secretaria desactivada le aparece el aviso y queda en `/login` sin tocar nada. secretaria2 restaurada (sede 2, activa, sin grant, sin ban).
- Nota: `npm run test:ci` 3788/3789; el que falla (`instructor-clases.facade.spec.ts` › openEvaluacionDrawer, timeout 5 s) falla igual sin este cambio.
