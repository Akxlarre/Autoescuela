# Plan 0035-b — App-like: `/alumno/dashboard`

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-08-07
> **Última revisión:** 2026-08-08 (reformulación completa — ver spec.md §7 "Historia de esta spec")
> **Talla:** S (se mantuvo S incluso tras la reformulación: menos archivos que el plan original, no más)

---

## 1. Resumen ejecutivo

Reformulación completa del dashboard tras auditar qué contenido está duplicado en otras páginas del portal alumno (spec.md §7). Resultado: **3 celdas** (hero con 4 KPIs + 2 columnas fill: Mi Progreso | Evaluación y Certificado), reutilizando `.bento-grid--fill-screen-2` **tal cual existe** — el mismo modificador de `DashboardComponent` admin, cero CSS nuevo. Se cortó la sección "Asistencia reciente" y los 2 widgets finales (duplicaban info de otras pantallas o del panel de al lado). En el camino se encontró y corrigió un bug de CSS preexistente en `_bento-grid.scss` (`data-col-span`+`data-col-start` combinados perdían el span).

> Los 2 diseños anteriores (modificador `--fill-screen-stack` propio, y luego tabs sobre `--fill-screen-kpi`) están documentados en el Changelog de spec.md por trazabilidad, pero **no reflejan el estado final** — no usar como referencia de implementación.

---

## 2. Inventario de impacto

### Archivos a CREAR

Ninguno.

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/features/alumno/dashboard/alumno-dashboard.component.ts` | Reescritura completa del template: `bento-grid--fill-screen-2`; hero con 4to KPI clickeable (`proxima-clase`, `saldo`) vía `(kpiClick)`; 2 columnas `.bento-fill` con `data-col-span`/`data-col-start`/`data-row-span="2"`; selector de matrícula relocalizado al header de la columna izquierda; **cortado**: banner de asistencia reciente, 2 widgets finales, KPIs sueltos "Próxima clase"/"Saldo". Computeds removidos (dead code de lo cortado): `hasGrade`, `gradeLabel`, `gradeValue`, `gradeColor`, `certCardColor`, `certIconBg`, `semaphoreLabel`, `semaphoreVariant`, `recentSessions`, `sessionDotBg`, `sessionDotColor`, `formatSessionDate`. Import nuevo: `Router` (para `onKpiClick`) | Reformulación de contenido a pedido del owner |
| `src/styles/layout/_bento-grid.scss` | Fix de bug preexistente: `[data-col-span]`/`[data-col-span-md]` pasan de `grid-column: span $i` a `grid-column-end: span $i` (2 ocurrencias, tiers md y lg) | `grid-column-start` (seteado por `data-col-start`) pisaba el span cuando un elemento combinaba ambos atributos — descubierto en vivo con las columnas del dashboard renderizando a 1 track de ancho |

### Archivos a ELIMINAR

Ninguno. (`indices/STYLES.md` no necesitó cambios esta vez — no hay modificador CSS nuevo que documentar.)

---

## 3. Reutilización (Discovery)

### Patrones/mecanismos existentes que reutilizamos
- `.bento-grid--fill-screen-2` (ya usado por `DashboardComponent` admin) — sin modificar su definición, solo se aplica.
- `.bento-fill` + `data-col-span`/`data-col-start`/`data-row-span="2"` — mismo mecanismo que ya usaban estos 2 paneles antes de que existiera esta spec (la estructura de 2 columnas del dashboard NUNCA cambió de fondo; lo que cambió es todo lo que la rodeaba).
- `SectionHeroKpi.clickable` + `(kpiClick)` — ya existía en `section-hero.component.ts` (usado por otras páginas), simplemente no se había usado acá. Evita crear un componente/mecanismo de navegación nuevo para "Próxima clase"/"Saldo".
- `<app-tabs variant="pill">` para el selector de matrícula — el componente no cambió, solo su ubicación en el DOM (de fila propia del grid a header de una celda).

### Componentes/Facades/Services que NO existen y debemos crear
Ninguno. Cero componentes nuevos en las 3 iteraciones de esta spec (el diseño con tabs tampoco necesitó uno, al reusar `<app-tabs>` existente).

---

## 4. Modelo de datos

N/A — sin cambios de persistencia, RLS ni modelos. La reformulación cambia QUÉ campos ya existentes del facade se muestran y DÓNDE, no de dónde vienen (spec.md §4 Out of scope).

---

## 5. Arquitectura del feature

### Estructura final (desktop, lg+)

```
grid-template-rows: auto              minmax(0,1fr)         minmax(0,1fr)
                     ┌──────────────────────────────────────────────────┐
Fila 1 (auto)        │ Hero — 4 KPIs: Prácticas · Asist.teoría ·          │
                     │ Próxima clase (click→horario) · Saldo (click→pagos)│
                     └──────────────────────────────────────────────────┘
                     ┌────────────────────────┬───────────────────────┐
Filas 2-3 (fr,       │ Mi Progreso             │ Evaluación y           │
row-span:2 c/u)      │ col 1-6, .bento-fill    │ Certificado            │
                     │ · selector matrícula     │ col 7-12, .bento-fill  │
                     │   (header, si >1)        │ · overflow-auto propio │
                     │ · anillo + 12 prácticas  │   en lista de módulos  │
                     └────────────────────────┴───────────────────────┘
```

Mobile/tablet (<1024px): sin cambios — `--fill-screen-2` solo aplica dentro de `@container layoutmain (min-width: $bp-lg)`, igual que el resto del rollout.

### Capas tocadas

- **Smart**: `features/alumno/dashboard/alumno-dashboard.component.ts` (template completo + computeds de KPIs del hero + `onKpiClick()`)
- **Estilos globales**: `styles/layout/_bento-grid.scss` (fix de bug, no modificador nuevo)
- **Facade**: ninguno — mismos signals de `StudentHomeFacade`/`StudentEnrollmentContextFacade`, ninguno nuevo
- **Migration**: N/A

---

## 6. Restricciones aplicables

Reglas aplicables: `architecture.md` (OnPush, sin cambios) y `visual-system.md` (bento grid — reutiliza modificador existente, sin `contain`/`min-height` inline). El resto no aplica — sin cambios de datos, facades ni modelos.

---

## 7. Plan de testing

- **Tests unitarios**: no aplica `.spec.ts` nuevo — `heroKpis` y `onKpiClick` son transformación/despacho simple sin ramas de negocio nuevas (mismo criterio que ya regía para los KPIs existentes del strip).
- **QA manual (`/verify`)**:
  - ✅ 1440×900, alumno con 1 matrícula, claro y oscuro — verificado con datos reales (`alumno@test.com`).
  - ✅ `documentScrolls: false`, `gridColumn: "1/span 6"` y `"7/span 6"` confirmados vía probe JS tras el fix del bug de CSS.
  - ⚠️ Pendiente (sin cuenta de prueba disponible esta sesión): alumno con 2+ matrículas, alumno Profesional con 7 módulos, viewport mobile real (`resize_window` falló en la sesión).
  - ⚠️ No probado: `force-compact` con drawer abierto.
- **Consola**: 0 errores atribuibles al cambio (el único error recurrente, `InvalidStateError` de View Transitions, es preexistente y correlaciona con la velocidad de navegación de la automatización).

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| El fix de `grid-column-end` en `_bento-grid.scss` afecta a los otros 14 archivos que usan `data-col-span` | Baja (mitigada) | `grid-column-end: span $i` es backward-compatible por diseño — no toca `grid-column-start`, que es lo único que los otros 14 archivos necesitan (ninguno combina `data-col-span`+`data-col-start`, confirmado por grep). `ng build`/`lint:arch` limpios tras el cambio |
| Cortar "Próxima clase"/"Saldo" como cards pierde el CTA directo "Pagar" | Media | Aceptado explícitamente por el owner al elegir la opción de plegarlos al hero — el click en el KPI navega a `/alumno/pagos`, donde el botón "Pagar" real sigue existiendo, 1 click más lejos |
| Sin cuentas de prueba para validar multi-matrícula / Profesional-7-módulos / mobile | Media | Documentado como pendiente en `acceptance.md`, no bloqueante — el código cubre estos casos por construcción (mismo mecanismo ya usado antes de esta spec para matrícula múltiple; mobile scoped a `@container`) |

---

## 9. Orden de implementación

1. Auditoría de redundancia contra `/alumno/horario`, `/alumno/pagos`, `/alumno/clases`, `/alumno/pruebas-online` (spec.md §7).
2. Reescribir `alumno-dashboard.component.ts`: hero de 4 KPIs, 2 columnas `--fill-screen-2`, cortar asistencia/widgets finales, relocalizar selector de matrícula.
3. `ng build` + `lint:arch`.
4. QA visual → encontrar el bug de `data-col-span`/`data-col-start` (columnas a 1 track de ancho).
5. Fix del bug en `_bento-grid.scss` (2 ocurrencias, md y lg).
6. Re-build + re-lint + re-QA visual (claro y oscuro) — confirmado correcto.
7. Documentar en spec.md/plan.md/tasks.md/acceptance.md.

---

## 10. Estimación

S — el resultado final toca **menos** superficie que el plan original (sin modificador CSS nuevo, sin componente de tabs), a pesar de las 2 iteraciones descartadas.

---

## Changelog

- 2026-08-07 — plan inicial (talla S): modificador `--fill-screen-stack` + `data-row-start`. Descartado tras QA visual (fila fill en 47px).
- 2026-08-08 — plan revisado para el pivote a tabs (`--fill-screen-kpi`). Descartado por el owner tras QA visual exitoso mismo — el resultado no le gustó.
- 2026-08-08 — **reescritura completa** para la reformulación final: 3 celdas, `--fill-screen-2` existente, auditoría de redundancia, bug de CSS encontrado y corregido.
