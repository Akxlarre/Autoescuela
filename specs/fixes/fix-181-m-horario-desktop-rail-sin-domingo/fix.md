# Fix: Mi Horario desktop — grid de franja horaria → columnas tipo rail, sin Domingo
> id: fix-181-m-horario-desktop-rail-sin-domingo
> refs: fix-179-m-mi-horario-mobile-timeline, fix-180-m-day-strip-mobile-sin-scroll (mismo
> rediseño de "Mi Horario"; este fix cubre la vista desktop tras validar el patrón en mobile)
> status: done
> closed: 2026-08-14
> created: 2026-08-14

## Root Cause
`WeeklyScheduleGridComponent` (desktop) posiciona los bloques con coordenadas absolutas sobre una
franja horaria fija 08:00–19:00 (`hour-cell` de 80px × 12 horas). Esto causa dos problemas
reportados por el dueño tras QA visual:

1. Si las clases del instructor son en la tarde, quedan fuera del viewport inicial (hay que
   scrollear para verlas) porque el grid siempre arranca renderizado desde las 08:00.
2. Cada bloque está limitado en alto a lo que su duración "permite" en píxeles dentro de la
   franja — eso lo deja con poca información visible y poco peso visual frente al resto del grid
   (mayormente vacío).

Decisión (validada con el dueño): en vez de parchear con autoscroll, se abandona la metáfora de
grilla-horaria en desktop y se replica el patrón que ya funciona en mobile (rail vertical de
`DailyScheduleTimelineComponent`) en las columnas del desktop — cada columna de día pasa a ser
una lista compacta de solo las clases reales de ese día, sin filas de horas vacías. Se pierde la
lectura de "en qué momento exacto del día caen unas respecto a otras" (solapes/huecos a simple
vista), pero para la vista de horario propio de un instructor (no de disponibilidad/asignación)
prima la claridad y que todo sea visible sin scroll.

De paso, mismo criterio que fix-180-m: se excluye **Domingo** (nunca hay clases ese día), dejando
6 columnas en vez de 7 y más espacio por columna.

## ACs Afectados
Ninguno — fix autónomo (continuación visual de fix-179-m/fix-180-m).

## Cambio
- **Archivo:** `src/app/core/utils/schedule-week-days.utils.ts` (nuevo)
  - **Qué cambia:** se extrae `filterVisibleWeekDays` desde `daily-schedule-timeline.utils.ts` a
    este archivo compartido, para que tanto el timeline mobile como el grid desktop excluyan
    Domingo con la misma función pura testeada.
- **Archivo:** `src/app/core/utils/daily-schedule-timeline.utils.ts`
  - **Qué cambia:** deja de exportar `filterVisibleWeekDays` (movida al archivo de arriba).
- **Archivo:** `src/app/shared/components/daily-schedule-timeline/daily-schedule-timeline.component.ts`
  - **Qué cambia:** importa `filterVisibleWeekDays` desde la nueva ubicación compartida.
- **Archivo:** `src/app/shared/components/weekly-schedule-grid/weekly-schedule-grid.component.ts`
  - **Qué cambia:** reemplaza el grid de franja horaria (filas de hora + posicionamiento absoluto)
    por columnas de día en `flex` dentro de un cuerpo `overflow-y-auto` con el header de días
    `sticky top-0` (así un día con muchas clases scrollea sin perder la referencia de columna) —
    cada columna renderiza solo sus bloques reales, ordenados, como cards compactas. Excluye
    Domingo vía `filterVisibleWeekDays`. Jerarquía de la card ajustada a pedido del dueño tras ver
    el primer resultado: **Clase Nº** pasa a ser el dato principal (grande, arriba de donde antes
    iba el nombre), el nombre del alumno baja a dato secundario debajo, y la hora de inicio se
    agranda (`text-2xs` → `text-sm`).
- **Archivo:** `src/app/core/facades/instructor-horas.facade.ts`
  - **Qué cambia:** bug encontrado al implementar la card — `fetchWeeklySchedule()` nunca
    seleccionaba `class_number` de `class_b_sessions` y mapeaba `classNumber: null` a mano, por
    eso "Clase Nº" siempre aparecía vacío (`#` sin número) en la UI vieja y nueva. Se agrega
    `class_number` al `select()` y se mapea `classNumber: row.class_number ?? null`.

## Test de Regresión
Cambio de layout + reutilización de una función pura ya testeada
(`schedule-week-days.utils.spec.ts > filterVisibleWeekDays`, migrada desde
`daily-schedule-timeline.utils.spec.ts` sin perder cobertura). El fix del facade es una columna
extra en un `select()` ya existente — sin lógica condicional nueva, no amerita test unitario
propio. No hay lógica nueva en el componente del grid — verificación visual: `/verify`
(Playwright) en viewport desktop confirmando que las clases de la tarde son visibles sin scroll,
que Domingo no aparece, y que "Clase Nº" se muestra con datos reales (no vacío).
