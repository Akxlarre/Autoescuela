# Acceptance 0038-b — Ventana de período en listas históricas

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-08-22
> **Verifier:** Claude (implementación) · pendiente visto bueno del owner

---

## Resumen

- AC totales: 11 (7 + 4 edge cases)
- AC cumplidos: 11
- AC con QA visual en navegador real: 4 superficies verificadas (AC1, AC3, AC5, AC-E3)
- Suite: **2229 passed / 5 skipped**, `tsc --noEmit` limpio, `lint:arch` exit 0

**Veredicto final:** ✅ PASA

---

## Verificación por AC

### AC1 — Ventana de 12 meses por defecto
- **Estado:** ✅ cumplido
- **Evidencia:** `DEFAULT_PERIOD_WINDOW = 'last-12-months'`, test "el default del proyecto es la
  ventana de 12 meses". Verificado en navegador en las 4 superficies: el control abre en
  "Últimos 12 meses".

### AC2 — La búsqueda atraviesa la ventana
- **Estado:** ✅ cumplido
- **Evidencia:** `applyPeriodWindow` retorna `[...items]` con `hasActiveSearch: true` **antes** de
  evaluar cualquier corte. Tests: "con búsqueda activa devuelve también los registros fuera de la
  ventana" y "la búsqueda activa manda incluso sobre la ventana más restrictiva".
- **Nota:** es el AC central de la spec. Está cubierto en la función pura, así que las 4
  superficies lo heredan por construcción en vez de reimplementarlo.

### AC3 — Nota "Buscando en todo el historial"
- **Estado:** ✅ cumplido, **verificado visualmente**
- **Evidencia:** `@if (searchActive())` en `period-selector.component.ts` con `role="status"` y
  `aria-live="polite"`. Captura en `/app/admin/ex-alumnos`: al escribir "Morales" aparece la nota
  bajo el selector y la lista filtra a 1 resultado.

### AC4 — El export parte del dataset completo
- **Estado:** ✅ cumplido — **por ausencia de riesgo, no por código nuevo**
- **Evidencia:**
  - `ex-alumnos` (Clase B y Profesional): **no existe export**. Sin botón en las 3 vistas y sin
    método en `ExAlumnosFacade`.
  - `servicios-especiales`: exporta vía Edge Function `export-special-services`, que recibe solo
    `format` y `branch_id`. Es server-side y estructuralmente ciego a los filtros de UI.
- **Nota:** el riesgo que la investigación marcaba como el peor de los tres (planilla truncada en
  silencio) **no existía en ninguna superficie**. Se verificó en vez de asumirse.

### AC5 — Un solo control de tiempo en Clase B
- **Estado:** ✅ cumplido, **verificado visualmente**
- **Evidencia:** `filtroAnio` y `yearSelectOptions` eliminados de ambas páginas; los años entran
  como opciones del selector vía el input `years`. Captura de `/app/admin/ex-alumnos`: un solo
  control, sin el `p-select` de años.

### AC6 — `.limit(200)` en deudores
- **Estado:** ✅ cumplido
- **Evidencia:** `pagos.facade.ts` → `fetchAlumnosConDeuda`, tras `.order('pending_balance', desc)`.
  15/15 tests del facade sin regresión.

### AC7 — Dumb compartido reutilizado por las 4 superficies
- **Estado:** ✅ cumplido
- **Evidencia:** `app-period-selector` importado en los 4 consumidores. Sin inyección de Facades
  ni servicios. Registrado en `indices/COMPONENTS.md`.

---

## Edge cases

### AC-E1 — Registros sin fecha se conservan
- **Estado:** ✅ cumplido
- **Evidencia:** test "conserva los registros sin fecha en vez de descartarlos en silencio".

### AC-E2 — Elegir un año viejo no devuelve vacío
- **Estado:** ✅ cumplido
- **Evidencia:** test "un año viejo NO queda vacío por la ventana de 12 meses — es su propia
  ventana". Es el test de regresión del bug que motivó la unificación de AC5.

### AC-E3 — "Limpiar filtros" vuelve al default acotado
- **Estado:** ✅ cumplido, **verificado visualmente**
- **Evidencia:** `clearFilters()` hace `periodWindow.set(DEFAULT_PERIOD_WINDOW)` en ambas páginas
  de Clase B — no `'all'`.

### AC-E4 — Precisión de día en la ventana
- **Estado:** ✅ cumplido
- **Evidencia:** `fechaEgreso` en `EgresadoTableRow` + test "mapea fechaEgreso con precisión de
  día" (`updated_at: '2025-12-28T18:30:00Z'` → `'2025-12-28'`).

---

## Hallazgos fuera del contrato

1. **Corrección de precisión (AC-E4)** — no estaba en `ASG-b-087`; salió al cablear. Sin ella la
   ventana de 12 meses erraba por hasta 11 meses.
2. **Referencia obsoleta en la asignación** — `fetchDeudores` se había renombrado a
   `fetchAlumnosConDeuda` durante los 19 días que la asignación pasó sin mergear.
3. **Trampa de backticks** — un comentario con backticks dentro de un `template` literal terminó
   el string antes de tiempo y produjo 3 errores de `tsc` en lugares no relacionados. Es la trampa
   documentada en `visual-system.md` (spec 0030); quedó una nota en el propio comentario.
4. **`InvalidStateError` de View Transitions** — error de consola preexistente al operar drawers,
   ajeno a esta spec. Registrado en `ASG-b-095`.

---

## Deuda conocida y aceptada

- El selector quedó **cableado dos veces** en Clase B (admin + secretaría), porque esas dos
  páginas son ~93% duplicadas. Decisión consciente: no bloquear una P1 con un refactor sin dueño.
  Registrado como **`ASG-b-096`**, que debe **absorber** este código al consolidar, no
  reimplementarlo.

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia
- [x] Suite completa verde (2229/2229)
- [x] `lint:arch` exit 0
- [x] QA visual en navegador en las 4 superficies
- [ ] Visto bueno visual del owner — **pendiente** (precedente spec 0030: 13/13 ACs verdes no
      garantizan que se vea bien; el juicio humano es el que cierra)
