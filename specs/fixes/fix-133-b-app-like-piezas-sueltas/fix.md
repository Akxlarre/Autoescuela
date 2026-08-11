# Fix: App-like: piezas sueltas (`flota/mantenimientos`, `contabilidad/cursos`, `contabilidad/anticipos`)
> id: fix-133-b-app-like-piezas-sueltas
> refs: ASG-b-077
> status: in_progress
> created: 2026-08-11

## Root Cause

[Heredado de ASG-b-077, a confirmar]: Paso 10 del rollout app-like
(`indices/APP-LIKE-ROLLOUT.md`) — 3 páginas sin relación entre sí, agrupadas por ser
candidatas sueltas de complejidad baja-media (mismo criterio que los lotes `data-llm-*`
para piezas chicas). Se pueden hacer en cualquier orden, incluso por separado.

Ninguna de las 3 sigue hoy el patrón app-like (fill-screen desktop / scroll interno):

- **`/admin/flota/:id/mantenimientos`** (`VehicleMaintenancesComponent`): orden real es
  tabla PRIMERO, `bento-square`s de "próximas fechas" DESPUÉS (0-N según data) — al revés
  del patrón KPI-row-luego-contenido del resto del DS.
- **`/admin/contabilidad/cursos`** (`AdminContabilidadCursosComponent`): hero + 1 sola
  `.bento-banner` con `<table>` hand-rolled, sin paginación.
- **`/admin/contabilidad/anticipos`** (`AdminContabilidadAnticiposComponent`): hero +
  toolbar (`.bento-banner` propia) + 2 tablas hand-rolled apiladas (cuenta corriente,
  historial), sin paginación ni tabs — son 4 filas conceptuales, no 3. Ningún
  `--fill-screen-*` cubre "hero + toolbar auto + 2 filas fill apiladas" directamente.

## ACs Afectados

Ninguno — fix autónomo (rollout de layout, no cambia contrato de negocio).

## Cambio

### 1. `/admin/flota/:id/mantenimientos`
- **Archivo:** `src/app/features/admin/flota/vehicle-maintenances/vehicle-maintenances.component.ts`
- **Qué cambia:** reordenar template — mover los `bento-square` ANTES de la tabla (para
  calzar con `--fill-screen-kpi`, auto-fill). Tabla ya tiene `p-table [paginator]="true"` →
  agregar `[scrollable]="true" scrollHeight="flex"` (mantiene paginador, patrón estándar).
  Root agrega `[class.force-compact]="layoutDrawer.isOpen()"` (ya inyectaba el drawer para
  el form de mantención).

**Ampliación de alcance (encontrada durante la implementación):** `scheduledMaintenances()`
puede venir con 0 ítems (vehículo sin `vehicle_documents`) — caso real, no hipotético. Con
el root siempre en `--fill-screen-kpi`, 0 `bento-square` hace que el auto-placement de CSS
Grid ubique la tabla en la fila 2 (`auto`) en vez de la fila 3 (`fill`); como `.bento-fill`
aplica `contain:size` sin importar en qué fila cayó, la tabla colapsaría a ~0px de alto en
desktop. Se agregó `hasScheduledMaintenances` (`computed()`) que alterna el modificador del
root: `--fill-screen-kpi` con ≥1 ítem, `--fill-screen` con 0 — así la tabla siempre cae en la
fila fill. Nuevo `.spec.ts` (3 tests) cubre las 3 combinaciones (loading, 0 ítems, ≥1 ítem).

### 2. `/admin/contabilidad/cursos`
- **Archivo:** `src/app/features/admin/contabilidad-cursos/admin-contabilidad-cursos.component.ts`
- **Qué cambia:** root → `--fill-screen` (singular), `.bento-fill` en la tabla, wrapper
  interno `flex-1 min-h-0 overflow-y-auto`. Sin decisión de paginación pendiente.
  `force-compact` ya existía en el root (sin cambios ahí).

### 3. `/admin/contabilidad/anticipos`
- **Archivo:** `src/app/features/admin/contabilidad-anticipos/admin-contabilidad-anticipos.component.ts`
- **Qué cambia:** root → `--fill-screen-2` + `[class.force-compact]="drawer.isOpen()"`
  (nuevo, el drawer ya estaba inyectado para "Registrar Anticipo"). Ambas tablas
  (Cuenta Corriente, Historial) → `.bento-fill flex flex-col h-full`, headers `shrink-0`,
  wrapper de tabla `flex-1 min-h-0 overflow-y-auto overflow-x-auto`. Nota informativa al pie
  del Historial → `shrink-0`.

**Corrección al plan heredado:** el `toolbar` `.bento-banner` propia que describía la
Asignación (verificado 2026-08-02) ya no existe en el archivo actual — el componente hoy
solo tiene 3 filas de contenido real (hero + 2 tablas), no 4. No hizo falta plegar ningún
toolbar como header fijo; `--fill-screen-2` se aplicó directo, sin la alternativa B.

**Fix de 1 línea fuera de la causa raíz, aplicado con aprobación explícita del usuario**
(preguntado antes de tocarlo, ver hallazgo abajo): en `vehicle-maintenances`, el
`<h2 class="text-base font-bold">Historial Cronológico</h2>` no tenía clase de color
explícita y heredaba `rgb(244,244,245)` (casi blanco sobre blanco, texto invisible) tanto en
1440px como en 390px — confirmado con `git diff` que la línea es preexistente, no introducida
por este fix. Se agregó `text-text-primary` (token canónico del DS). No se investigó la causa
raíz del preset/regla que lo origina, ni se tocaron los otros 3 archivos del repo con el mismo
patrón `<h2 class="text-base font-bold">` sin color explícito — posible candidato a fix propio
si reaparece.

También se agregó `flex-wrap gap-2` al mismo header (`vehicle-maintenances`): a 390px el `h2` +
badge de registros + botón "Registrar Servicio" se superponían por falta de wrap (mismo patrón
que "Segunda ampliación" de `fix-021-i`) — consecuencia directa de exponer la página a 390px
por primera vez en este rollout, dentro de la causa raíz del fix.

## Test de Regresión

- `.spec.ts` nuevo solo en `vehicle-maintenances` (decisión `hasScheduledMaintenances`,
  ver ampliación de alcance arriba) — las otras 2 páginas sin lógica de densidad nueva.
- `npx tsc --noEmit`: sin errores tras los 3 cambios.
- `npm run test:ci` (suite completa): 156 test files, 1979 tests, 0 fallos.
- `npm run lint:arch`: exit 0, 0 errores (169 warnings preexistentes, ninguno en los 3
  archivos tocados).
- `/verify` manual en navegador (`ng serve --port 4210` dedicado a este worktree — el
  `localhost:4200` ya en marcha resultó estar sirviendo otro checkout, confirmado leyendo
  `main.js` servido: no contenía `hasScheduledMaintenances` hasta apuntar al server correcto),
  logueado como admin:
  - **`/admin/flota/:id/mantenimientos`** (7 vehículos del seed, los 7 con 0 mantenciones
    programadas → ejercita el caso "ampliación de alcance" en el 100% de los casos reales,
    no solo en teoría): 1440×900 root `bento-grid--fill-screen` (correcto, no `-kpi`, sin
    `bento-square`), tabla `.bento-fill` con **577.8px reales** (no colapsada), `documentScrolls:
    false`. 390×844: header ya no se superpone (wrap confirmado), texto legible tras el fix del
    `h2`. 1440×768: sin scroll de página. `force-compact` confirmado al abrir el drawer
    "Registrar Servicio" (clase se agrega/quita en el root).
  - **`/admin/contabilidad/cursos`**: 1440×900 `bento-grid--fill-screen`, banner
    **576px reales**, sin scroll de página. 390×844: vista de cards correcta, natural scroll.
    1440×768: sin scroll de página. `force-compact` confirmado al abrir "Nuevo Curso".
  - **`/admin/contabilidad/anticipos`**: 1440×900 `bento-grid--fill-screen-2`, ambas tablas
    **278px reales cada una**, sin scroll de página. 390×844: ambas cards con scroll horizontal
    propio en la tabla ancha, nota informativa visible al pie. 1440×768: **212px cada tabla**,
    sin scroll de página. `force-compact` confirmado al abrir "Registrar Anticipo".
  - Consola: solo el `InvalidStateError` (Transition aborted) preexistente en toda la app
    (documentado en fixes previos, no relacionado). Sin errores nuevos en ninguna de las 3
    páginas.

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — filas `/admin/flota/:id/mantenimientos`,
  `/admin/contabilidad/cursos`, `/admin/contabilidad/anticipos`
- `specs/assignments/ASG-b-069-app-like-admin-auditoria.md` — precedente del "plegar
  toolbar como header fijo"
- Originado de Asignación ASG-b-077 (`specs/assignments/ASG-b-077-app-like-piezas-sueltas-flota-contabilidad.md`)
