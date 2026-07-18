# Acceptance 0011-b — Auditoría UI/UX Global

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-06-04
> **Verifier:** Claude (Opus) · validado por Akxlarre

---

## Resumen

- **Alcance trabajado:** Flujo de inscripción público (`/inscripcion`), per §7 de la spec ("Flujo de inscripción pública únicamente"). Los ACs genéricos que apuntan al **panel admin** (AC-R2, tablas, KPIs, bento-grid) NO formaban parte del alcance trabajado y quedan **N/A / diferidos**.
- AC aplicables al flujo público: 8 · Cumplidos: 6 · Parciales: 2 · N/A (panel/no aplica): 5

**Veredicto final:** ⚠️ PARCIAL — flujo público auditado y pulido; 1 verificación manual pendiente (retorno success/cancelled); ACs del panel fuera del alcance §7.

---

## Verificación por AC (contra el flujo público)

### AC-R1 — sin overflow ni elementos cortados (390 / 768 / 1280)
- **Estado:** ⚠️ parcial (solo por retorno success/cancelled)
- **Evidencia:**
  - **Mobile 390** (exhaustivo): entry, datos personales, tipo de licencia, modalidad, grilla horario, foto carnet, contrato, pago, test psicológico, confirmación, orientación, draft restore, retorno (error). **0 overflow**.
  - **Desktop 1280** (8 estados): draft-restore, datos personales, modalidad, horario, tipo licencia, test psicológico, orientación, retorno-error. **0 overflow**, layouts limpios (cards centradas, 2-col bien proporcionadas).
  - **Tablet 768** (6 directos: datos personales, tipo licencia, horario, modalidad, orientación, retorno; test psicológico por inferencia de variante `sm:`). **0 overflow**.
  - Gated (foto carnet, contrato, pago, confirmación): revisados por lectura de componente (flex, sin grids forzados) — no screenshot a 768/1280 por estar detrás de 12 slots; riesgo bajo.
  - Commit `7cad8de` — indicador de progreso (mobile) recortado por el card. Commit `721263d` — cap de columna en grilla. Commit `2e0fef7` — **ISSUE-07: stepper tapado por el card en tablet/desktop** (8px); el fix mobile no cubría `sm:+` → `sm:pb-14` (clearance 16px). Reportado por el owner.
- **Notas:** Pendiente verificar visualmente los estados **retorno success / cancelled** (requieren `token_ws` válido / pago real). Deuda manual declarada (ver abajo).

### AC-DS1 — Sin colores hardcodeados / Tailwind arbitrario
- **Estado:** ✅ cumplido (flujo público)
- **Evidencia:** revisión de todos los componentes de `public-enrollment-steps/` + `public-confirmation`: usan tokens `var(--*)` y `color-mix`. El theming de sede vive scopeado en `_public-enrollment.scss` (único lugar autorizado a hardcodear hex).

### AC-DS2 — Íconos vía `<app-icon>` (sin emojis ni SVG inline)
- **Estado:** ✅ cumplido
- **Evidencia:** todos los íconos del flujo usan `<app-icon name="...">`. No se observaron emojis ni `<svg>` inline.

### AC-DS3 — Botón CTA deshabilitado usa estado `:disabled` neutro
- **Estado:** ✅ cumplido
- **Evidencia:** `.btn-primary` (`@utility` en `tailwind.css`) define `:disabled` con `bg-subtle`/`text-muted` (gris neutro). Verificado en screenshots (`docs/qa-ux/32-disabled-button-grey.png`).

### AC-P2 — Campos requeridos marcados (`*` u `(Opcional)`)
- **Estado:** ✅ cumplido
- **Evidencia:** form de datos personales muestra "Los campos marcados con * son obligatorios" + `*` por campo y `(Opcional)` en apellido materno/dirección. Verificado en vivo.

### AC-P3 — Estados de carga con skeleton/spinner (sin pantalla en blanco)
- **Estado:** ✅ cumplido
- **Evidencia:** estado `resolving` con spinner ("Cargando tu inscripción…"), grilla con `scheduleLoading`, contrato "Generando…". No se observaron pantallas en blanco.

### AC-E1 — Dark mode resuelve tokens sin romper
- **Estado:** ✅ cumplido (por diseño)
- **Evidencia:** el flujo público **fuerza modo claro** (`_public-enrollment.scss` → `color-scheme: light` + re-declara todos los tokens que `[data-mode='dark']` sobreescribe). No hay riesgo de ruptura en oscuro.

### AC-E2 — Texto largo trunca sin desbordar
- **Estado:** ⚠️ parcial
- **Evidencia:** no se probó explícitamente con nombres/direcciones extra-largos en el flujo público. Sin overflow detectado con datos normales. Pendiente prueba dedicada (bajo riesgo: el flujo no renderiza tablas densas).

### Touch targets (§7.4 — transversal)
- **Estado:** ✅ cumplido
- **Evidencia:** commit `7cad8de` (regla `min-height:44px` para `.btn-*` del flujo público + toggles Sí/No del psych-test a 44px + pill Ayuda). Verificado: "Continuar" = 44px, Sí/No = 44px.

### AC-R2, AC-R3, AC-P1, AC-P4, AC-L1, AC-L2 — N/A para el alcance trabajado
- **Estado:** ❌ no abordado / N/A
- **Notas:** apuntan al **panel admin** (sidebar tablet, tablas, KPIs, bento-grid root, modales/drawers). El flujo público es un wizard de checkout full-screen sin tablas/KPIs/bento ni sidebar. Quedan **diferidos** a una auditoría futura del panel (fuera de §7).

---

## Out-of-scope respetado

- ❌ Rediseño visual completo — confirmado: solo correcciones de pulido, no rediseño.
- ❌ Nuevas features — confirmado: solo fixes de lo existente.
- ❌ Performance / Core Web Vitals — no se tocó.
- ❌ Copy de negocio — no se alteró.
- ❌ Tests unitarios de componentes visuales — confirmado: verificación con Playwright (el repo no tiene component specs).

---

## Deuda técnica detectada

1. **AC-R1 retorno success/cancelled** — verificación visual pendiente; requiere `token_ws`/pago real. Aceptada como **deuda manual** por el owner (cierre consciente, igual que 0010 con AC-F1/F2).
2. **AC-E2** — falta prueba dedicada con texto extra-largo en el flujo público (bajo riesgo).
3. **Panel admin** — los ACs de panel (AC-R2/R3/P1/P4/L1/L2) no se auditaron; candidatos a una spec/pass futura.
4. **fix-02 (touch targets, `min-height:44px`)** — vive en `_public-enrollment.scss`, archivo aún sin commitear (viaja con el commit de theming de la spec 0009).
5. **Detalle DS menor** — el total en `public-payment` usa `font-size`/`font-weight` ad-hoc con gradient-clip en vez de `.kpi-value` (deliberado).

## Fixes derivados (cerrados en la misma rama)

- **fix-007** — grilla renderizaba columna de día duplicada → resuelto por redeploy de la Edge Function `public-enrollment`. ✅
- **fix-008** — el flujo público no aplicaba "máximo 1 clase/día" → enforce agregado (commit `80f762f`). ✅ (secretaría se mantiene en 3 por decisión de negocio).
