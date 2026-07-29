# fix-018-m — Asignación admin/secretaria: rediseño paso 2 con grilla semanal del flujo público

## Contexto

El paso 2 (Asignación) del wizard de matrícula admin/secretaria
(`AssignmentComponent`) tiene una UX inferior a la del flujo público: la
selección de horarios usa **tabs de día** (un día visible a la vez), mientras
que el flujo público (`PublicScheduleComponent`) muestra una **grilla semanal
multi-día** (columnas = días, filas = horas) donde se ven y seleccionan slots de
varios días a la vez.

El dueño pidió alinear el diseño del paso 2 admin/secretaria con el flujo
público, manteniendo una única diferencia funcional: **admin/secretaria puede
agendar hasta 3 clases por día** a un alumno, mientras que el flujo público
permite solo **1 por día**.

## Decisiones de diseño (confirmadas)

- **Fuente única del límite por día:** se elimina el input duplicado
  `[maxPerDay]="3"` de `AssignmentComponent`. El límite se lee siempre de
  `slotSelection.maxClassesPerDay` (público = 1, admin = 3). Esto corrige una
  doble fuente de verdad preexistente.
- **Grilla compartida:** se extrae un dumb component `<app-schedule-grid>`
  reutilizado por ambos flujos. La diferencia 3 vs 1 es puro dato.
- **Resumen de clases seleccionadas:** se conserva y se **promueve también al
  flujo público** (hoy solo lo tenía admin). Rediseñado con una estética
  profesional alineada al flujo público.
- **Auto-avance de día** (`advanceToNextAvailableDay`) se elimina: era específico
  de los tabs de día y queda obsoleto con la grilla semanal.
- Selector de instructor en admin pasa a `p-select` premium (como público),
  conservando vehículo/patente en el template de opción.
- Vistas `professional` y `singular` del paso 2 se reestilizan a la estética
  premium del flujo público.

## Hallazgos / Lógica afectada

1. `shared/components/matricula-steps/assignment/assignment.component.{ts,html,scss}`
   — rediseño vista class-b; quitar `maxPerDay` input y lógica de tabs/auto-avance.
2. `shared/components/public-enrollment-steps/public-schedule/public-schedule.component.ts`
   — delega la grilla al nuevo `<app-schedule-grid>`; mantiene shell (instructor select + nav).
3. **NUEVO** `shared/components/schedule-grid/schedule-grid.component.ts` (+ `.spec.ts`)
   — grilla semanal + nav + progreso + resumen + warning de disponibilidad.
4. `features/secretaria/matricula/secretaria-matricula.component.{ts,html}`
   — `maxClassesPerDay: 3` en `step2Data()`; quitar `[maxPerDay]="3"`.
5. `indices/COMPONENTS.md` — registrar `schedule-grid`.

## Acceptance Criteria

- [x] AC0: El paso 2 admin/secretaria (Clase B) muestra la grilla semanal
  multi-día (columnas = días, filas = horas), vía `<app-schedule-grid>` compartido.
- [x] AC1: En admin/secretaria se pueden seleccionar hasta **3 clases por día**;
  al intentar la 4ª en el mismo día, el slot queda bloqueado.
  (tests `isSlotSelectable`/`toggleSlotIds` con maxClassesPerDay=3.)
- [x] AC2: En el flujo público se mantiene el límite de **1 clase por día**
  (tests con maxClassesPerDay=1; público pasa el valor del curso).
- [x] AC3: Ambos flujos muestran el resumen de clases seleccionadas (`selectedSlotsLabels`)
  con el nuevo diseño (chips removibles).
- [x] AC4: El selector de instructor admin usa `p-select` premium conservando
  vehículo/patente (template `#item`).
- [x] AC5: Las vistas `professional` y `singular` siguen funcionando, reestilizadas.
- [~] AC6: `schedule-grid` (15 tests) + `enrollment.facade` (38) en verde, `tsc`
  y `ng build` OK, `lint:arch` sin errores nuevos (solo baseline preexistente).
  **Pendiente:** `/verify` visual en navegador (Playwright MCP no disponible en
  esta máquina) — requiere `ng serve` + revisión manual del usuario.
