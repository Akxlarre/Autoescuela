# Spec 0030-b — Asistencia B: layout dual (fill-screen desktop / scroll móvil) + densidad adaptativa

> **Status:** done
> **Created:** 2026-07-12
> **Owner:** Akxlarre
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** Continuación del rollout de la spec 0028 (layout responsive dual) y 0029 (Comunicaciones). Control de Asistencia Clase B es la siguiente página del rollout; a diferencia de Comunicaciones, la consolidación multi-rol ya existe (`asistencia-clase-b-content` compartido por Admin y Secretaria), pero la página no tiene modo fill-screen ni presupuesto de densidad móvil.

**Persona afectada:** Admin y Secretaria (operación diaria de asistencia de prácticas y ciclos teóricos).

**Problema que resuelve:**
Hoy `/app/admin/asistencia` y `/app/secretaria/asistencia` scrollean con la página en desktop (el grid no tiene ningún modificador `--fill-screen`), inconsistente con Inicio, Base Alumnos B y Comunicaciones ya migradas. En móvil la tabla de prácticas renderiza TODAS las filas del día sin tope de densidad (`@for` sobre `filteredPracticas()` completo); una sede con uso real (decenas de prácticas/día) produce un scroll largo sobre una tabla de 9 columnas que ya exige scroll horizontal. Además, las alertas de faltas consecutivas — que traen acciones urgentes (eliminar/reactivar horario) — scrollean fuera de vista junto con el resto del contenido.

**Hipótesis de valor:**
Mismo valor que 0028/0029: desktop app-like consistente + protección de densidad móvil antes de que el volumen real la rompa, logrado **sin agregar SCSS nuevo al grid** (se reutiliza `--fill-screen-kpi`).

---

## 2. User Stories

- **US1**: Como admin/secretaria en **desktop**, quiero que el tab Prácticas sea app-like (sin scroll de página; la tabla scrollea internamente), para operar la asistencia del día con la misma ergonomía que Inicio y Base Alumnos B.
- **US2**: Como admin/secretaria en **desktop**, quiero que las alertas de faltas consecutivas queden siempre visibles sobre la tabla (pinned), para que las acciones urgentes (eliminar/reactivar horario) no se escondan al scrollear.
- **US3**: Como admin/secretaria en **móvil**, quiero ver un número acotado de clases prácticas con un botón "Cargar más", para no enfrentar una tabla sin fin en pantalla chica.
- **US4**: Como desarrollador, quiero lograr el modo dual reutilizando `--fill-screen-kpi`, `.bento-fill` y `visibleWithLoadMore()` ya existentes (cero modificadores SCSS nuevos), para no ampliar la superficie de mantenimiento del grid ni repetir la trampa de los dos bloques (0029).

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no podés escribir un test o un check
> manual reproducible, el AC está mal formulado.

- **AC1**: Given desktop 1440×900 con el tab **Prácticas** activo y datos cargados, When se renderiza la página (admin o secretaria), Then `.shell-content` no scrollea y la celda protagonista (`.bento-fill`) llena el resto del viewport bajo hero + fila de tabs (`bento-grid--fill-screen-kpi`, canon 0028/0029); el scroll vive dentro del card de la tabla.
- **AC2**: Given desktop 1440×900 con el tab **Ciclos Teóricos** activo, When se renderiza, Then el grid NO tiene el modificador fill-screen y la página scrollea natural (como hoy) — el modificador se aplica condicional por tab.
- **AC3**: Given desktop con alertas de faltas consecutivas presentes y más filas de tabla que el alto disponible, When se scrollea la tabla internamente, Then las alertas permanecen visibles (pinned dentro de la celda fill, fuera del área scrolleable) y el `thead` de la tabla queda sticky.
- **AC4**: Given la implementación terminada, When se revisa el diff, Then `_bento-grid.scss` no tiene cambios (cero modificadores nuevos; el grid queda siempre en 3 filas: hero / tabs / fill, con lo condicional dentro de la celda fill).
- **AC5**: Given móvil 390×844 con más clases prácticas que el presupuesto del tier, When se carga el tab Prácticas, Then la tabla muestra un número acotado de filas (propuesta: 6; número final a validar en plan.md con altura real medida) + botón "Cargar más" que incrementa en pasos del mismo tamaño (`visibleWithLoadMore()`).
- **AC6**: Given un contador de "Cargar más" ya incrementado, When cambia cualquier filtro (estado, instructor), la fecha seleccionada o el tab activo, Then los filtros operan sobre el total de filas y el contador se resetea al presupuesto base (canon Base Alumnos B / util tab-scoped de la 0029).
- **AC7**: Given desktop con un drawer lateral abierto (contenedor `<main>` angostado), When el tab Prácticas está activo, Then la densidad reacciona según `LayoutService.tier()` por contenedor (mismo mecanismo 0028), sin recarga.
- **AC8**: Given el canon Dumb estricto, When se revisa `asistencia-clase-b-content`, Then NO inyecta `LayoutService`: el presupuesto llega resuelto por input (`maxVisible` o equivalente) desde los dos Smarts (admin y secretaria), y ambas rutas se comportan igual.

### Edge cases obligatorios

- **AC-E1**: Given cero clases prácticas para la fecha/filtros seleccionados, Then se muestra el mensaje vacío actual, sin botón "Cargar más".
- **AC-E2**: Given menos filas que el presupuesto del tier, Then no aparece "Cargar más".
- **AC-E3**: Given estado loading, Then los skeletons respetan el presupuesto del tier y, en desktop con tab Prácticas, no provocan scroll de página (el fill se mantiene durante la carga).
- **AC-E4**: Given móvil (bajo lg), When hay alertas presentes, Then alertas + tabla apilan verticalmente con scroll nativo de página (la reestructuración flex-col de la celda fill no altera el flujo móvil).
- **AC-E5**: Given la reestructuración del template, When se abre el modal de justificación o los drawers Iniciar/Finalizar clase desde una fila, Then funcionan exactamente igual que antes (guardia de regresión de acciones).

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.
> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ Rediseño del tab Ciclos Teóricos (master-detail, fill-screen interno) — conserva scroll natural; si se quiere app-like, es spec aparte.
- ❌ Cards móviles o poda de columnas por tier en la tabla de prácticas — se mantiene `overflow-x-auto` (decisión del owner 2026-07-12).
- ❌ Paginación/`.limit()` server-side en `AsistenciaClaseBFacade` — el recorte es 100% client-side (mismo patrón que Base Alumnos B y 0029).
- ❌ Cambios de BD, RLS o modelos DTO.
- ❌ Cambios funcionales a las acciones (iniciar/finalizar/justificar/marcar ausente/alertas) — esta spec es solo layout y densidad.
- ❌ Limpieza de las clases `.bento-banner` muertas dentro de `ciclos-teoricos-content` (viven en un flex, no en el grid) — cosmética sin efecto; hotfix aparte si molesta.

---

## 5. Dependencias

### Specs previas
- 0028 (layout responsive dual — `done`): canon `.bento-fill`, `LayoutService.tier()`, `sliceByBudget`
- 0029 (Comunicaciones — `done`): modificador `.bento-grid--fill-screen-kpi`, util `visibleWithLoadMore()`

### Capacidades del proyecto que se asumen existentes
- `AsistenciaClaseBContentComponent` (Dumb compartido Admin/Secretaria) + `CiclosTeoricosContentComponent`
- `AsistenciaClaseBFacade`, `CiclosTeoricosFacade`, `BranchFacade`
- `LayoutService.tier()` registrado en `AppShellComponent`
- `core/utils/layout-tier.utils.ts` (`widthToTier`, `sliceByBudget`, `visibleWithLoadMore`)

### Capacidades nuevas requeridas
- Ninguna de infraestructura. Solo reestructura del template del Dumb (aplanar el doble wrapper `div.bento-banner > section.bento-banner.card` de alertas y tabla para que la celda fill sea hija directa del grid — requisito del modo dual) + wiring de `maxVisible` en los dos Smarts.

---

## 6. Datos y modelo (preliminar)

> No toca persistencia. Cambios solo de presentación/layout.

- Tablas nuevas / modificadas: ninguna
- Modelos UI nuevos: ninguno previsto
- RLS requerida: n/a

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): `/app/admin/asistencia`, `/app/secretaria/asistencia` (ambas renderizan `asistencia-clase-b-content`)
- Flujo principal (happy path):
  - **Desktop / tab Prácticas**: hero (fila 1) → fila de tabs (fila 2) → celda fill (fila 3) = flex-col con alertas pinned arriba + card tabla `flex-1 min-h-0 overflow-y-auto` con thead sticky.
  - **Desktop / tab Ciclos**: mismo hero y tabs; el grid pierde el modificador fill y la página scrollea natural.
  - **Móvil (ambos tabs)**: apilado vertical con scroll nativo; tabla con presupuesto + "Cargar más".
- Estados especiales: loading (skeletons acotados al presupuesto, sin romper el fill), vacío (mensaje actual sin "Cargar más"), fecha futura (badge "Solo lectura" existente, sin cambios).

---

## 8. Métricas de éxito post-launch

- En desktop, el tab Prácticas no produce scroll de página en ninguna de las dos rutas (consistencia con las páginas ya migradas al canon 0028).
- En móvil, la tabla de prácticas nunca renderiza más filas que el presupuesto sin acción explícita del usuario, sin importar cuántas clases acumule el día.

---

## 9. Notas / decisiones abiertas

Decisiones YA tomadas por el owner (sesión 2026-07-12), a respetar en plan.md:

- [x] **Grid siempre de 3 filas** (hero / fila de tabs / celda fill): lo condicional vive DENTRO de la celda fill → se reutiliza `.bento-grid--fill-screen-kpi` tal cual, **sin crear modificador SCSS nuevo** (esquiva la trampa de los dos bloques de la 0029).
- [x] **Tab Ciclos Teóricos = scroll natural**: el modificador fill-screen se aplica condicional por tab (`[class.bento-grid--fill-screen-kpi]="activeTab() === 'practicas'"`). Ciclos no se fuerza a 100vh (vista de gestión, contenido alto).
- [x] **Tabla en móvil = presupuesto + scroll-x**: se mantiene la tabla con `overflow-x-auto`; se agrega presupuesto de filas con `visibleWithLoadMore()` (tab-scoped). `maxVisible` lo resuelven los Smarts vía `LayoutService.tier()` y lo pasan por input. Filtros (estado/instructor) y fecha operan sobre el total y resetean el contador.
- [x] **Alertas pinned**: dentro de la celda fill pero fuera del área scrolleable (flex-col: alertas fijas + card tabla `flex-1 min-h-0 overflow-y-auto`, thead sticky).
- [x] **Presupuesto móvil**: propuesta 6 filas + "Cargar más" en pasos de 6 (canon Base Alumnos B); el número final se valida en plan.md con la altura real de fila medida (mismo criterio que AC3 de la 0029).
- [x] **Alcance de limpieza**: aplanar el doble wrapper `bento-banner` de alertas/tabla SÍ entra (es requisito estructural del fill); las `.bento-banner` muertas de `ciclos-teoricos-content` NO entran (out of scope).
- [ ] Lógica nueva del Dumb (interacción filtros × presupuesto × tab/fecha) → extraer a función pura en `core/utils` con tests (no hay component tests — canon 0029). Detallar en plan.md.

---

## Changelog

- 2026-07-12 — draft inicial por Akxlarre (scaffold + decisiones de diseño de la sesión de análisis)
- 2026-07-12 — US1–US4, AC1–AC8 + edge cases, out of scope y cierre de decisiones §9 redactados con el owner
- 2026-07-12 — aprobada por el owner (chat) → status `approved`
- 2026-07-12 — implementada, verificada (acceptance.md) → status `done`
- 2026-07-13 — reabierta por feedback visual del owner ("muy apretado", alertas "raras"); rediseño de alertas a filas compactas de 1 línea (manteniendo fill-screen) + fix de bug real en `formatIsoDate`. Ver acceptance.md §"Revisión post-cierre". → status `done` de nuevo
- 2026-07-13 — 2ª ronda de feedback: la distribución seguía mal (la tabla "Asistencia del Día" es la protagonista, no las alertas). Análisis visual previo de ambos tabs → redistribución a 2 columnas (tabla ancha + rail de alertas), switch por contenedor (`isDesktopLayout`). Tab Ciclos se deja como está. Ver acceptance.md §"Revisión post-cierre #2". → status `done`
