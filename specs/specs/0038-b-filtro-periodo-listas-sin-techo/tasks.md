# Tasks 0038-b — Ventana de período en listas históricas

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done
> **Created:** 2026-08-22

---

## T1 — Núcleo funcional (TDD)

- [x] **T1.1** — `period-window.utils.spec.ts` escrito **antes** de la implementación
  - [x] Cubre browse, búsqueda activa, ventana de año, sin fecha y pureza
- [x] **T1.2** — `period-window.utils.ts`
  - [x] Reutiliza `monthsAgoIso()`, no reescribe fechas
  - [x] `cutoffIso` inyectable para determinismo
- [x] **T1.3** — 16/16 verdes

## T2 — Dumb compartido

- [x] **T2.1** — `period-selector.component.ts` (OnPush, `input()`/`output()`, sin Facades)
- [x] **T2.2** — Ícono `search` verificado en `provideIcons()` — no se registró nada nuevo
- [x] **T2.3** — `data-llm-action` / `data-llm-description` (regla de AI-readability)
- [x] **T2.4** — Input `years` para unificar el filtro de año (AC5)
- [x] **T2.5** — Registrado en `indices/COMPONENTS.md`

## T3 — Techo en deudores

- [x] **T3.1** — `.limit(200)` en `fetchAlumnosConDeuda` (AC6)
- [x] **T3.2** — 15/15 de `pagos.facade.spec.ts` sin regresión

## T4 — Precisión de fecha

- [x] **T4.1** — `fechaEgreso` en `EgresadoTableRow`
- [x] **T4.2** — Mapeo en `ExAlumnosFacade`
- [x] **T4.3** — Test "mapea fechaEgreso con precisión de día" (AC-E4)

## T5 — Cableado de las 4 superficies

- [x] **T5.1** — `servicios-especiales-content` — verificado en navegador
- [x] **T5.2** — `admin-ex-alumnos` — elimina `filtroAnio`/`yearSelectOptions`; verificado en
      navegador, incluida la nota de búsqueda (AC3)
- [x] **T5.3** — `secretaria-ex-alumnos` — verificado en navegador
- [x] **T5.4** — `ex-alumnos-profesional-content` — verificado en navegador
- [x] **T5.5** — `clearFilters` vuelve al DEFAULT en ambas páginas de Clase B (AC-E3)

## T6 — Validación

- [x] **T6.1** — `tsc --noEmit` limpio
- [x] **T6.2** — `npm run test:ci` → **2229 passed / 5 skipped** (180 archivos)
- [x] **T6.3** — `npm run lint:arch` → exit 0, sin errores nuevos
- [x] **T6.4** — `/verify` en las 4 superficies, modo oscuro incluido
- [x] **T6.5** — Índices sincronizados (`COMPONENTS.md`, `UTILS.md`, `MODELS.md`)

## T7 — Conversión de track

- [x] **T7.1** — `fix-147-b` marcado `superseded`, apuntando a esta spec
- [x] **T7.2** — `ASG-b-087` re-apunta a `0038-b`
- [x] **T7.3** — `ROADMAP.md` actualizado
