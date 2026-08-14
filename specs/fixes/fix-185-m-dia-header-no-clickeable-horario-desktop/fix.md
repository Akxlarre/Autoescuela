# Fix: Headers de día en Mi Horario desktop no deben ser clickeables
> id: fix-185-m-dia-header-no-clickeable-horario-desktop
> refs: fix-181-m-horario-desktop-rail-sin-domingo (rediseño de columnas que dejó este header)
> status: done
> closed: 2026-08-14
> created: 2026-08-14

## Root Cause
El header de cada columna de día en `WeeklyScheduleGridComponent` (desktop) es un `<button>` con
`(click)="daySelect.emit(day.date)"` heredado del diseño de grid-horario anterior a fix-181-m,
donde seleccionar un día tenía sentido (¿de qué diseño? no aplica ya). En el rediseño de columnas
tipo rail, **todas** las clases de la semana ya son visibles simultáneamente sin necesidad de
"seleccionar" un día — el único efecto de este click es un highlight cosmético en el propio
header, sin cambiar nada más en la vista. El dueño reportó que además se ve mal: al hacer click,
el `<button>` nativo deja el foco visible (borde negro/ring) — se ve "apretado" sin que apretarlo
sirva para nada.

## ACs Afectados
Ninguno — fix autónomo (defecto de interacción reportado por QA visual).

## Cambio
- **Archivo:** `src/app/shared/components/weekly-schedule-grid/weekly-schedule-grid.component.ts`
  - **Qué cambia:** el header de cada día pasa de `<button (click)="daySelect.emit(...)">` a un
    `<div>` no interactivo (sin click, sin cursor pointer, sin foco). Se elimina el output
    `daySelect` (sin otro consumidor real, ver abajo). El highlight de "Hoy" (`day.isToday`) se
    conserva — es informativo, no depende de interacción.
- **Archivo:** `src/app/features/instructor/horario/instructor-horario.component.ts`
  - **Qué cambia:** elimina el binding `(daySelect)="onDaySelect($event)"` y el método
    `onDaySelect()`, que quedaban huérfanos al remover la interacción del header — su único
    efecto (highlight de `selectedDayDate`) sigue funcionando vía el botón "Hoy" del toolbar
    (`resetToToday()`), que es el único flujo real que ya seteaba `selectedDayDate`.

## Test de Regresión
Cambio de interacción/UI puro (quitar un click handler y su output correspondiente) — sin lógica
nueva que amerite test unitario. Verificación visual: `/verify` (Playwright) confirmando que los
headers de día no muestran cursor pointer ni anillo de foco al clickear, y que "Hoy" sigue
resaltando el día actual correctamente.
