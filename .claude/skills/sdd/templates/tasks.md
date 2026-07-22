# Tasks {{ID}} — {{TITLE}}

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
> **Created:** {{DATE}}

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 1 — Datos y modelo

- [ ] **T1.1** — Crear migración `YYYYMMDDHHMMSS_dominio_tipo_desc.sql`
  - **AC ref:** AC1, AC2
  - **DoD:**
    - [ ] Archivo creado con naming correcto
    - [ ] CREATE TABLE incluye `ENABLE ROW LEVEL SECURITY`
    - [ ] Policies SELECT/INSERT/UPDATE/DELETE definidas
    - [ ] `npx supabase db reset` corre sin error
    - [ ] Documentado en `indices/DATABASE.md`

- [ ] **T1.2** — Crear DTO en `core/models/dto/xxx.model.ts`
  - **DoD:**
    - [ ] Interface en PascalCase singular
    - [ ] Campos mapean 1:1 con la tabla
    - [ ] Documentado en `indices/MODELS.md`

- [ ] **T1.3** — Crear UI Model en `core/models/ui/xxx.model.ts` (si aplica)
  - **DoD:**
    - [ ] Extiende DTO con `extends` / `Pick` / `Omit`
    - [ ] Justifica por qué no basta el DTO

---

## Fase 2 — Capa Facade

- [ ] **T2.1** — Escribir `xxx.facade.spec.ts` PRIMERO (TDD)
  - **DoD:**
    - [ ] Tests cubren AC1, AC2 de la spec
    - [ ] Tests cubren edge cases (AC-E*)
    - [ ] Tests FALLAN (no hay implementación aún)

- [ ] **T2.2** — Implementar `xxx.facade.ts`
  - **AC ref:** AC1, AC2, AC-E1
  - **DoD:**
    - [ ] Tests PASAN (`npm run test:ci`)
    - [ ] Estructura: estado privado → estado público readonly → métodos
    - [ ] catchError en cada llamada async
    - [ ] Signal de error expuesto
    - [ ] (Si aplica) `BranchFacade` inyectado para scope multi-sede
    - [ ] Documentado en `indices/FACADES.md`

- [ ] **T2.3** — (Si aplica SWR) Implementar `initialize()` con guard y `refreshSilently()`
  - **DoD:**
    - [ ] Flag `_initialized` agregado
    - [ ] Primera carga muestra skeleton; re-entradas no
    - [ ] Conforme con `.claude/rules/swr-pattern.md`

---

## Fase 3 — Capa UI

- [ ] **T3.1** — Crear/extender Smart Component `features/.../xxx.component.ts`
  - **AC ref:** AC3, AC4
  - **DoD:**
    - [ ] OnPush
    - [ ] Inyecta Facade
    - [ ] (Si aplica) `effect()` para reactividad branch
    - [ ] `destroyRef.onDestroy(() => facade.dispose())` si hay realtime
    - [ ] Bento grid como raíz
    - [ ] Documentado en `indices/COMPONENTS.md`

- [ ] **T3.2** — Crear Dumb Components necesarios en `shared/components/...`
  - **DoD por cada dumb:**
    - [ ] OnPush
    - [ ] Solo `input()` / `output()` (no Facades)
    - [ ] Skeleton colocated si recibe data async
    - [ ] Tokens de color (no Tailwind hardcodeado)
    - [ ] `<app-icon>` para íconos (no SVG inline ni emojis)
    - [ ] `data-llm-action` / `data-llm-description` donde corresponda
    - [ ] Tests si tiene `computed()` o lógica derivada
    - [ ] Documentado en `indices/COMPONENTS.md`

---

## Fase 4 — Conexión y animación

- [ ] **T4.1** — Wire-up: Smart → Dumb pasando signals
  - **DoD:**
    - [ ] Loading/error/empty states cubiertos
    - [ ] AC verificables manualmente en browser

- [ ] **T4.2** — Animación de entrada con `GsapAnimationsService`
  - **DoD:**
    - [ ] `animateBentoGrid()` o equivalente en `ngAfterViewInit`
    - [ ] `clearProps: 'transform'` post-animación
    - [ ] No `@angular/animations`, no `@keyframes`

---

## Fase 5 — Validación

- [ ] **T5.1** — `npm run lint:arch` corre limpio
- [ ] **T5.2** — `npm run test:ci` corre verde
- [ ] **T5.3** — QA manual del happy path + edge cases
  - **DoD:** Cada AC marcado con evidencia en `acceptance.md`

- [ ] **T5.4** — Ejecutar `/spec-verify`
  - **DoD:** AC Verifier devuelve `{ok: true}` o tickets restantes resueltos

---

## Fase 6 — Cierre

- [ ] **T6.1** — Actualizar `indices/` con todo lo nuevo (`/sync-indices`)
- [ ] **T6.2** — Marcar spec como `done` en `ROADMAP.md`
- [ ] **T6.3** — Limpiar `specs/.active` (`/spec-activate --clear`)

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [ ] …
