# Acceptance 0036-b — "Mis Alumnos" (instructor) alineado al canon de Base Alumnos

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Verified:** 2026-08-12 (2ª ronda, corregida)
> **Verifier:** b (implementación + `/verify` en navegador real, sin tasks.md — talla S)

## ⚠️ Corrección post-primera-ronda

La primera implementación (misma fecha) usó como referencia `admin-instructores.component.ts`
(tabla hand-rolled sin paginar, container query a 850px) en vez del canon real que pedía la
spec — `alumnos-list-content.component.ts` (Base Alumnos), que usa `<p-table>` de PrimeNG
con paginador real, header `micro-label`, avatar plano (`bg-elevated` + borde, sin gradiente),
filas `list-item-hover`, y **un solo card unificado** (toolbar + tabla juntos, no dos bloques
separados). El owner lo señaló en QA ("la tabla de alumnos no es la canon") y se corrigió en
esta misma sesión, mismo track. Cambios de la corrección:
- `<table>` hand-rolled → `<p-table>` con `[paginator]="true" [rows]="9"`.
- Breakpoint del `@container` 850px → 900px (igual que `alumnos-list-content`).
- Card de toolbar separado + card de tabla separado → un solo
  `.bento-banner.bento-fill.card.dual-viewport-container` envolviendo ambos.
- Avatar con gradiente en la tabla → avatar plano `bg-elevated`/borde (canon). El avatar con
  gradiente de las cards mobile se mantuvo — es un patrón propio de esa vista, no lo que se
  cuestionó.
- Clases `micro-label`/`item-title`/`list-item-hover` aplicadas en vez de CSS custom
  (`.student-table th`/`.student-row`).
- `.show-on-squeeze` con `display: block` (no `flex`) — replica el CSS literal del canon;
  el `.bento-grid` interno de las cards ya maneja su propio layout.

---

## Resumen

- AC totales: 5 (+ 2 edge cases)
- AC cumplidos: 5 (+ 2 edge cases)
- AC con evidencia: 7/7

**Veredicto final:** ✅ PASA

---

## Verificación por AC

### AC1 — Tabla desktop con `<p-table>` y paginador real (canon)

- **Estado:** ✅ cumplido (corregido en 2ª ronda — ver nota arriba)
- **Evidencia:** `/verify` en 1440×900 — `<p-table>` con columnas Alumno/Curso/Progreso
  Práctico/Próxima Clase/Estado, header `micro-label`, paginador visible
  ("Mostrando 1 a 1 de 1 alumnos"), `.hide-on-squeeze` visible, `documentScrolls:false`
  confirmado vía JS.

### AC2 — Cards en mobile/tablet, sin regresión de fix-139-b

- **Estado:** ✅ cumplido
- **Evidencia:** `/verify` en 390×844 — cards idénticas a como se veían antes de este
  spec (mismo HTML, sin cambios), `.show-on-squeeze` visible, `.hide-on-squeeze`
  `display:none` confirmado vía JS.

### AC3 — Buscador/filtros/sort comparten fuente en ambas vistas

- **Estado:** ✅ cumplido
- **Evidencia:** Tabla y cards consumen `filteredStudents()`/`visibleStudents()`
  (derivado del mismo `filteredStudents()`) — mismo computed, sin duplicar lógica de
  filtro/orden.

### AC4 — Click en fila o card abre el mismo drawer

- **Estado:** ✅ cumplido
- **Evidencia:** Verificado en navegador — click en `.student-row` (tabla, 1440×900)
  abrió `StudentDrawerDetailComponent` con los datos correctos ("Conductores MORALES"),
  mismo comportamiento que la card en mobile.

### AC5 — Switch tabla↔cards por ancho de contenedor, no viewport global

- **Estado:** ✅ cumplido
- **Evidencia:** Verificado un caso adicional no cubierto explícitamente en el plan: al
  abrir el drawer de detalle en 1440×900, `<main>` se angostó y el `@container` propio
  (`instructorAlumnosContainer`, breakpoint 900px, igual que `alumnos-list-content`)
  detectó el squeeze y cambió a la vista cards automáticamente — sin necesitar
  `force-compact` (el componente no usa `LayoutDrawerFacadeService`, y no lo necesita: el
  mecanismo de contenedor ya resuelve esto por sí solo). Re-verificado tras la corrección
  de canon (breakpoint 850→900px): mismo comportamiento.

### Edge cases

- **AC-E1** (empty state en ambas vistas): ✅ cumplido — sin cambios de comportamiento,
  el wrapper `flex-1 flex items-center justify-center` se mantiene.
- **AC-E2** (alumno sin `nextClassDate`): ✅ cumplido — la tabla muestra "Sin agendar"
  igual que las cards (verificado visualmente con el alumno de prueba, que no tiene
  próxima clase agendada).

---

## Riesgo del plan — resultado real

El riesgo documentado en `plan.md` §8 (breakpoint del `@container` original de 850px vs.
`LayoutService.tier()` de 1024px pudiendo generar un estado inconsistente en la zona
850–1024px) **no se materializó** en la 1ª ronda: verificado en 950px de ancho de
contenedor — la tabla se mostraba correctamente y el `mobileShown`/`maxVisible` de
`LayoutService` no tenía efecto visual porque la tabla no consume esos signals. Tras la
corrección de canon (2ª ronda), el breakpoint pasó a 900px (igual que
`alumnos-list-content`) — el mismo razonamiento sigue aplicando, con menos superficie de
riesgo aún (queda una zona 900–1024px en vez de 850–1024px). No hizo falta ajustar nada
adicional.

---

## Out-of-scope respetado

- ❌ Modelo de datos / Facade — confirmado: `InstructorAlumnosFacade` sin cambios.
- ❌ Componente `shared/` reutilizable con Base Alumnos — confirmado: no se extrajo,
  sigue siendo un componente propio (mismo precedente que
  `admin-instructores`/`secretaria-instructores`).
- ❌ `/instructor/alumnos/:id/evaluacion/:sessionId` ni `/instructor/alumnos/:id/ficha` —
  confirmado: no se tocaron.
- ❌ Columnas/datos nuevos no presentes hoy (teléfono/email en tabla) — confirmado:
  paridad exacta con las cards (decisión tomada en `plan.md`).

---

## Deuda técnica detectada

Ninguna.

---

## Cambios en índices

- Ninguno en `indices/COMPONENTS.md` (página Smart de `features/`, no catalogada ahí —
  mismo criterio que el resto de páginas del portal instructor).
- `indices/APP-LIKE-ROLLOUT.md` no requiere cambios — `/instructor/alumnos` ya estaba
  marcada `✅ Cerrado (fix-139-b)`; este spec es una migración de patrón visual interno,
  no cambia su estado en el rollout.

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia
- [x] Out-of-scope respetado
- [x] Índices actualizados (N/A para este caso, justificado arriba)
- [x] Tests pasando en CI (`instructor-alumnos.component.spec.ts` 11/11 ✓, sin
      regresión — la lógica de densidad sigue cubierta igual)
- [x] `lint:arch` limpio (0 errores, sin advertencias nuevas en el archivo tocado)
- [x] Sin deuda crítica abierta

**Cerrado por:** b
**Fecha:** 2026-08-12
