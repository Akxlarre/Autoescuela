# Fix: App-like `/admin/contabilidad/liquidaciones` + `/secretaria/...`
> id: fix-019-i-app-like-liquidaciones
> refs: ASG-b-074
> status: done
> closed: 2026-08-08
> created: 2026-08-08

## Root Cause
[Heredado de ASG-b-074, a confirmar]: Paso 8 del rollout app-like
(`indices/APP-LIKE-ROLLOUT.md`). `liquidaciones-content` (shared admin+secretaria): hero +
toolbar de filtros + tabla de instructores hand-rolled **sin paginación** (muestra todo el
período del mes seleccionado). Los botones "Anterior"/"Siguiente" que tiene son navegación de
MES (`mesAnterior`/`mesSiguiente`), no de tabla — no confundir, no hay que sacar nada de ahí.

3 filas conceptuales = `--fill-screen-kpi` (no `--fill-screen` singular).

## ACs Afectados
Ninguno — fix autónomo (originado de Asignación de equipo, no de una spec).

## Cambio
1. Root → `bento-grid--fill-screen-kpi`.
2. Tabla → `bento-fill flex flex-col h-full`, wrapper `hidden md:block` →
   `flex-1 min-h-0 overflow-y-auto`.
3. Vista mobile (compact-mode / `[class.md:hidden]`) sin cambios.

Sin decisión de paginación pendiente.

Archivo principal:
`src/app/shared/components/liquidaciones-content/liquidaciones-content.component.ts`

## Test de Regresión
- `force-compact` verificado con drawer abierto (esta página ya tiene manejo de `compact-mode`
  para el drawer — verificar que no choque con `force-compact` nuevo).
- Sin `.spec.ts` nuevo obligatorio.
- `/verify` en **AMBAS rutas** (admin y secretaria — componente `shared`), 390×844, 1440×900 y
  768 de alto.

## Resultado
- Root del componente → `bento-grid--fill-screen-kpi`.
- Celda de tabla → `bento-banner bento-fill shadow-sm bg-surface overflow-hidden flex flex-col h-full`;
  wrapper desktop (`hidden md:block`) → `flex-1 min-h-0 overflow-y-auto` (scroll interno).
- Vista mobile/adaptativa sin cambios.
- `npm run lint:arch` y `npx ng build --configuration=development` verdes.
- QA visual confirmado manualmente por el usuario en ambas rutas (admin + secretaria),
  390×844, 1440×900 y 768 de alto, con drawer abierto — sin acceso a Playwright MCP en esta
  sesión para hacerlo vía agente.
