# Tasks 0031-b — Ciclos Teóricos fill-screen + fix shift de tabs

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Status:** in_progress

---

## Fase 1 — Child: `ciclos-teoricos-content`

- [x] **T1.1** — Input `isDesktop` + host/root como celda fill
  - **AC ref:** AC2, AC4
  - **DoD:**
    - [ ] `readonly isDesktop = input(false)` (Dumb estricto, no inyecta LayoutService)
    - [ ] Host se comporta como celda fill (`display:flex; flex-direction:column` vía clases del parent o `:host`)
    - [ ] Root div: `flex-1 min-h-0 flex flex-col` (llena el host)
    - [ ] Selector de ciclo: `shrink-0`
    - [ ] Área de columnas: `flex-1 min-h-0`; switch 1↔2 columnas por `isDesktop()` (no `lg:grid-cols-3`)

- [x] **T1.2** — Columna "Clases del ciclo" con scroll interno
  - **AC ref:** AC3, AC-E3
  - **DoD:**
    - [ ] La lista de tarjetas de clase va en un wrapper `flex-1 min-h-0 overflow-y-auto`
    - [ ] El header "Clases del ciclo (N)" queda fijo (`shrink-0`)
    - [ ] El panel de destinatarios (`max-h-48 overflow-y-auto`) sigue funcionando dentro de la tarjeta
    - [ ] Roster: sin cambios (ya tiene `flex-1 min-h-0 overflow-y-auto`)

---

## Fase 2 — Parent: `asistencia-clase-b-content`

- [x] **T2.1** — Modificador fill siempre activo + celda fill para Ciclos
  - **AC ref:** AC1, AC5
  - **DoD:**
    - [ ] `bento-grid--fill-screen-kpi` deja de ser condicional por tab (siempre activo)
    - [ ] `<app-ciclos-teoricos-content>` recibe `class="... bento-fill flex flex-col min-h-0 overflow-hidden"` + `[isDesktop]="isDesktopLayout()"`
    - [ ] Tab Prácticas sin regresión (misma estructura de 3 filas)
    - [ ] `_bento-grid.scss` sin cambios (git diff)

---

## Fase 3 — Validación

- [x] **T3.1** — `ng build` + `npm run test:ci` + `npm run lint:arch` verdes; diff sin `_bento-grid.scss`
- [x] **T3.2** — QA `/verify` (Claude in Chrome, ambas rutas)
  - **AC ref:** AC1–AC4, AC-E1/E2/E3
  - **DoD:**
    - [ ] AC1: alternar tabs sin shift horizontal; ningún tab scrollea la página en desktop
    - [ ] AC2/AC3: selector fijo, columnas con scroll interno independiente
    - [ ] AC4: main angostado → apila 1 columna, scroll natural
    - [ ] Estados vacío / loading / panel destinatarios OK
    - [ ] Claro/oscuro, 0 errores consola nuevos
- [x] **T3.3** — `/spec-verify` → acceptance.md

---

## Fase 4 — Cierre

- [x] **T4.1** — `indices/COMPONENTS.md`: actualizar `ciclos-teoricos-content` (input `isDesktop`, modo fill)
- [x] **T4.2** — ROADMAP → done; `spec-activate --clear`

---

## Descubiertas

- [x] **TD-1** — (refinamiento owner, 2026-07-13) Fusionar el selector de ciclo en el header de la columna Clases (era fila-tarjeta de ~140px de un fill de 457px). Columnas ahora siempre renderizadas (estados vacíos "Selecciona un ciclo…") para no perder acceso al selector sin ciclo elegido. Clases visible 237→407px (+72%). Conteo de alumnos → header de Alumnos.
- [x] **TD-2** — El badge de estado ad-hoc (`inline-flex ... rounded-full`) disparaba ARCH-15; migrado a `<app-badge [variant]>` del DS. Lint limpio.
- [x] **TD-3** — (canon hover, feedback owner) Los componentes de Asistencia no tenían `appCardHover` (canon en 68 archivos). Agregado a los 4 paneles `.card` (tabla + alertas en Prácticas; Clases + Alumnos en Ciclos). En `asistencia-clase-b-content` la directiva estaba importada pero muerta (faltaba en `imports`). Verificado: hover aplica y:-2 y el thead sticky sigue intacto bajo hover.
