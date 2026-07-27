# Fix: Espaciado canónico bento-grid + unificación de estilo Secretaria/Admin
> id: fix-081-m-espaciado-canonico-bento-y-unificacion-secretaria
> refs: —
> status: done
> closed: 2026-07-27
> created: 2026-07-27

## Root Cause
1. **Espacio vacío entre hero/selector y contenido inferior** (Auditoría, Instructores,
   Cuadratura, Reportes Contables): el hero en modo `slim` (o el selector de rango en
   Reportes Contables) ocupa una fila auto-generada del `.bento-grid`, cuyo
   `grid-auto-rows: minmax(var(--bento-row-min), auto)` impone un piso de 120px+
   (pensado para que los `.bento-square` luzcan cuadrados). Cuando el contenido real de
   esa primera fila mide menos que el piso (~60-90px), `align-items: stretch` estira la
   celda hasta 120px, dejando espacio vacío visible debajo de la card antes de la
   siguiente. Confirmado con Playwright en `/app/admin/auditoria`: fila del hero
   medida en 120px vs. contenido real ~60px.
2. **DMS**: el hero + tabs + `.bento-grid` de contenido no son todos hijos directos de
   un único grid — hay un wrapper `flex flex-col gap-6` envolviendo todo, y el
   `.bento-grid` de las tarjetas queda anidado dentro con su propio padding. Esto suma
   el `gap-6` del flex exterior + el padding propio del bento-grid anidado, generando
   doble espaciado entre el nav de tabs y el contenido.
3. **Instructores de Secretaria** usa una estructura distinta a la de Admin: separa los
   filtros en una celda `bento-banner` propia sin fondo `.card` (look "flotante"), en
   vez de integrarlos como toolbar dentro del mismo card de la tabla (con
   dual-viewport / vista de tarjetas en mobile) como hace Admin.
4. **Comunicación/Observaciones de Secretaria** usa la variante
   `bento-grid--fill-screen-kpi` con los KPIs en celdas `.bento-square` separadas,
   mientras el equivalente de Admin (`admin-tareas`) usa `bento-grid--fill-screen` con
   los KPIs embebidos dentro del propio `app-section-hero` vía `[kpis]`.

## ACs Afectados
Ninguno — fix autónomo (corrección visual/estructural, no cubre un AC de spec previa).

## Cambio
- **Archivo:** `src/styles/layout/_bento-grid.scss`
  **Qué cambia:** agrega dos modificadores opt-in:
  - `.bento-grid--hero-fit` fija `grid-template-rows: auto` para que solo la 1ª
    fila (hero/selector) se ajuste a su contenido real, sin tocar el piso de las
    filas auto-generadas siguientes (necesario cuando el grid tiene
    `.bento-square`/`.bento-tall`/`.bento-feature` en filas posteriores).
  - `.bento-grid--rows-fit` fija `grid-auto-rows: auto` para TODAS las filas —
    reservado para grids compuestos enteramente por `.bento-banner` (sin celdas
    cuadradas), donde el piso de 120px no cumple ningún propósito. Necesario en
    Reportes Contables porque ahí la fila corta es la 2ª (barra de filtros), no
    la 1ª (confirmado con Playwright: fila de filtros medida en 120px vs.
    contenido real ~60px).
- **Archivos:** `admin-auditoria.component.ts`, `admin-instructores.component.ts`,
  `secretaria-instructores.component.ts`, `cuadratura-content.component.ts`
  **Qué cambia:** agregan la clase `bento-grid--hero-fit` al contenedor raíz.
- **Archivo:** `reportes-contables-content.component.ts`
  **Qué cambia:** agrega la clase `bento-grid--rows-fit` al contenedor raíz (grid
  100% banner, sin celdas cuadradas).
- **Archivo:** `secretaria-instructores.component.ts`
  **Qué cambia:** reemplaza su estructura por la de `admin-instructores.component.ts`
  (toolbar de filtros integrado al card de la tabla + dual-viewport mobile).
- **Archivo:** `secretaria-observaciones.component.ts`
  **Qué cambia:** alinea su estructura a la de `admin-tareas.component.ts`
  (`bento-grid--fill-screen` + KPIs embebidos en el hero, sin celdas `.bento-square`
  sueltas).
- **Archivo:** `dms-list-content.component.ts`
  **Qué cambia:** elimina el wrapper `flex flex-col gap-6` externo; hero, nav de tabs
  y contenido pasan a ser hijos directos de un único `.bento-grid` raíz.

## Test de Regresión
- Verificación visual manual vía Playwright MCP (antes/después) en las vistas
  afectadas — no aplica test unitario (cambio de estructura de template/CSS puro).
  Verificado con navegador real (rol Admin):
  - `/app/admin/auditoria`: gap hero→filtros eliminado (120px → 62px medido).
  - `/app/admin/instructores`: gap hero→tabla eliminado.
  - `/app/admin/contabilidad/cuadratura`: gap header→columnas eliminado.
  - `/app/admin/contabilidad/reportes`: gap selector→cards eliminado (120px → ~60px
    medido en fila de filtros vía `bento-grid--rows-fit`).
  - `/app/admin/documentos` (DMS): gap tabs→contenido eliminado.
  - Secretaria (Instructores y Observaciones) no se pudo abrir en vivo en esta
    sesión (guard de rol bloquea `/app/secretaria/*` logueado como Admin); ambos
    componentes se reescribieron como réplica estructural exacta de su
    equivalente ya verificado en Admin.
- `npx tsc --noEmit -p tsconfig.app.json`: sin errores.
- `npm run lint:arch`: 0 errores (165 advertencias pre-existentes, ninguna nueva).
