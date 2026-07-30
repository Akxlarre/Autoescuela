# Spec 0028-b — Layout responsive dual: fill-screen desktop / scroll natural móvil + densidad adaptativa por contenedor

> **Status:** done
> **Created:** 2026-07-11
> **Owner:** Akxlarre
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** Sesión de diagnóstico con Playwright del 2026-07-11 sobre `/app/admin/dashboard` (Inicio) y `/app/admin/alumnos` (Base Alumnos B).

**Persona afectada:** Admin y Secretaria (primario), cualquier rol que use la app desde el teléfono.

**Problema que resuelve:**
En desktop el layout app-like (sin scroll de página) funciona, pero en móvil ambas páginas están rotas. Diagnóstico verificado empíricamente:

1. **`contain: size` inline aplica también en móvil** (`dashboard.component.ts:125`, `live-classes-panel.component.ts:39`, `alumnos-list-content.component.ts:117`): el grid ignora la altura del contenido y las filas colapsan a `--bento-row-min: 120px`. Paneles de 118px con listas internas de 424px scrolleando en una ventana de 26px.
2. **Los pisos `min-h-[450px]`/`min-h-[300px]` están muertos:** `.bento-card { min-height: 0 }` vive en `@layer bento.components`, declarado después de `@layer utilities` de Tailwind → anula las utilities `min-h-[...]` en todo elemento `.bento-card`.
3. **Base Alumnos B móvil: contenido inaccesible.** `contain: size` + `min-height: 600px` inline + `overflow-hidden` → card congelada en 600px con 6.079px de tarjetas dentro: de 22 alumnos solo 1 es visible/alcanzable.
4. **No existe primitive de densidad:** la vista móvil renderiza TODOS los registros (la tabla desktop pagina de a 10) y no hay servicio con signal de breakpoint/tier.

**Hipótesis de valor:**
La app se vuelve usable en móvil (hoy hay datos inaccesibles) manteniendo el modo app-like desktop, con un patrón canónico reutilizable en las ~30 páginas bento del proyecto.

---

## 2. User Stories

- **US1**: Como admin/secretaria en **desktop**, quiero que Inicio y Base Alumnos B ocupen exactamente la pantalla sin scroll de página (app-like), para operar todo el día sin desplazamientos.
- **US2**: Como admin/secretaria en **móvil**, quiero que las páginas fluyan con scroll natural y cada celda mida según su contenido, para que ningún dato quede cortado o inaccesible.
- **US3**: Como admin/secretaria en **móvil**, quiero ver un resumen con menos items por lista (con "Ver todas" / "Cargar más" a mano), para no ahogarme en datos en una pantalla chica.
- **US4**: Como admin en **desktop con el drawer lateral abierto**, quiero que los paneles angostados reduzcan su densidad igual que en móvil, para que la información no quede estrujada.
- **US5**: Como desarrollador, quiero un patrón canónico del design system (clases SCSS + signal de tier de layout) reutilizable, para aplicar el mismo comportamiento al resto de las páginas bento sin CSS ad-hoc por página.

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no podés escribir un test o un check
> manual reproducible, el AC está mal formulado.

**Desktop (app-like intacto):**

- **AC1**: Given viewport 1440×900, When cargo `/app/admin/dashboard`, Then `.shell-content` no scrollea (`scrollHeight ≤ clientHeight`) y las filas del grid llenan el alto disponible (verificable con Playwright `browser_evaluate`).
- **AC2**: Given viewport 1440×900, When cargo `/app/admin/alumnos`, Then la card de la tabla llena el resto del viewport vía `bento-grid--fill-screen` (sin `min-height: 600px` inline) y `.shell-content` no scrollea.

**Móvil (scroll natural):**

- **AC3**: Given viewport 390×844, When cargo `/app/admin/dashboard`, Then ninguna celda bento tiene `contain: size` computado, ningún panel tiene scroll interno (`scrollHeight ≤ clientHeight` en sus `<ul>`) y la página completa es recorrible con el scroll de `.shell-content`.
- **AC4**: Given viewport 390×844 con datos en `/app/admin/dashboard`, Then Clases Actuales muestra máx **4** items, Actividad reciente máx **3** y Alertas máx **3**, cada lista con su botón "Ver todas" que abre el drawer correspondiente.
- **AC5**: Given viewport 390×844 en `/app/admin/alumnos` con 22 alumnos, Then se renderizan **6** tarjetas + botón "Cargar más (16 restantes)"; cada pulsación agrega 6 más hasta agotar el total — el 100% de los alumnos es alcanzable.
- **AC6**: Given búsqueda o filtros activos en móvil, When el filtro cambia, Then opera sobre el TOTAL de alumnos (no solo las tarjetas ya cargadas) y el contador de "Cargar más" se recalcula.

**Trigger por contenedor:**

- **AC7**: Given desktop 1440×900 con el layout-drawer abierto (`main` < 1024px), Then los paneles adoptan la densidad compacta (mismos límites que móvil) sin recargar la página, y al cerrar el drawer vuelven a densidad completa.

**Canon del design system:**

- **AC8**: Given el código migrado, Then no queda `contain: size` ni `min-height` de layout como estilo inline en los templates de dashboard, live-classes-panel ni alumnos-list-content (verificable por grep), y el mecanismo vive en `_bento-grid.scss` gated por `@container layoutmain (min-width: 1024px)`.
- **AC9**: Given el fix de capas CSS, Then una utility `min-h-[*]` de Tailwind aplicada junto a `.bento-card` gana la cascada (o bien la regla `min-height: 0` de `.bento-card` queda scoped solo al modo fill-screen desktop).

### Edge cases obligatorios

- **AC-E1**: Given una lista con 0 items en móvil, Then se muestra el empty-state existente con altura natural y SIN botón "Ver todas"/"Cargar más".
- **AC-E2**: Given una lista con ≤ N items (N = presupuesto del tier), Then no aparece "Cargar más" ni contador.
- **AC-E3**: Given estado loading en móvil, Then los skeletons respetan el presupuesto del tier (ej: 4 skeletons de clases, 6 de tarjetas — no los 5/6 fijos de desktop) y no generan scroll interno.
- **AC-E4**: Given un resize dinámico (rotación del teléfono o apertura/cierre del drawer), Then la densidad y el modo de layout reaccionan reactivamente sin reload (signal de tier vía ResizeObserver sobre `main`).

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.
> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ Migrar las otras ~28 páginas bento al nuevo canon (esta spec establece el patrón + 2 páginas de referencia; el rollout masivo es spec/fix aparte, como el de `[appBentoReveal]`).
- ❌ Virtual scroll o paginación server-side (los volúmenes actuales no lo justifican).
- ❌ Cambiar la paginación de la tabla PrimeNG en desktop (sigue de a 10 filas).
- ❌ Tocar facades, SWR o queries — es 100% capa de presentación.
- ❌ Rediseñar el contenido de las tarjetas móviles de alumnos (mismos campos actuales).

---

## 5. Dependencias

### Specs previas
- Ninguna (el reveal premium fix-018 y el canon bento existente se asumen como base).

### Capacidades del proyecto que se asumen existentes
- `_bento-grid.scss` v3 con container queries `layoutmain` y modificadores `--fill-screen`/`--fill-screen-2`
- `LayoutDrawerFacadeService` (drawer lateral / force-compact)
- `LayoutService` (sidebar móvil)

### Capacidades nuevas requeridas
- Signal de tier de layout basado en el ancho del contenedor `layoutmain` (mobile | tablet | desktop)
- Clases canónicas en el design system para celdas fill-screen (reemplazo del `contain: size` inline)

---

## 6. Datos y modelo (preliminar)

- Tablas nuevas / modificadas: ninguna (feature 100% frontend/CSS)
- Modelos UI nuevos: posible `LayoutTier` type
- RLS requerida: no aplica

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): Inicio (dashboard admin), Base Alumnos B (admin + secretaria comparten `alumnos-list-content`). Patrón extensible al resto de páginas bento.
- Flujo principal (happy path): desktop = app-like sin scroll de página; móvil = scroll natural con densidad reducida y acciones "Ver todas" / "Cargar más".
- Estados especiales (loading, error, vacío): skeletons existentes deben respetar la misma altura natural en móvil.

---

## 8. Métricas de éxito post-launch

- En móvil 390×844: el 100% de los alumnos de la base es alcanzable con scroll.
- En desktop 1440×900: cero scroll de página en Inicio y Base Alumnos B.

---

## 9. Notas / decisiones abiertas

Decisiones YA tomadas por el owner (sesión 2026-07-11):

- [x] Densidad móvil en listas del dashboard: **límite fijo por página + botón "Ver todas"** (abre drawer/página completa).
- [x] Base Alumnos B móvil: **N tarjetas iniciales + "Cargar más"**; buscador y filtros operan sobre el total.
- [x] Trigger de densidad: **ancho del CONTENEDOR `layoutmain`** (coherente con force-compact — drawer abierto también reduce densidad), no viewport.
- [x] Base Alumnos B desktop: **unificar a fill-screen canónico** (eliminar `min-height: 600px` inline; la tabla llena el resto del viewport).

Pendientes:

- [x] Confirmar prioridad → P1 (owner, 2026-07-11).
- [x] Presupuestos aprobados por el owner ("dele nomás", 2026-07-11): **4** clases actuales / **3** actividades / **3** alertas / **6** tarjetas de alumnos (step de 6).
- [x] Redactar US y ACs (borrador del agente 2026-07-11, aprobado por el owner).

---

## Changelog

- 2026-07-11 — draft inicial por Akxlarre (scaffold + diagnóstico; US/AC pendientes)
- 2026-07-11 — borrador de US1-US5, AC1-AC9 y edge cases AC-E1-E4 con presupuestos propuestos (agente, decisiones del owner de la misma sesión)
