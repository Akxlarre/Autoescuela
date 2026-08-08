# Fix: Hover de fila/item de lista inconsistente en toda la app
> id: fix-119-b-hover-fila-lista-inconsistente
> refs: —
> status: done
> created: 2026-08-04

## Root Cause

No existe ninguna utility canónica para el hover de fila/item de lista. Cada componente
eligió el token a mano, resultando en dos colores en competencia para el mismo propósito:

- `hover:bg-subtle` → 37 archivos (token `--bg-subtle`, el mismo que usa `.btn-ghost` para
  su hover — ver `tailwind.css:242` / `_variables.scss:278`). Ejemplo:
  `live-classes-panel.component.ts:109` (widget "Clases actuales" del Dashboard).
- `hover:bg-elevated` → 17 archivos (token `--bg-elevated`, distinto). Ejemplo:
  `asistencia-clase-b-content.component.ts:225,469`.

Además, en tablas PrimeNG el hover de fila puede quedar invisible aunque el markup lo
declare correctamente: `alumnos-list-content.component.ts:382` sí tiene `hover:bg-subtle`
en el `<tr>`, pero `_primeng-overrides.scss:919-922` pinta cada `<td>` con
`background: var(--bg-surface) !important` — CSS plano sin `@layer`, que gana sobre
cualquier utility de Tailwind independientemente de especificidad. El `<td>` opaco tapa
visualmente el hover del `<tr>` que está debajo.

## ACs Afectados

Ninguno — fix autónomo de consistencia visual, no ligado a una spec previa.

- AC-1: Todas las filas/items de lista de la app usan el mismo color de hover
  (`var(--btn-ghost-bg-hover)` = `--bg-subtle`, coherente con `.btn-ghost` y con el
  Dashboard).
- AC-2: El hover de fila es visible en tablas PrimeNG (ej. Base de Alumnos B), sin quedar
  tapado por el fondo opaco de `<td>`.

## Cambio

> Nota de alcance: al implementar se re-auditaron los 37+17 archivos citados en Root Cause
> con lectura de contexto (no solo grep). La mayoría de esos hits son botones de ícono
> (`p-button-rounded ...`) o botones/chips genéricos que usan `hover:bg-subtle`/`hover:bg-elevated`
> legítimamente — ya son tokens del DS, no la fuga de color descrita, y tienen un target
> más chico (ícono flotante) que sí justifica un tono más "elevado" para destacar contra la
> fila ya resaltada. Migrar esos también habría sido scope creep sin causa raíz real. El
> cambio se acotó a los elementos que SÍ son fila/item de lista completo:

- **Archivo:** `src/tailwind.css` — nuevo `@utility list-item-hover` (reutiliza
  `var(--btn-ghost-bg-hover)`), justo después de `btn-sm`.
- **Archivo:** `src/styles/vendors/_primeng-overrides.scss` — agregado
  `.p-datatable-tbody > tr:hover > td { background: var(--btn-ghost-bg-hover) !important; }`
  después del bloque `tr > td` (AC-2): la mayor especificidad de `:hover` gana sobre la regla
  base sin tocar el markup del `<tr>`.
- **Filas `<tr>` migradas a `list-item-hover`** (ya usaban `hover:bg-subtle`, ahora nombre
  canónico): `secretaria-profesional-notas.component.ts:322`,
  `alumnos-profesional-list-content.component.ts:234`, `alumnos-list-content.component.ts:382`,
  `flota-list-content.component.ts:226`, `ex-alumnos-profesional-content.component.ts:163`,
  `secretaria-ex-alumnos.component.ts:177`, `admin-profesional-relatores.component.ts:189`,
  `admin-profesional-evaluaciones.component.ts:358`, `admin-ex-alumnos.component.ts:178`,
  `vehicle-maintenances.component.ts:147`.
- **Filas/items que usaban `hover:bg-elevated` (token incorrecto) migradas a
  `list-item-hover`:** `asistencia-clase-b-content.component.ts:225` (item de rail de
  alertas), `asistencia-clase-b-content.component.ts:469` (`<tr>` de tabla),
  `instructor-dashboard.component.ts:147` (item de lista "clases de hoy"),
  `ciclos-teoricos-content.component.ts:381,626` (items de roster).
- **Fuera de alcance (dejado igual a propósito):** botones/chips e íconos de acción que
  usan `hover:bg-subtle`/`hover:bg-elevated` (no son fila/lista); `hover:bg-subtle/50` en
  `instructor-liquidacion.component.ts:100` e `instructor-ensayos-teoricos.component.ts:126`
  (mismo token base, solo opacidad reducida — no es la inconsistencia real); tarjetas tipo
  `admin-historial-pagos.component.ts:63`/`admin-ficha-tecnica.component.ts:63` (familia
  `bg-elevated` propia y consistente internamente, no un row plano).

## Test de Regresión

- `npm run lint:arch` — ✓ verde (0 errores, 169 advertencias pre-existentes sin relación).
- `npx ng build` — ✓ compila sin errores (solo warning pre-existente de bundle budget), con el
  árbol de trabajo en el estado en que quedó este fix.
- Verificación visual — ✓ **ejecutada en navegador real** (Browser pane, admin logueado,
  `getComputedStyle` + `:hover` real vía `computer.hover` sobre coordenadas calibradas, no
  simulado):
  - **Dashboard admin** (`live-classes-panel`, item "Clases Actuales") → hover real:
    `background-color: rgb(228, 228, 231)`.
  - **Asistencia B** (`asistencia-clase-b-content`) → tabla "Asistencia del Día" (`<tr
    class="list-item-hover">`) → hover real: `rgb(228, 228, 231)`. Rail de alertas (`<div
    class="list-item-hover">`) → hover real: `rgb(228, 228, 231)`. Mismo valor que el
    Dashboard → **AC-1 confirmado**.
  - **Base de Alumnos B** (`alumnos-list-content`, `<p-table>` real — confirmado
    `closest('.p-datatable')`) → antes del fix el `<td>` quedaba en blanco
    (`rgb(255, 255, 255)`, el `!important` de `_primeng-overrides.scss` tapaba el hover);
    con el fix, hover real → `<td>` pasa a `rgb(228, 228, 231)`, mismo valor que los casos
    anteriores. Confirmado también con captura de pantalla (fila "Test Prueba Alumna"
    visiblemente resaltada vs. el resto en blanco) → **AC-2 confirmado**.
  - Consola: sin errores nuevos atribuibles a este fix (los únicos `InvalidStateError:
    Transition was aborted` presentes ya aparecían antes de interactuar con ningún elemento
    tocado por este fix — ruido de View Transitions del router, no relacionado).
