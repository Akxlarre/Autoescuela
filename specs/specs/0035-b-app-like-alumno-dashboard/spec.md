# Spec 0035 — App-like: `/alumno/dashboard`

> **Status:** done
> **Created:** 2026-08-07
> **Closed:** 2026-08-08
> **Owner:** b
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** Asignación ASG-b-083 (`specs/assignments/ASG-b-083-app-like-alumno-dashboard.md`) — Paso 15 del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`).

**Persona afectada:** Alumno (portal alumno, `/alumno/dashboard`).

**Problema que resuelve:**
`AlumnoDashboardComponent` todavía no sigue el patrón app-like (fill-screen desktop / scroll interno) que ya tienen las páginas equivalentes de admin/secretaria. El layout real es bastante más denso de lo que asumía la primera pasada del audit original: hero + selector-matrícula + 2 `bento-square` + columna izquierda/derecha de 2 filas cada una (`bento-activity-lg`/`bento-alerts-lg`, mismo patrón de 2 columnas que `DashboardComponent` de admin) + otra `.bento-banner` + 2 `bento-square` más al final — son ~9 celdas condicionales, no la versión simplificada (hero + 2 columnas) que se pensó originalmente. No se llegó a mapear en detalle cuáles celdas son siempre visibles, cuáles condicionales, y si pueden coexistir varias condicionales a la vez — el mismo problema recurrente que ya apareció en `alumno/horario`/`alumno/pagos` (ASG-b-070/ASG-b-079).

**Hipótesis de valor:**
Consistencia visual y de UX con el resto del rollout app-like ya aplicado en admin/secretaria. Impacto relativamente menor: el portal alumno es mobile-first y el patrón app-like solo aporta en desktop/laptop, por lo que esta pieza es de prioridad menor que el resto del rollout y no bloquea nada si queda para el final.

**⚠️ Reformulación 2026-08-08 (a pedido del owner, tras el primer intento fallar el QA visual):** el problema dejó de ser "cómo hacer fill-screen 9 celdas" y pasó a ser "¿esas 9 celdas deberían existir?". Ver sección 7 "Auditoría de redundancia" — la spec terminó tocando **contenido**, no solo layout (el `Out of scope` original lo prohibía explícitamente; el owner lo autorizó en esta sesión).

---

## 2. User Stories

> Reescritas 2026-08-08 tras la reformulación — ver sección 7 "Auditoría de redundancia".

- **US1**: Como alumno en desktop, quiero que `/alumno/dashboard` ocupe toda la pantalla sin que la página scrollee, para ver mi estado general de un vistazo, igual que en el resto del portal ya migrado al patrón app-like.
- **US2**: Como alumno, quiero que el dashboard me muestre de un vistazo solo lo que necesito para decidir mi próximo paso (¿voy bien? ¿tengo algo pendiente?) sin repetir el detalle completo que ya tengo en Mis Clases/Mi Horario/Pagos — si quiero el detalle, hago un click y voy a esa pantalla.
- **US3**: Como alumno en móvil/tablet, quiero que el dashboard siga con scroll natural de página (como hoy), porque reviso mi progreso principalmente desde el celular y ahí el patrón app-like no aporta.
- **US4**: Como alumno con más de una matrícula, quiero que el selector de matrícula no rompa el layout ni produzca saltos visuales al aparecer/desaparecer, para tener una experiencia consistente sin importar cuántas matrículas tenga.
- **US5**: Como alumno, quiero seguir teniendo acceso a mi progreso, mi calificación/módulos y el estado de mi certificado — la única información que **no** vive en ninguna otra pantalla del portal — sin tener que navegar a buscarla.

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.

> Reescritas 2026-08-08 sobre la estructura final (3 celdas: hero + 2 columnas). Las AC originales (9 celdas, tabs) quedan en el Changelog para trazabilidad — ya no aplican.

- **AC1**: Given un alumno en desktop (≥1024px), When carga `/alumno/dashboard`, Then la página no scrollea verticalmente (`documentScrolls === false`) y las 3 celdas (hero + 2 columnas) llenan `calc(100vh-120px)` reutilizando `.bento-grid--fill-screen-2` sin modificador nuevo.
- **AC2**: Given el hero, When se renderiza, Then muestra 4 KPIs en el strip (Clases prácticas, Asist. teoría, Próxima clase, Saldo) — los últimos 2 son `clickable` y navegan a `/alumno/horario`/`/alumno/pagos` respectivamente en vez de tener su propia card.
- **AC3**: Given la columna "Mi Progreso" (anillo + grilla de 12 prácticas) en desktop, Then su contenido es siempre visible sin necesitar scroll interno — es contenido acotado que no crece.
- **AC4**: Given la columna "Evaluación y Certificado" con un alumno de Clase Profesional (hasta 7 módulos), When el alto disponible es menor al contenido, Then la lista de módulos scrollea internamente (reutiliza el `overflow-auto` que ya tenía) sin que el bloque de certificado quede inaccesible.
- **AC5**: Given el selector de matrícula (solo si `enrollments().length > 1`), Then vive dentro del header de la columna "Mi Progreso" (no en una fila propia del grid) — su presencia/ausencia no puede romper el layout porque ya no depende de posicionamiento de grid, solo de flexbox interno de la celda.
- **AC6**: Given viewport móvil (<640px) o `<main>` angostado, Then las celdas apilan en 1 columna y la página scrollea natural — todo el cambio está scoped a `@container layoutmain (min-width: $bp-lg)`, igual que el resto del rollout.
- **AC7**: Given la sección "Asistencia reciente" del diseño original, Then **no existe** en el dashboard — su información (racha de faltas) sigue visible vía el chip del hero ("N faltas seguidas"); el detalle completo vive en `/alumno/clases` y `/alumno/horario`, que ya lo mostraban.

### Edge cases obligatorios

- **AC-E1**: Given el estado `loading()` inicial, When se muestran los skeletons, Then respetan el mismo alto fill-screen que el estado con datos (sin overflow de página en desktop) — verificado con `opacity`/`transform` forzados dado que el entorno de QA (pestaña backgroundeada) no deja completar la animación GSAP real.
- **AC-E2**: Given un alumno sin clases próximas / sin calificación aún, When se renderizan los estados vacíos ("Sin clases", "Pendiente"), Then el alto de la celda no cambia respecto al estado con datos.
- **AC-E3**: Given el certificado en estado `enabled` (con `app-alert-card` de éxito dentro de la columna Evaluación), When se muestra, Then no rompe el scroll interno de esa columna.

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.
> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ~~❌ Rediseño funcional del contenido de cada celda~~ — **revertido 2026-08-08**: el owner pidió explícitamente reformular el contenido, no solo el layout. Ver sección 7.
- ❌ Cambios a `StudentHomeFacade`, `StudentEnrollmentContextFacade` u otros facades de datos — la reformulación solo cambia qué campos ya existentes se muestran y dónde, no de dónde vienen. Sin nuevas queries ni nuevos campos.
- ❌ `/alumno/horario`, `/alumno/pagos`, `/alumno/clases`, `/alumno/pruebas-online` — cubiertas por ASG-b-070/ASG-b-079 (tracks separados del mismo rollout).
- ❌ Nueva lógica de negocio de matrícula múltiple — ya resuelta en spec 0034 (`StudentEnrollmentContextFacade` + selector de matrícula ya existente).
- ❌ `scrollbar-gutter: stable` global u otro fix universal del shift de scrollbar — si aparece el mismo bug que en 0031, se documenta como propuesta aparte, no se resuelve acá.

---

## 5. Dependencias

### Specs previas
- 0028 (canon `.bento-fill`, `LayoutService.tier()` por contenedor) — `done`.
- 0029 (`--fill-screen-kpi`) — `done`.
- 0030 / 0031 (patrón de 2 columnas + `isDesktopLayout()` + precedente de reestructurar en tabs cuando hay demasiadas zonas apiladas) — `done`.
- 0034 (`StudentEnrollmentContextFacade`, selector de matrícula ya implementado) — `done`. Esta spec no lo modifica, solo debe convivir con el layout fill-screen.

### Capacidades del proyecto que se asumen existentes
- `LayoutService.tier()` (`mobile | tablet | desktop`, por contenedor vía `ResizeObserver` de `<main>`).
- `StudentHomeFacade` (hero/progress/attendance/grades/certificate/side) y `StudentEnrollmentContextFacade` (enrollments/activeEnrollmentId) — ya inyectados en el componente, sin cambios esperados.
- `<app-skeleton-block>`, `<app-tabs>`, `<app-alert-card>`, `<app-kpi-card-variant>` — componentes del DS ya usados en la página.

### Capacidades nuevas requeridas
- Ninguna de infraestructura/BD. Posible: un modificador CSS nuevo en `_bento-grid.scss` **o** reestructuración en tabs (a decidir en `/spec-plan` — ver sección 7 "Zonas apiladas"). Si el plan opta por tabs, probablemente un input `isDesktop` en algún componente hijo nuevo, siguiendo el mismo patrón que `ciclos-teoricos-content` (spec 0031).

---

## 6. Datos y modelo (preliminar)

N/A — spec puramente de layout/UI, sin cambios de persistencia, RLS ni modelos.

---

## 7. UX y flujos

- Pantalla(s) afectada(s): `src/app/features/alumno/dashboard/alumno-dashboard.component.ts`

### Historia de esta spec (3 diseños, en orden)

1. **Mapeo inicial (2026-08-07):** 9 celdas, solo 1 condicional de verdad (selector de matrícula). Ver Changelog para el detalle — ya no aplica.
2. **Modificador `--fill-screen-stack` (2026-08-07):** decisión del owner de no usar tabs. Implementado, pasó `lint:arch`/`ng build`, pero el QA visual mostró la fila fill con solo **47px de alto** — el resto del contenido fijo (hero+KPIs+banner asistencia+fila final = 626px de ~780px disponibles) dejaba casi nada para lo que debía ser protagonista. Descartado.
3. **Tabs (`--fill-screen-kpi`, 2026-08-08):** pivote a 3 tabs (Progreso/Evaluación/Asistencia) + corte de los 2 widgets finales duplicados. Funcionó técnicamente (build, lint, QA visual con datos reales) pero el owner lo rechazó ("no me gustó para nada") y pidió reformular desde cero pensando en qué datos hacen falta de verdad — no solo en cómo acomodar los que ya había.

### Auditoría de redundancia (2026-08-08) — la base del diseño final

Antes de tocar layout de nuevo, se mapeó qué muestra CADA página del portal alumno (`/alumno/horario`, `/alumno/pagos`, `/alumno/clases`, `/alumno/pruebas-online`) para encontrar qué del dashboard está duplicado:

| Dato | Dashboard (antes) | ¿Dónde más vive? |
|---|---|---|
| Próxima clase | Card propia con fecha/hora | `/alumno/horario` — banner protagonista con calendario semanal completo |
| Saldo / Total pagado | Card propia + botón "Pagar" | `/alumno/pagos` — 3 KPIs propios (Total curso, Pagado, Saldo) |
| Prácticas X/12, Asist. teoría % | Strip del hero + anillo | `/alumno/clases` — ya son los KPIs de SU hero |
| Asistencia reciente (dots) | Banner completo | `/alumno/clases` (tab Teoría) y `/alumno/horario` — con más detalle |
| Nota/Certificado (widgets finales) | 2 widgets extra | Duplicaban 1:1 el panel Examen/Certificado de al lado |
| **Examen/Módulos + Certificado** | Panel | **En ningún otro lado** |

**Conclusión:** lo único que solo existe en el dashboard es Evaluación + Certificado. Todo lo demás es un "teaser" de una pantalla que ya tiene el detalle completo — mostrarlo dos veces no ayudaba al alumno, solo llenaba la pantalla.

### Diseño final: 3 celdas, sin tabs

- **Hero** — 4 KPIs en el strip: Clases prácticas, Asist. teoría (informativos), Próxima clase y Saldo (**clickeables**, `SectionHeroKpi.clickable=true` + `(kpiClick)` → `router.navigate()` a horario/pagos — reemplaza las cards+botón dedicados).
- **Columna izquierda — Mi Progreso**: anillo + grilla de 12 prácticas (visualización única, aporta valor aunque los números también estén en `/alumno/clases`). El selector de matrícula (si `enrollments().length > 1`) vive en su header — no depende de una fila propia del grid.
- **Columna derecha — Evaluación y Certificado**: el único contenido que no existe en ninguna otra pantalla. Sin cambios de contenido respecto al panel original.
- **Cortado por completo:** Asistencia reciente (dots + badge) y los 2 widgets finales (Nota/Certificado, duplicaban la columna derecha). La racha de faltas sigue visible vía el chip del hero.

Reutiliza `.bento-grid--fill-screen-2` **tal cual existe** (el mismo modificador que usa `DashboardComponent` admin) — cero CSS nuevo, cero sprawl. La hipótesis original de la Asignación ("la base de 2 columnas ya reutiliza `--fill-screen-2`") era correcta desde el principio; lo que sobraba era todo lo demás.

### Bug de CSS encontrado y corregido en el camino

`_bento-grid.scss` tenía un bug latente: `[data-col-span]` y `[data-col-start]` (misma especificidad, `data-col-start` declarado después) — cuando un elemento usaba **ambos atributos juntos**, `data-col-start` pisaba el `grid-column-start` que `grid-column: span N` había fijado, dejando el elemento de **1 columna de ancho** en vez del span pedido. Solo esta página combinaba ambos atributos (grep confirmado, 0 otros archivos afectados), pero es probable que **ya estuviera roto en producción antes de esta spec** — no era visible en el diseño de 9 celdas sin fill-screen. Corregido cambiando `grid-column: span $i` → `grid-column-end: span $i` (no pisa `grid-column-start`, backward-compatible con los 14 archivos que usan `data-col-span` solo). Ver `_bento-grid.scss` líneas ~342 y ~368.

### Densidad adaptativa (Pilar 2 del patrón app-like)

La lista de 7 módulos (columna derecha, caso Profesional) ya maneja su propio overflow (`overflow-auto`) sin necesitar `sliceByBudget`. No se agregó lógica de densidad nueva.

- Flujo principal (happy path): alumno inicia sesión → navega a `/alumno/dashboard` → ve su hero con 4 KPIs de un vistazo → si tiene >1 matrícula, elige cuál ver → revisa su progreso visual (anillo) y su evaluación/certificado — sin scrollear la página, sin datos repetidos que ya vio en otra pantalla.
- Estados especiales (loading, error, vacío): `@if (loading())` + `<app-skeleton-block>` en las 2 columnas; KPIs del hero usan `[loadingKpiCount]="4"`.

---

## 8. Métricas de éxito post-launch

> Cómo sabremos en producción que funciona. Opcional para specs internas.

- 0 scroll de página en `/alumno/dashboard` en desktop (≥1024px), paridad con el resto del rollout app-like ya cerrado.
- 0 pérdida de información **accesible**: todo dato cortado del dashboard (próxima clase, saldo, asistencia detallada) sigue disponible a 1 click en su pantalla dedicada.
- Reducción de superficie: de 9 celdas a 3 (hero + 2 columnas), sin CSS nuevo.

---

## 9. Notas / decisiones abiertas

- [x] Diseño final reformulado y verificado — ver sección 7. Reutiliza `--fill-screen-2` existente, 3 celdas, sin tabs.
- [x] Bug de CSS `data-col-span`/`data-col-start` encontrado y corregido — ver sección 7.
- [ ] **No verificado con datos reales de esta sesión:** alumno Profesional con 7 módulos (scroll interno de la columna derecha), alumno con 2+ matrículas (selector en el header de la columna izquierda), viewport mobile (falla de `resize_window` en la sesión). Cubiertos por construcción/código, no visualmente. Ver `acceptance.md`.
- [ ] Checklist de cierre específico del rollout app-like: `force-compact` con drawer abierto (no probado esta sesión); `/verify` en 390×844 y 768 de alto (pendiente).
- [ ] Considerar si `data-llm-description`/`data-llm-nav` deben agregarse a los 2 KPIs clickeables del hero (antes tenían `data-llm-nav` explícito en el link/botón; ahora navegan vía `(kpiClick)` — confirmar si `SectionHeroComponent` ya pone `data-llm-action` genérico en los KPIs clickeables, ver `section-hero.component.ts:583`).
- Originado de Asignación ASG-b-083 (`specs/assignments/ASG-b-083-app-like-alumno-dashboard.md`)

---

## Changelog

- 2026-08-07 — draft inicial por b (vía /assign-claim desde ASG-b-083)
- 2026-08-07 — mapeo de las 9 celdas completado (sección 7); corrige la Asignación original (solo 1/9 es condicional, no 9/9); identificada decisión de layout bloqueante (zonas apiladas > modificadores existentes) para resolver en /spec-plan
- 2026-08-07 — User Stories (5), Acceptance Criteria (6 + 3 edge cases), Out of scope, Dependencias y Métricas redactados por Claude a pedido explícito del owner. Status sigue `draft` — falta revisión del owner antes de `approved`
- 2026-08-07 — owner decide la pregunta abierta de layout: **modificador CSS nuevo**, no tabs. Queda para `/spec-plan` el detalle de qué zonas se vuelven `.bento-fill` y la justificación frente a la reducción de sprawl de ASG-b-057
- 2026-08-08 — implementado `--fill-screen-stack` (modificador nuevo, 6 filas). Build/lint limpios, pero QA visual reveló la fila fill en 47px de alto — descartado.
- 2026-08-08 — pivote a tabs (`--fill-screen-kpi`, 3 tabs, corte de 2 widgets duplicados). Funcionó técnicamente y pasó QA visual con datos reales — **rechazado por el owner** ("no me gustó para nada").
- 2026-08-08 — **reformulación completa a pedido del owner**: auditoría de redundancia contra las otras páginas del portal alumno, diseño final de 3 celdas (hero 4-KPI + 2 columnas), reutiliza `--fill-screen-2` existente sin CSS nuevo. Encontrado y corregido en el camino un bug de CSS preexistente (`data-col-span`+`data-col-start` combinados). `ng build`/`lint:arch` limpios, QA visual con datos reales (claro y oscuro) confirma el layout correcto (`gridColumn: "1/span 6"` y `"7/span 6"`, `documentScrolls:false`).
- 2026-08-08 — **pulido visual, ronda 2** (owner: "esos dos componentes quedaron horriblemente feos"): (1) grilla 4×3 de prácticas (celdas ~140px, verde casi invisible) → stepper compacto de círculos (verde sólido real) + "Próxima: Práctica N — fecha" (usa `practices[].date`, dato ya existente sin usar); (2) tarjeta de examen agrandada + fecha de rendición (`grades.finalExamDate`, ídem); (3) motivo de bloqueo del certificado, de texto gris plano a `<app-alert-card severity="warning">`; (4) centrado vertical del contenido en ambas columnas. Cero datos nuevos del backend.
- 2026-08-08 — **pulido visual, ronda 3** (owner: "esa no es la solución, rellenemos con info, agreguemos un componente más al grid"): el centrado no convenció — la celda seguía siendo más alta de lo que su contenido necesitaba. Cambio estructural: las 2 columnas pasan de `data-row-span="2"` (llenaban las 2 filas fr enteras) a `row-span 1` (comparten UNA fila, tal como el propio comentario de `--fill-screen-2` en `_bento-grid.scss` lo describe: "Hero + 2 FILAS de tarjetas", no 2 columnas altas). La fila fr que quedó libre se llena con una **4ta celda nueva**: "Camino al Certificado", un tracker horizontal de 3 pasos (Prácticas → Examen/Módulos → Certificado) construido con los mismos 3 signals que ya se mostraban (`progress`/`grades`/`certificate`), sin ninguna regla de negocio nueva — el paso "actual" es simplemente el primero no completado, en el orden real en que ocurren. Total: 4 celdas (hero + 2 columnas + tracker). Ícono `Milestone` registrado en `app.config.ts` (Award/ChevronRight ya estaban). `ng build`/`lint:arch` limpios, QA visual confirma (claro y oscuro) sin cortes de contenido.
- 2026-08-08 — **verificación explícita Clase B + Profesional** (owner: "revisa con el que tiene profesional y b"). Sin cuenta de prueba Profesional real disponible (los alumnos del seed no tienen Auth vinculado, y crear cuentas está prohibido) — verificado inyectando un `StudentHomeSnapshot` simulado client-side vía `ng.getComponent()` + `facade._snapshot.set()`, sin tocar la BD. Encontrado en el camino: con datos reales de 7 módulos, la lista quedaba muy apretada porque compartía la columna con el bloque de certificado completo (alert-card + separador). **Pulido visual, ronda 4**: se sacó el bloque de certificado de la columna "Evaluación" por completo — esa info ya vivía duplicada en "Camino al Certificado" (celda de abajo). El motivo de bloqueo (`blockingReason`) ahora se muestra una sola vez, debajo del tracker; el paso "Certificado" del tracker muestra el folio cuando está `issued`. La columna de evaluación quedó con el 100% del alto disponible para el examen/módulos. Computeds y componentes que quedaron sin uso (`certIcon`, `certIconColor`, `certStatusLabel`, `AlertCardComponent`, `AnimateInDirective`) removidos. `ng build`/`lint:arch` limpios.
- 2026-08-08 — **CERRADA.** Owner: "muchísimo mejor, cerramos". Status → `done`. 3 diseños descartados en el camino (`--fill-screen-stack`, tabs, centrado-sin-restructura) antes de llegar al final: hero 4-KPI + Mi Progreso | Evaluación (comparten fila) + Camino al Certificado (fila propia), reutilizando `--fill-screen-2` sin CSS nuevo. Bug real de `_bento-grid.scss` (`data-col-span`+`data-col-start`) encontrado y corregido en el camino, con blast radius acotado (grep confirmó 0 otros archivos afectados). Va a una rama de feature, no directo a `main`.
