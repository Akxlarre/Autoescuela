# Fix: Cards de "Mi Horario" mobile — N° de matrícula como dato principal
> id: fix-183-m-numero-matricula-card-horario-mobile
> refs: fix-182-m-numero-matricula-card-horario-desktop (misma corrección, ahora en mobile)
> status: done
> closed: 2026-08-14
> created: 2026-08-14

## Root Cause
fix-182-m corrigió la card del grid desktop (`app-weekly-schedule-grid`) para mostrar el N° de
matrícula real (`ScheduleBlock.enrollmentNumber`) como dato principal en vez de "Clase Nº", con
el nombre del alumno como dato secundario debajo. El dueño pide replicar el mismo criterio en las
cards del timeline mobile (`app-daily-schedule-timeline`): el Hero Card de "próxima clase" y las
cards del rail diario, que hoy muestran el nombre del alumno como dato principal.

`ScheduleBlock.enrollmentNumber` ya existe en el modelo y ya lo trae `instructor-horas.facade.ts`
(agregado en fix-182-m) — no hace falta tocar datos, solo el template del componente mobile.

## ACs Afectados
Ninguno — fix autónomo (paridad visual con fix-182-m).

## Cambio
- **Archivo:** `src/app/shared/components/daily-schedule-timeline/daily-schedule-timeline.component.ts`
  - **Qué cambia:** en el Hero Card ("próxima clase") y en las cards del rail, el N° de matrícula
    (`#{{ enrollmentNumber }}`) pasa a ser el dato principal (donde antes iba el nombre del
    alumno); el nombre baja a dato secundario debajo. "Clase Nº" se conserva junto al vehículo.

## Test de Regresión
Cambio de template puro (reordenar/reetiquetar campos ya presentes en el modelo) — sin lógica
nueva que amerite test unitario. Verificación visual: `/verify` (Playwright) en mobile
confirmando que el Hero Card y las cards del rail muestran `#<N° de matrícula>` como dato
principal y el nombre del alumno debajo.
