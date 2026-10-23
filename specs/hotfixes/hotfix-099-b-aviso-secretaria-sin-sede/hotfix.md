# Hotfix: una secretaria sin sede asignada no puede operar
> id: hotfix-099-b-aviso-secretaria-sin-sede
> refs: ASG-i-022 (checklist 022, H07)
> status: done
> created: 2026-10-19

## Problema
Una secretaria con `users.branch_id` nulo (y sin grant multisede) entra al portal y ve todo en 0,
sin explicación. Además puede apretar cualquier botón:
- lo que exige sede (matricular, egresos, caja, vehículos) falla con un error genérico de la RLS;
- lo que la RLS acepta con sede nula (venta de servicios especiales, documentos de la escuela,
  libro de clases, pre-inscripciones) queda guardado sin sede.

Decisión del owner (2026-10-19): bloquearla con una pantalla propia. Un aviso sobre el contenido
(tarjeta y luego chip) se descartó: no evita los errores.

## Cambios
- **Archivo:** `src/app/core/utils/missing-branch.utils.ts` (+ spec): `isMissingBranch(role,
  branchId, canAccessBothBranches)` — solo secretaria, sin sede y sin grant.
- **Archivo:** `src/app/core/guards/branch-assigned.guard.ts` (+ spec): en el portal de secretaria
  (`canActivate` + `canActivateChild`) redirige a `/sin-sede`.
- **Archivo:** `src/app/features/sin-sede/sin-sede.component.ts`: pantalla "Tu cuenta no tiene una
  sede asignada" con "Cerrar sesión". Escucha su perfil en tiempo real: cuando el admin le asigna
  sede, entra sola a `/app`. Si llega alguien con sede, la manda a `/app`.
- **Archivo:** `src/app/app.routes.ts`: ruta `/sin-sede` y el guard en `secretaria`.
- **Archivo:** `src/app/layout/app-shell.component.ts`: si el admin le quita la sede con la app
  abierta, la lleva a `/sin-sede`.

## Verificación
- [x] vitest de la util y del guard (9/9); `test:ci` 4463 en verde; `lint:arch` sin errores.
- [x] e2e H07 (`auth-sesion-7.spec.ts`): sin sede cae en `/sin-sede` desde el login y desde
  cualquier ruta del portal; al asignarle sede entra sola; al quitársela con la app abierta vuelve;
  "Cerrar sesión" vuelve al login. `auth-sesion-7.spec.ts` 10/10.
