# Fix: La lista de Alumnos de una secretaria multi-sede no reacciona al cambio de sede
> id: fix-269-m-alumnos-secretaria-multisede-cambio-de-sede
> refs: fix-264-m (bug B7), spec 0017 (grant multi-sede)
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Root Cause

`SecretariaAlumnosComponent` se escribió cuando una secretaria siempre estaba anclada a una sede:
carga la lista una vez en `ngOnInit()` y nunca pasa `showSedeColumn`. La spec `0017` agregó el
grant `can_access_both_branches`, que le da a la secretaria el selector de sede del topbar, y
`AdminAlumnosFacade` ya resuelve bien el alcance (`resolveBranchScope`), pero la pantalla quedó
sin los dos mecanismos que sí tiene la de admin:

1. el `effect()` que vuelve a cargar cuando cambia `BranchFacade.selectedBranchId()`;
2. la columna Sede cuando se ven todas las sedes.

Confirmado en navegador por `fix-264-m` (B7, caso P06 de `024a`): la secretaria multi-sede elige
otra sede y la lista sigue mostrando la anterior hasta salir de la pantalla y volver; en "Todas
las sedes" no hay columna Sede, así que no se distingue de qué sede es cada alumno.

## ACs Afectados

- Spec `0017` (multi-sede): la Base de Alumnos de secretaria queda cubierta.
- AC-1: al cambiar de sede en el selector, la lista de la secretaria multi-sede se recarga sola.
- AC-2: con "Todas las sedes" elegido se muestra la columna Sede; con una sede concreta, no.
- AC-3: una secretaria sin grant sigue viendo solo su sede, sin columna Sede.

## Cambio

- **Archivo:** `src/app/core/facades/admin-alumnos.facade.ts`
- **Qué cambia:** `showSedeColumn`: `computed()` que es `true` cuando el alcance resuelto es
  "todas las sedes".
- **Archivo:** `src/app/features/secretaria/alumnos/secretaria-alumnos.component.ts`
- **Qué cambia:** `effect()` sobre la sede elegida (reemplaza la carga única de `ngOnInit`) y
  `[showSedeColumn]="facade.showSedeColumn()"`.

## Test de Regresión

- `src/app/core/facades/admin-alumnos.facade.spec.ts > showSedeColumn — fix-269-m` ✓
- `e2e/alumnos-b-lista.spec.ts > P06 (S6)` — deja de estar marcado `knownBug` ✓

## Verificación
Verificado el 2026-10-01: `npx vitest run` (2848 tests) y `npm run lint:arch` (0 errores) en verde; `npm run test:e2e` con 58/58 esperados en dos corridas seguidas. El test E2E P06 pasa en navegador sin la marca `knownBug`.

## Nota de implementación
El `effect()` llama a `initialize()` dentro de `untracked()`. Sin eso, el effect quedaba suscrito también al usuario y a la vista Papelera, disparaba una segunda carga solapada y la tabla se dibujaba vacía un instante (medido: 3 de 4 cargas). La pantalla de admin tenía ese mismo defecto desde antes: se corrigió aparte en `hotfix-117-m`.
