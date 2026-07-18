# Tasks 0008-b — Eliminar estilos inline — migrar a clases semánticas del design system

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
> **Created:** 2026-05-27

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 1 — Design System: nuevas utilities

- [ ] **T1.1** — Añadir `@utility btn-outline` en `src/tailwind.css`
  - **AC ref:** AC3, AC4, AC5, AC-E1
  - **DoD:**
    - [ ] Clase añadida después de `@utility btn-neutral` (mantener orden existente)
    - [ ] Usa tokens: `--border-muted`, `--bg-surface`, `--text-primary`, `--radius-md`, `--transition-btn`
    - [ ] `:hover:not(:disabled)` → `background: var(--bg-elevated)`
    - [ ] `:disabled` → `opacity: 0.4; cursor: not-allowed` (sin `style=""`)
    - [ ] `ng build` corre limpio — la clase aparece en el CSS generado
    - [ ] Documentado en `indices/STYLES.md` (tabla "Component Utility Classes")

- [ ] **T1.2** — Añadir `@utility badge-warning`, `badge-success`, `badge-error`, `badge-info` en `src/tailwind.css`
  - **AC ref:** AC-E2
  - **DoD:**
    - [ ] 4 clases añadidas, usan tokens `--state-*-bg`, `--state-*`, `--state-*-border`
    - [ ] Padding compacto (`py-0.5 px-2`), `border-radius: var(--radius-md)`, `font-size: 0.75rem`
    - [ ] Verificar visualmente que el fondo es equivalente al `color-mix(in srgb, var(--state-*) 12%, transparent)` actual
    - [ ] `ng build` corre limpio
    - [ ] Documentado en `indices/STYLES.md`

---

## Fase 2 — `admin-pagos`: caso original

- [ ] **T2.1** — Migrar botones de paginación en `admin-pagos.component.ts`
  - **AC ref:** AC4, AC5, AC-E1
  - **DoD:**
    - [ ] Botones "Anterior" y "Siguiente" usan `class="btn-outline"` — sin atributo `style`
    - [ ] El estado `disabled` del botón "Anterior" (primera página) se controla con `[disabled]="condicion"` — la opacidad la aplica CSS del `btn-outline`
    - [ ] QA visual: página admin-pagos en modo claro — botones iguales a antes
    - [ ] QA visual: página admin-pagos en modo oscuro — botones se adaptan correctamente
    - [ ] Grep confirma: `grep "opacity: 0.4" admin-pagos.component.ts` → 0 resultados

---

## Fase 3 — Sweep estático de `style=""` en `features/` y `shared/`

- [ ] **T3.1** — Migrar `task-detail-modal.component.ts`
  - **AC ref:** AC1
  - **DoD:**
    - [ ] Todos los `style="color: var(--text-muted)"` → `class="text-text-muted"`
    - [ ] Todos los `style="color: var(--text-primary)"` → `class="text-text-primary"`
    - [ ] `style="background: var(--bg-subtle)"` → `class="bg-subtle"`
    - [ ] `style="border-color: var(--border-default)"` → `class="border-border-default"`
    - [ ] `ng build` limpio
    - [ ] Grep confirma: 0 ocurrencias de `style="color: var(--text-` en el archivo

- [ ] **T3.2** — Migrar `task-create-drawer.component.ts`
  - **AC ref:** AC1
  - **DoD:**
    - [ ] Todos los `style="color: var(--text-muted)"` → `class="text-text-muted"`
    - [ ] `<span style="color: var(--state-error)">*</span>` → `<span class="text-error">*</span>`
    - [ ] Grep confirma: 0 ocurrencias de `style="color: var(--text-` en el archivo

- [ ] **T3.3** — Migrar `alert-card.component.ts`
  - **AC ref:** AC2
  - **DoD:**
    - [ ] `style="color: var(--text-muted)"` → `class="text-text-muted"`
    - [ ] Grep confirma: 0 ocurrencias en el archivo

- [ ] **T3.4** — Migrar `alumnos-list-content.component.ts`
  - **AC ref:** AC2
  - **DoD:**
    - [ ] `style="border-bottom: 1px solid var(--border-default)"` → `class="border-b border-border-default"`
    - [ ] `style="color: var(--text-muted)"` → `class="text-text-muted"`
    - [ ] `style="border-color: var(--border-default); background: var(--bg-surface); color: var(--text-primary)"` (input de búsqueda) → clases equivalentes
    - [ ] Grep confirma: 0 ocurrencias de los patrones en el archivo

- [ ] **T3.5** — Sweep extendido: ejecutar grep y migrar los `style="color: var(--text-` y `style="color: var(--state-` restantes en `features/` y `shared/`
  - **AC ref:** AC1, AC2
  - **DoD:**
    - [ ] `grep -rn "style=\"color: var(--text-" src/app/features/ src/app/shared/` → 0 resultados
    - [ ] `grep -rn "style=\"color: var(--state-" src/app/features/ src/app/shared/` → 0 resultados
    - [ ] `ng build` limpio

---

## Fase 4 — Refactor `color-mix()` dinámico

- [ ] **T4.1** — Migrar casos estáticos simples de `color-mix()` en `admin-clase-online-drawer.component.ts`
  - **AC ref:** AC-E2
  - **DoD:**
    - [ ] `style="background: color-mix(in srgb, var(--state-warning) 10%, transparent)"` → `class="badge-warning"`
    - [ ] `style="background: color-mix(in srgb, var(--state-success) 12%, transparent)"` → `class="badge-success"`
    - [ ] `style="background: color-mix(in srgb, var(--state-error) 12%, transparent)"` → `class="badge-error"`
    - [ ] QA visual: colores de banners iguales a antes

- [ ] **T4.2** — Migrar ternarios `[style.background]` en `agendar-teoria-drawer.component.ts`
  - **AC ref:** AC-E2
  - **DoD:**
    - [ ] `[style.background]="condition ? 'color-mix(success)' : 'color-mix(warning)'"` → `[class.badge-success]="condition" [class.badge-warning]="!condition"`
    - [ ] QA visual: colores de filas de alumnos (presente/ausente) iguales a antes

- [ ] **T4.3** — Migrar métodos `getRowBackground()` / `getCardStyle()` en `asistencia-teoria-drawer.component.ts`
  - **AC ref:** AC-E2
  - **DoD:**
    - [ ] Métodos que retornan `color-mix()` string reemplazados por métodos que retornan nombre de clase CSS
    - [ ] Template binding cambiado de `[style.background]="getStyle()"` → `[class]="getClass()"`
    - [ ] QA visual: colores de estados de asistencia correctos

- [ ] **T4.4** — Sweep de `color-mix()` en archivos restantes de `features/` (lote)
  - **DoD:**
    - [ ] `grep -rn "color-mix(in srgb, var(--state-" src/app/features/ src/app/shared/` → 0 resultados (excluyendo `_primeng-overrides.scss` y `tailwind.css`)
    - [ ] `ng build` limpio
    - [ ] QA visual en al menos 3 vistas representativas

---

## Fase 5 — Validación

- [ ] **T5.1** — `npm run lint:arch` corre limpio
  - **DoD:** 0 errores arquitectónicos

- [ ] **T5.2** — Verificación grep final de todos los ACs
  - **DoD:**
    - [ ] AC1: `grep -rn "style=\"color: var(--text-" src/app/features/` → 0
    - [ ] AC2: `grep -rn "style=\"color: var(--text-" src/app/shared/` → 0
    - [ ] AC3: `.btn-outline` existe en `src/tailwind.css`
    - [ ] AC4: `grep "style=" src/app/features/admin/pagos/admin-pagos.component.ts` → sin inline styles en los botones de paginación
    - [ ] AC-E1: `grep "opacity: 0.4" src/app/features/admin/pagos/admin-pagos.component.ts` → 0

- [ ] **T5.3** — QA visual modo oscuro
  - **DoD:**
    - [ ] `btn-outline` en admin-pagos se ve correcto en dark
    - [ ] `badge-*` en al menos 1 drawer se ven correctos en dark
    - [ ] Ningún elemento tiene color fijo roto en dark mode

- [ ] **T5.4** — Ejecutar `/spec-verify`
  - **DoD:** Todos los ACs verificados con evidencia en `acceptance.md`

---

## Fase 6 — Cierre

- [ ] **T6.1** — Actualizar `indices/STYLES.md` con `btn-outline` y `badge-*` (`/sync-indices`)
- [ ] **T6.2** — Marcar spec `0008-b` como `done` en `specs/ROADMAP.md`
- [ ] **T6.3** — Limpiar `specs/.active` con `/spec-activate --clear`

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [ ] …
