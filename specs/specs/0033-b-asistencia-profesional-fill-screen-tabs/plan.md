# Plan 0033-b — Asistencia Profesional: fill-screen app-like + tabs (Firma semanal | Resumen)

> **Spec:** [spec.md](./spec.md)
> **Status:** approved (delegación del owner vía /loop "continua", 2026-07-21)
> **Created:** 2026-07-21
> **Talla:** M (~8 archivos, sin facade nuevo, sin migraciones, ACs cerrados)

---

## 1. Resumen ejecutivo

Refactor de vista (cero cambios de datos): `AdminProfesionalAsistenciaComponent` pasa de bento con scroll de página a shell `--fill-screen-kpi` (hero / card del mapa semanal / panel `.bento-fill` con tabs **Firma semanal | Resumen**, scroll interno). Las dos tablas inline (~90% markup compartido) se extraen a Dumb components colocated y sus pills manuales migran a `<app-badge>`. Se elimina el duplicado huérfano de secretaría (585 líneas + ruta). Orden grueso: extraer tablas → shell+tabs → limpieza/densidad → borrar duplicado → validar + /verify.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/app/features/admin/profesional-asistencia/firma-semanal-table.component.ts` | Dumb (colocated) | Tabla de firma semanal: inputs `alumnos`, `isLoading`, `isSaving`, `sinSesionesTeoria`; selección local (signal) con "Marcar todos"; output `registrarFirmas(enrollmentIds)`. |
| `src/app/features/admin/profesional-asistencia/resumen-alumnos-table.component.ts` | Dumb (colocated) | Tabla resumen por alumno: inputs `alumnos`, `isLoading`. Sin outputs (solo lectura). |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/features/admin/profesional-asistencia/admin-profesional-asistencia.component.ts` | Shell `--fill-screen-kpi` + `[appBentoReveal]`; panel `.bento-fill` con header de tabs (patrón spec 0030/0031) y cuerpo con scroll interno; quitar tablas inline y estado de selección (baja al Dumb); quitar código muerto (`getSessionClasses`, `drawerTitle`, `closeDrawer`, estilos `.session-*`, `.resumen-table`, `.pct-badge`, `.firma-badge`); quitar `mb-6`; compactar paddings del área del mapa (`p-6`→`p-4`) | AC1, AC2, AC3, AC8, AC9 |
| `src/app/features/admin/profesional-asistencia/session-day-card.component.ts` | Fix truncado "PENDIEN" (label con `min-w-0` y sin clipping del `overflow-hidden`); quitar `CommonModule` si queda sin uso; revisar densidad vertical (mb-4→mb-3) | AC9, riesgo de alto fijo |
| `src/app/app.routes.ts` | Eliminar la ruta `asistencia/profesional` de secretaría | AC6 |
| `indices/ROUTES.md` | Regenerar vía `npm run indices:sync` | AC6 |
| `indices/COMPONENTS.md` | Registrar los 2 Dumb nuevos + actualizar entrada de la página | Paso SINCRONIZAR |

### Archivos a ELIMINAR

| Path | Motivo |
|------|--------|
| `src/app/features/secretaria/asistencia-profesional/secretaria-asistencia-profesional.component.ts` | Duplicado huérfano (585 líneas) sin enlace en menú; el menú usa el thin-wrapper `secretaria/profesional-asistencia` que reutiliza el componente admin (AC6) |

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `<app-section-hero density="slim">` con KPIs embebidos — ya en uso, intacto
- `<app-session-day-card>` — intacto salvo fix de truncado/densidad
- `<app-badge variant>` (fuente única de pills, fix-036) — reemplaza `.pct-badge` (success/warning/error) y `.firma-badge` (success con ícono via ng-content / neutral)
- `<app-skeleton-block>` — skeletons fieles (canon fix-046)
- `<app-icon>` — sin íconos nuevos que registrar (usa `pen-line`, `users`, `check-circle`, `calendar-check`, `chevron-*`, `ban`, `book-open`, `wrench`, `minus` — todos ya registrados; verificar con lint ARCH-14)
- `AdminSesionDrawerComponent` + `LayoutDrawerFacadeService` — sin cambios

### Facades/Services existentes que extendemos
- `AsistenciaProfesionalFacade` — **cero cambios** (SWR, cascada promo→curso→sesiones, firmas y resumen ya expuestos como signals)
- `GsapAnimationsService` — vía `[appBentoReveal]` (reemplaza el `#bentoGrid viewChild + ngAfterViewInit` manual)
- `BranchFacade.setProfessionalOnly(true/false)` — se conserva en OnInit/OnDestroy

### Directivas/estilos canónicos que reutilizamos
- `.bento-grid--fill-screen-kpi` (rows `auto auto minmax(0,1fr)`) — hero / card mapa / panel fill. **Incondicional** (sin `@if`) → sin shift de scrollbar (canon 0031). AC8: diff vacío en `_bento-grid.scss`
- `.bento-fill` — única fuente del modo dual (contain:size solo lg+); PROHIBIDO contain/min-height inline
- Patrón de tab-header con `role="tablist"` + `[style.background/color/boxShadow]` por tab activo — copiado de `asistencia-clase-b-content` (spec 0030/0031), pero como **header del panel fill** (mockup aprobado por el owner)
- `[appBentoReveal]` + `[appBentoGridLayout]`, `[appCardHover]` (sin `overflow-hidden` en el wrapper fill — fix-045)

### Componentes/Facades que NO existen y debemos crear
- Los 2 Dumb de tablas (arriba). Justificación: hoy son markup inline duplicado dentro del Smart; ningún componente del DS cubre "tabla de alumnos con avatar + badges + selección". Colocated (no `shared/`) porque su único consumidor es esta página — mismo criterio que `session-day-card`.
- **No** se usa `LayoutService`/`sliceByBudget`: el dual mode lo resuelve CSS por contenedor y las listas son cortas (alumnos por curso profesional); no hay presupuesto de filas ni "Cargar más".

---

## 4. Modelo de datos

N/A — spec 100% frontend. Sin migraciones, sin RLS, sin modelos DTO nuevos. Se reutiliza `core/models/ui/sesion-profesional.model.ts` (`AlumnoFirmaSemana`, `ResumenAlumnoAsistencia`) como tipos de los inputs de los Dumb nuevos.

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
/app/admin/clase-profesional/asistencia          /app/secretaria/profesional/asistencia
        │                                                  │ (thin-wrapper, intacto)
        ▼                                                  ▼
AdminProfesionalAsistenciaComponent  ◄─────────────────────┘
  ├─ inject(AsistenciaProfesionalFacade)   ← sin cambios
  ├─ inject(BranchFacade)                  ← setProfessionalOnly on/off
  ├─ activeTab = signal<'firma'|'resumen'>('firma')
  │
  └─ <div class="bento-grid bento-grid--fill-screen-kpi" appBentoReveal appBentoGridLayout>
       ├─ <app-section-hero density="slim" [kpis]>          (fila 1, auto)
       ├─ <div class="bento-banner card">                    (fila 2, auto)
       │    ├─ toolbar: p-select ×2 + nav semana
       │    └─ mapa semanal: <app-session-day-card> ×6 ─(selectSession)→ drawer
       └─ <div class="bento-banner bento-fill flex flex-col"> (fila 3, 1fr)
            ├─ header card: tabs [Firma semanal | Resumen] + contador N/M
            └─ cuerpo overflow-y-auto:
                 @if tab firma   → <app-firma-semanal-table  [alumnos] [isSaving] (registrarFirmas)>
                 @if tab resumen → <app-resumen-alumnos-table [alumnos]>
```

### Capas tocadas

- **Smart**: `features/admin/profesional-asistencia/admin-profesional-asistencia.component.ts`
- **Dumb**: `features/admin/profesional-asistencia/{firma-semanal-table,resumen-alumnos-table,session-day-card}.component.ts` (colocated)
- **Facade**: ninguno (cero cambios)
- **Routes**: `app.routes.ts` (solo eliminación)
- **Migration**: ninguna

---

## 6. Restricciones aplicables (referencia al sistema Koa)

- [x] `architecture.md` — OnPush, `@if/@for`, `input()/output()`, Smart coordina Dumbs
- [ ] `facades.md` — no se toca el facade (branch-scope ya resuelto vía `setProfessionalOnly`)
- [x] `models.md` — los Dumb tipan inputs con modelos `ui/` existentes (nada de DTO en componentes)
- [x] `visual-system.md` — tokens, `--fill-screen-kpi`, `.bento-fill`, app-badge, appBentoReveal, regla 3-2-1, skeleton single-component
- [ ] `swr-pattern.md` — ya implementado en el facade; no se modifica
- [ ] `notifications.md` — no aplica (toasts existentes del facade intactos)
- [x] `testing-tdd.md` — sin lógica core nueva; los component specs están excluidos del runner (ver §7); suite existente debe seguir verde
- [x] `ai-readability.md` — conservar `data-llm-action` (registrar firmas, checkboxes, sesiones) y añadir `data-llm-action` a los botones de tab (patrón 0030)

---

## 7. Plan de testing

- **Tests unitarios**: sin specs nuevos — no hay lógica core nueva (facade intacto; la selección de checkboxes es estado UI trivial en el Dumb). `vitest.config` excluye component specs (canon del proyecto). Correr `npm run test:ci` completo para regresión (el spec del facade existente debe seguir verde).
- **Build**: `ng build` limpio (valida templates de los Dumb nuevos).
- **Lint**: `npm run lint:arch` sin errores nuevos vs HEAD (atención ARCH-15: los pills migran a app-badge precisamente para no sumar violaciones al ratchet).
- **QA manual (/verify con Playwright, ng serve activo)**:
  - Desktop ≥lg: documento sin scroll (AC1); tab switch sin shift (AC2); firma multi-select + registrar (AC3, con curso que tenga alumnos si el seed lo permite — si no, verificar empty states AC-E2); navegación semanal + drawer (AC4)
  - Drawer abierto → contenedor angosto: sin ruptura (AC-E1)
  - Móvil (~420px): scroll nativo (AC5)
  - Dark + light mode; skeleton primera carga (AC-E4)
  - Secretaría: `/app/secretaria/profesional/asistencia` idéntica (AC7); `/app/secretaria/asistencia/profesional` ya no existe (AC6)

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Bandas fijas (hero + mapa) dejan <300px al panel de tabs en laptops chicos | Media | Compactar paddings del mapa (`p-6`→`p-4`) y de las day-cards; validar en /verify a 1366×768; si no alcanza, reducir cabecera del día (`mb-4`→`mb-2`) |
| El `effect()` del constructor (recarga firmas al cambiar semana + limpia selección) queda huérfano al mover la selección al Dumb | Media | El Dumb resetea su selección cuando cambia el input `alumnos` (linkedSignal); el effect del Smart conserva solo `fetchFirmasSemana()` |
| ARCH-15 ratchet cuenta pills movidos como nuevos | Media | Migrar `.pct-badge`/`.firma-badge` a `<app-badge>` en el mismo commit que la extracción |
| `contain: size` + appCardHover recorta glow (fix-045) | Baja | Sin `overflow-hidden` en el wrapper `.bento-fill`; el scroll lo dueña el cuerpo interno |
| Links guardados a la ruta huérfana | Baja | Grep confirmó: solo `app.routes.ts` la referencia; el owner decidió eliminar sin redirect |
| Backticks en comentarios del template literal rompen el build en silencio (lección 0030) | Baja | No usar backticks en comentarios HTML; `ng build` como gate |

---

## 9. Orden de implementación

1. **T1** — Extraer `firma-semanal-table` + `resumen-alumnos-table` (Dumb colocated, pills → `<app-badge>`, selección local con reset por input) y conectarlas en el template actual (aún sin fill-screen). Gate: `ng build`.
2. **T2** — Shell app-like: `--fill-screen-kpi` + `[appBentoReveal]`, panel `.bento-fill` con header de tabs + cuerpo scroll interno; eliminar código muerto, `mb-6`, estilos huérfanos. Gate: `ng build`.
3. **T3** — Densidad: compactar mapa semanal y fix truncado "PENDIEN" en `session-day-card`. Gate: `ng build`.
4. **T4** — Eliminar duplicado huérfano + ruta; `npm run indices:sync` (ROUTES.md). Gate: `ng build`.
5. **T5** — Validación: `npm run test:ci`, `npm run lint:arch` (diff vs HEAD), `ng build`.
6. **T6** — `/verify` visual (desktop/móvil/drawer/dark) + actualización `indices/COMPONENTS.md` + acceptance.

---

## 10. Estimación

M — 1 día de trabajo efectivo (refactor de vista sin cambios de datos).

---

## Changelog

- 2026-07-21 — plan inicial (sesión loop autónoma; talla M asumida por continuidad delegada del owner)
