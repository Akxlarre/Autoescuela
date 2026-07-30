# Fix: Responsive y UX — Wizard de Inscripción Pública
> id: fix-006-b-responsive-ux-wizard-publico
> refs: 0009-rediseno-ux-flujo-inscripcion-online-publico
> status: done
> closed: 2026-06-03
> created: 2026-06-03

## Root Cause

El wizard público (spec 0009) fue implementado y verificado solo a nivel de lógica y contratos de datos.
No se realizó QA visual responsivo durante la spec — los componentes `public-wizard-shell` y
`public-context-banner` no tienen breakpoints mobile, y algunos pasos carecen de empty states
orientativos. Detectado en auditoría Playwright post-cierre de 0009.

## ACs Afectados

- **AC7** (barra de progreso nombrada, paso activo resaltado): ⚠️ cumplido en desktop ancho, roto en
  viewports < 900px — el `<ul>` de pasos hace wrap a múltiples filas sin control.
- **AC3** (banner de contexto en datos personales): ⚠️ el banner es ilegible en mobile 375px —
  precio y nombre de sede se comprimen/truncan.
- **AC-UX-NEW** (orientación de usuario en pasos vacíos): ausente — paso `schedule` sin instructor
  seleccionado no indica al usuario qué hacer.

## Issues Encontrados (evidencia Playwright)

| # | Severidad | Paso | Viewport | Descripción |
|---|-----------|------|----------|-------------|
| I1 | 🔴 Crítico | Todos | 375px + 1280px | Barra de progreso se parte en 2–4 filas; confunde posición en el flujo |
| I2 | 🟠 Moderado | `personal-data` | 375px | Banner contexto: "Autoesc..." truncado, precio y label colisionan |
| I3 | 🟠 Moderado | `schedule` | Todos | Empty state pobre: solo dropdown de instructor, sin guía de acción |
| I4 | 🟡 Menor | `contract` | 1280px | Pantalla casi vacía: mucho espacio en blanco, falta contexto del contrato |
| I5 | 🟡 Menor | `license-type` | 375px | Cards Clase B / Profesional con alturas desiguales (`items-stretch` faltante) |

## Cambios Planificados

### I1 — Barra de progreso (PRIORIDAD 1)
- **Archivo:** `src/app/shared/components/public-enrollment-steps/public-wizard-shell/public-wizard-shell.component.ts` (o donde viva el shell del wizard)
- **Qué cambia:** En mobile (< 640px) reemplazar la lista horizontal de pasos por un indicador compacto tipo `"Paso 2 de 8 — Datos personales"`. En desktop reducir padding/font-size del stepper para que quepa en una sola fila.

### I2 — Banner de contexto mobile (PRIORIDAD 2)
- **Archivo:** `src/app/shared/components/public-enrollment-steps/public-context-banner/public-context-banner.component.ts`
- **Qué cambia:** Layout en mobile: stack vertical (curso arriba, precio abajo). `overflow: hidden; text-overflow: ellipsis` → reemplazar por `truncate` solo en el address, no en nombre de sede ni precio.

### I3 — Empty state paso horario (PRIORIDAD 3)
- **Archivo:** `src/app/shared/components/public-enrollment-steps/public-schedule/public-schedule.component.ts`
- **Qué cambia:** Mostrar mensaje orientativo "Selecciona un instructor para ver los horarios disponibles" antes de que el usuario interactúe con el dropdown.

### I4 — Paso contrato (PRIORIDAD 4)
- **Archivo:** `src/app/shared/components/public-enrollment-steps/public-contract/public-contract.component.ts`
- **Qué cambia:** Agregar lista de ítems que incluye el contrato (nombre, rut, curso, monto, sede) y una nota de qué significa firmarlo.

### I5 — Cards licencia alturas desiguales (PRIORIDAD 5)
- **Archivo:** `src/app/shared/components/public-enrollment-steps/public-license-type/public-license-type.component.ts`
- **Qué cambia:** Agregar `items-stretch` o `h-full` al grid de cards para igualar alturas.

## Test de Regresión

- QA visual Playwright: navegar `?branchId=1` y `?branchId=2` en viewport 375px y 1280px
- Verificar que la barra de progreso cabe en **una sola fila** en desktop 1280px
- Verificar que en mobile 375px el indicador de paso es legible (modo compacto)
- Verificar que el banner de contexto muestra nombre completo y precio sin truncar
- `npm run test:ci` — 0 regresiones en `public-enrollment.facade.spec.ts`

## Screenshots de evidencia

Guardados en `docs/qa-responsive/`:
- `mob-b1-personal-data.png` — banner truncado y progress en 3 filas
- `mob-b2-license-type.png` — cards desiguales
- `mob-step-schedule.png` — empty state pobre
- `desk-step-contract.png` — exceso de espacio en blanco
- `desk-b1-personal-data.png` — progress en 2 filas en 1280px
