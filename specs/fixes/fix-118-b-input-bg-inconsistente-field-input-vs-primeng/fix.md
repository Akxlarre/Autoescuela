# Fix: Fondo de input inconsistente entre `.field-input` (nativo) y PrimeNG — campos de dinero se ven más oscuros
> id: fix-118-b-input-bg-inconsistente-field-input-vs-primeng
> refs: —
> status: done
> closed: 2026-08-05
> created: 2026-08-04

## Root Cause

Dos sistemas de fondo de input conviven sin usar el token canónico documentado:

1. `.field-input` (input nativo, usado sobre todo para campos numéricos/monto sin
   equivalente limpio en PrimeNG — `total_amount`, `cash_amount`, `precio`, etc.) tiene
   `background: var(--bg-base)` tanto en el canon centralizado
   (`src/styles/components/_form-fields.scss:29`) como en copias locales no migradas
   dentro de `styles:` de varios drawers (ej. `registrar-pago-drawer.component.ts:491`).
   `--bg-base` es el token de fondo de **página** (`#f4f4f5` light / `#09090b` dark).

2. Los inputs PrimeNG (`p-select`, `p-datepicker`, `p-autocomplete`, `p-inputtext`, etc.)
   usan `--p-inputtext-background: var(--bg-surface)`
   (`src/styles/vendors/_primeng-overrides.scss:20`) — el token de fondo de **superficie**
   (`#ffffff` light / `#18181b` dark), igual al del propio modal/drawer
   (`--modal-bg: var(--bg-surface)`, `_variables.scss:350`).

Como un mismo form mezcla inputs nativos (dinero) con inputs PrimeNG (selects, fechas),
y el drawer que los contiene usa `--bg-surface`, el resultado es: los PrimeNG se
funden con el panel (mismo blanco/gris oscuro), y los `.field-input` quedan como una
caja visiblemente más oscura encima — más notorio aún en dark mode
(`#18181b` del modal vs `#09090b` del input).

Además, `_variables.scss:307-310` ya documenta un token pensado exactamente para esto —
`--input-bg: var(--bg-subtle)`, con el comentario "visible sobre --bg-elevated en ambos
temas. Incluye todos los estados: default, focus, error, success, disabled" — pero
**ningún** input real lo consume; ambos sistemas definieron su propio valor por su cuenta.

## ACs Afectados

Ninguno — fix autónomo de identidad visual/consistencia, no ligado a una spec previa.

## Cambio

- **Archivo:** `src/styles/components/_form-fields.scss`
  - `.field-input` (y su bloque `--error`/`--valid` si aplica): `background: var(--bg-base)` → `background: var(--input-bg)`.
- **Archivo:** `src/styles/vendors/_primeng-overrides.scss`
  - `--p-inputtext-background: var(--bg-surface)` → `--p-inputtext-background: var(--input-bg)`.
  - `--p-select-background: var(--bg-surface)` → `--p-select-background: var(--input-bg)` (la caja cerrada del dropdown, mismo rol que un campo de texto).
  - Revisados el resto de los `--p-*-background` en `var(--bg-surface)` — quedan sin tocar a propósito porque son paneles/overlays que sí deben fundirse con el modal (`--p-card-background`, `--p-dialog-background`, `--p-popover-background`, `--p-menu-background`, `--p-paginator-background`, `--p-datatable-row-background`, `--p-datepicker-*-background` — el panel del calendario, no el campo de texto que lo abre — y `--p-select-overlay-background`, el panel flotante de opciones). `--p-checkbox-background` / `--p-radiobutton-background` tampoco se tocaron: son indicadores pequeños, no campos de entrada de texto.
- **~22 archivos con `.field-input` duplicado localmente en `styles:`** (ej. `registrar-pago-drawer.component.ts:491`, `configurador-horarios-drawer.component.ts`, `admin-instructor-crear-drawer.component.ts`, etc. — lista completa vía `grep -rl "class=\"field-input"` en `src/app`): mismo cambio `var(--bg-base)` → `var(--input-bg)` donde el bloque local redefine `background` para `.field-input`.
- **Token:** `_variables.scss` no cambia — `--input-bg: var(--bg-subtle)` ya es correcto, solo se conecta a sus consumidores reales.

### Correcciones post-feedback visual (2026-08-05)

El dueño del producto revisó el resultado en vivo (screenshots reales de "Nuevo Curso
Especial" y "Nueva Matrícula") y no le gustó el tono `--bg-subtle` (#e4e4e7): se veía más
gris que el resto de los inputs nativos sueltos del proyecto (ej. `admin-curso-singular-crear-drawer`,
que usa la clase Tailwind `bg-base` directo, sin pasar por `.field-input`). Prefirió el tono
casi blanco de esos campos ("Cupos Máx.", "Nombre del curso"). Ajustes:

- **`_variables.scss`:** `--input-bg` en modo claro pasa de `var(--bg-subtle)` a
  `var(--bg-base)` (#f4f4f5, casi blanco — mismo tono que ya usaban los inputs `bg-base`
  sueltos). **Dark mode se deja en `--bg-subtle`** (#2d2d30) a propósito: `--bg-base` en dark
  es casi negro (#09090b) y resucitaría el problema original frente al modal (#18181b). Modo
  oscuro quedó pendiente de decisión final del owner (mostrado en pantalla, sin objeción).
- **`_primeng-overrides.scss`:** se descubrió en vivo (inspección de `document.styleSheets`)
  que `--p-datepicker-background` sí estiliza el `<input>` visible del DatePicker (no solo el
  panel, como se asumió originalmente) — `.p-datepicker-input` quedaba en `--bg-surface` sin
  reaccionar al cambio de `--input-bg`. Se cambió `--p-datepicker-background: var(--bg-surface)`
  → `var(--input-bg)`. Los tokens `--p-datepicker-panel-background` / `--header-background`
  (el calendario flotante) siguen en `--bg-surface`, sin cambios.
- **`styles.scss`:** causa raíz final del caso del DatePicker: la regla base global
  `input, textarea { background-color: var(--bg-surface); }` (sin `@layer`, gana sobre
  cualquier clase de PrimeNG que no declare su propio `background-color`) se cambió a
  `background-color: var(--input-bg);`. Esta regla es el fallback de **todo** input/textarea
  nativo de la app que no tenga una clase más específica — ahora también respeta el canon.

Scope ampliado respecto al fix.md original (2 archivos nuevos: `_variables.scss` un valor,
`styles.scss` una regla) pero misma causa raíz (fondo de input no unificado bajo
`--input-bg`) y mismo día/sesión — no se abrió un fix nuevo.

## Test de Regresión

Resultado (2026-08-04):

- `npm run lint:arch` — exit 0. Sin hallazgos nuevos atribuibles a este cambio (solo warnings
  ARCH-10/11/14/19 pre-existentes, ninguno en los archivos tocados) ✓
- `npx ng build` — compiló sin errores (262s; único warning es el budget de bundle
  pre-existente, no relacionado a este cambio) ✓
- Verificación visual en el drawer real, logueado como `admin@test.com` contra el dev server
  con HMR ya aplicado (`/app/admin/pagos` → botón "Registrar Pago"). El primer intento de login
  se resetió por HMR de otra sesión activa en paralelo (`fix-119-b`); en el reintento el login y
  la navegación SPA funcionaron. Con el drawer real abierto se leyó `getComputedStyle` de los
  6 `.field-input` reales del form (identificados por su `formControlName`: `total_amount`,
  `cash_amount`, `transfer_amount`, `card_amount`, `voucher_amount`, `document_number` — los
  campos de dinero exactos que motivaron el fix) y de los `.p-select` PrimeNG del mismo drawer:
  - **Light:** los 6 `.field-input` → `rgb(228, 228, 231)` (`#e4e4e7`). El `.p-select` con
    background propio (no transparente) → el mismo `rgb(228, 228, 231)`. Antes de este fix
    `.field-input` daba `#f4f4f5` (gris página) y PrimeNG `#ffffff` (blanco, igual al modal) —
    ahora ambos sistemas coinciden ✓
  - **Dark** (toggle real de la app, `data-mode="dark"` confirmado): los 6 `.field-input` →
    `rgb(45, 45, 48)` (`#2d2d30`), igual patrón — antes hubiera sido `#09090b` vs `#18181b` ✓
  - No se pudo capturar screenshot en pixeles porque el panel del navegador embebido no estaba
    visible en pantalla en esta sesión (`the Browser pane is not displayed`), pero la lectura de
    `getComputedStyle` es sobre los nodos DOM reales y renderizados del drawer, no un elemento
    sintético — evidencia equivalente para este tipo de fix (solo color de fondo, sin cambios de
    layout/espaciado que requirieran inspección de píxeles).

**Verificación visual final (2026-08-05), con screenshot real de pantalla:**

- `npm run lint:arch` — exit 0, sin hallazgos nuevos tras los ajustes post-feedback.
- Drawers reales verificados con captura de pantalla (no solo `getComputedStyle`):
  "Nuevo Curso Especial" (`admin-curso-singular-crear-drawer`, el mismo que el owner señaló
  como referencia en su feedback) y "Nueva Matrícula" — en **light**, los 8 campos de cada
  form (texto, número/dinero, 3 `p-select`, 1 `p-datepicker` con ícono de calendario) quedan
  al mismo tono `#f4f4f5`, sin ningún campo más oscuro que otro.
- Mismo drawer en **dark** (toggle real de la app vía botón del topbar): los 8 campos quedan
  al mismo `#2d2d30`, visualmente distinto del panel (`#18181b`) pero consistente entre sí.
  Mostrado al owner sin objeción explícita — dark mode queda abierto a ajuste futuro si lo pide.
