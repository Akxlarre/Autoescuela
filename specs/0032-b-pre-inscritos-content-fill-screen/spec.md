# Spec 0032-b — Pre-inscritos: content unificado + app-like fill-screen

> **Status:** done
> **Created:** 2026-07-16
> **Owner:** Akxlarre
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** iniciativa interna — continuación de la campaña de consolidación + app-like (specs 0028–0031).

**Persona afectada:** Admin y Secretaria (revisión de pre-inscripciones online de Clase Profesional).

**Problema que resuelve:**
Pre-inscritos es la última página del área profesional que quedó **sin migrar** al patrón de Dumb `*-content` compartido. Hoy existen **dos Smart Components ~95% duplicados** (`admin-pre-inscritos` y `secretaria-alumnos-pre-inscritos`) con el buscador y la tabla inline, en **dos cards separados**. Todo cambio hay que hacerlo dos veces (deuda + riesgo de divergencia). Además la vista no es app-like: el buscador+tabla empujan el documento en lugar de ocupar la pantalla con scroll interno.

**Hipótesis de valor:**
Una sola fuente de verdad (`pre-inscritos-content`) elimina la duplicación y, con el layout fill-screen, el revisor ve más registros sin scroll de página.

---

## 2. User Stories

- **US1**: Como Admin, quiero revisar los pre-inscritos en una vista app-like (pantalla completa en desktop, scroll interno de la tabla) para procesar más registros sin scroll de documento.
- **US2**: Como Secretaria, quiero exactamente la misma experiencia de pre-inscritos que el Admin (sin la columna Sede) para consistencia, sin mantener un componente duplicado.
- **US3**: Como desarrollador, quiero un único `pre-inscritos-content` (buscador + tabla en un solo card) consumido por ambos portales, para eliminar el ~95% de duplicación.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given la ruta de pre-inscritos de admin, When se renderiza, Then el buscador **y** la tabla viven en **un solo card** dentro de un nuevo Dumb `app-pre-inscritos-content` (Dumb en `shared/components/`, sin inyectar Facades).
- **AC2**: Given ambas rutas (`/app/admin/...` y `/app/secretaria/...`), When se renderizan, Then ambas usan el **mismo** `<app-pre-inscritos-content>`; los templates inline duplicados de ambos Smart Components se eliminan y cada Smart solo cablea inputs/outputs + drawer + facade.
- **AC3**: Given un viewport desktop (tier por CONTENEDOR = desktop), When se abre la página, Then ocupa 100vh **sin** scroll del documento y la tabla scrollea internamente (reusa `.bento-grid--fill-screen-kpi` + `.bento-fill`). En móvil revierte a scroll nativo.
- **AC4**: Given más filas que el tamaño de página, Then la lista se **pagina** con el `<p-paginator>` de PrimeNG (mismo look que Base Alumnos B: "Mostrando X a Y de Z"), rindiendo **solo la página actual** en el DOM (no sobrecarga). Tamaño de página adaptativo: 12 en desktop, 6 en móvil. Pagina tanto la tabla (desktop) como las cards (móvil).
- **AC5**: Given el portal admin, Then la columna **Sede** aparece (`showSede=true`); Given secretaría, Then **no** aparece.
- **AC6**: Given una fila, When el usuario hace click en ella o en el botón "ojo", Then el content emite `rowSelected` y el Smart Component abre `AdminPreInscritoDrawerComponent` (comportamiento actual preservado en ambos portales).
- **AC7**: Given cero cambios de estilos globales, Then el diff de `src/styles/**` está **vacío** (no se crea SCSS nuevo; se reusan modificadores existentes y utilities Tailwind + tokens).
- **AC8**: Given móvil/tablet (tier por CONTENEDOR ≠ desktop), Then cada pre-inscrito se muestra como **card canónica** (avatar con iniciales + datos clave + acción "ver"), no como fila de tabla; Given desktop, Then **tabla**. El switch es por contenedor (`isDesktopLayout()`), NO por `md:` de viewport (para apilar/compactar con el drawer abierto — trampa de spec 0030).

### Edge cases obligatorios

- **AC-E1**: Given el drawer abierto (contenedor angosto), When cambia el tier, Then el switch de layout/densidad usa el tier por CONTENEDOR (`isDesktopLayout() = maxVisible() === null`), **no** `lg:` de Tailwind → la vista se comporta como en móvil sin recortar.
- **AC-E2**: Given 0 resultados tras filtrar y given estado de carga, Then el content muestra el empty-state y los skeletons fieles al layout, dentro del mismo componente.

---

## 4. Out of scope

- ❌ Cambiar `AdminPreInscritosFacade`, sus queries o el modelo de datos.
- ❌ Cambiar `AdminPreInscritoDrawerComponent` (el drawer de detalle).
- ❌ Cambios de BD, RLS o migraciones.
- ❌ Migrar otras páginas del sistema.
- ❌ Cambiar la lógica de negocio de estados/psychResult/vencimiento (solo se mueve de lugar).

---

## 5. Dependencias

### Specs previas
- 0028 (layout dual + densidad), 0029 (patrón de consolidación `*-content` + `.bento-grid--fill-screen-kpi`), 0031 (host como celda `.bento-fill`, `isDesktop` por contenedor). Todas `done`.

### Capacidades del proyecto que se asumen existentes
- `AdminPreInscritosFacade` (`preInscritos()`, `total()`, `pendientesTest()`, `aprobados()`, `isLoading()`, `initialize()`, `select()`, `resetPromocionesCache()`).
- `LayoutService.tier()` + `core/utils/layout-tier.utils.ts` (`sliceByBudget`).
- Modificadores CSS `.bento-grid--fill-screen-kpi` y `.bento-fill`; `app-section-hero`, `app-empty-state`, `app-skeleton-block`.
- Modelo `PreInscritoTableRow`.

### Capacidades nuevas requeridas
- Nuevo Dumb `app-pre-inscritos-content` en `shared/components/pre-inscritos-content/` + su `.spec.ts`.

---

## 6. Datos y modelo (preliminar)

- Tablas nuevas / modificadas: **ninguna**.
- Modelos UI nuevos: ninguno (reusa `PreInscritoTableRow`). Posible tipo local de opciones de filtro.
- RLS requerida: ninguna.

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): pre-inscritos admin y secretaría.
- Flujo principal: hero (con KPIs) → card único [toolbar de filtros: buscar por nombre/RUT + select estado + select clase + contador] → tabla fill-screen con scroll interno → click fila abre drawer.
- Estados especiales: loading (skeletons), vacío (empty-state con "limpiar filtros"), drawer abierto (layout por contenedor).
- Diferencias por portal: columna Sede (solo admin), `backRoute`/`basePath`, y el `effect()` de recarga por sede (queda en el Smart de admin).

---

## 8. Métricas de éxito post-launch

- LOC duplicadas eliminadas (2 templates → 1 componente).
- 0 errores de consola en `/verify` (ambos portales, dark + light).

---

## 9. Notas / decisiones abiertas

- [x] **Hero KPIs** → los recibe como **input** desde el Smart (que los toma del facade), para no divergir. (Aprobado por owner 2026-07-16.)
- [x] **Estado de filtros** → **local en el Dumb** (como `alumnos-profesional-list-content`), testeable sin Facade. (Aprobado por owner 2026-07-16.)

---

## Changelog

- 2026-07-16 — draft inicial por Akxlarre (redactado por el agente sobre precedente 0029/0031, pendiente de aprobación del owner).
- 2026-07-16 — **approved** por el owner. Decisiones §9 cerradas (KPIs por input, filtros locales en el Dumb). Prioridad P1.
- 2026-07-16 — fix de redacción AC4 (desktop/móvil estaban cruzados) para reflejar el comportamiento acordado. Sin cambio de scope.
- 2026-07-16 — **ampliación de scope aprobada por el owner**: AC4 pasa de densidad+"Cargar más" a **paginación** (prev/next, 12 desktop / 6 móvil, no sobrecargar); nuevo **AC8** = cards canónicas responsive en móvil (switch por contenedor). Motivo: evitar tabla apretada en móvil + limitar render.
- 2026-07-17 — a pedido del owner (consistencia con Base Alumnos B), la paginación pasa de barra manual prev/next al **`<p-paginator>` de PrimeNG** (manejado por el estado local, pagina tabla y cards). Sin cambio de scope.
- 2026-07-17 — **cerrada (done)** por el owner ("cerramos"). Visto bueno visual dado → AC3 y AC-E1 confirmados. Veredicto ✅ PASA. Ver acceptance.md.
