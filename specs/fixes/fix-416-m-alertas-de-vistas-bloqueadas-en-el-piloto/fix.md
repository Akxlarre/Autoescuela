# Fix: el dashboard muestra alertas de vistas que están bloqueadas en el piloto
> id: fix-416-m-alertas-de-vistas-bloqueadas-en-el-piloto
> refs: fix-395-m-testing-dashboards (caso Q15, sospecha S14) · fix-255-m (`pilot-phase.config.ts`)
> status: done
> closed: 2026-10-14
> created: 2026-10-14

## Síntoma

Durante el piloto, el dashboard muestra alertas como "6 alumnos con asistencia crítica (Alumnos
Profesional)", "N pre-inscripciones nuevas" o "N calificaciones en borrador". Las pantallas donde
eso se atiende (Pre-inscritos, Asistencia y Evaluaciones de Clase Profesional) están bloqueadas:
quien ve la alerta no tiene dónde resolverla.

## Root Cause

`DashboardAlertsFacade.fetchAlertsData()` corre siempre las 7 revisiones de Clase Profesional
(pre-inscripciones nuevas, tests psicológicos por evaluar, pre-inscripciones por vencer,
asistencia en rojo y en amarillo, módulos reprobados, calificaciones en borrador), sin consultar
`isBlockedInPilot('clase-profesional-recorte')`, que es lo que bloquea esas rutas.

## Fix

**Decisión de Matías (2026-10-14):** una alerta de una vista que no está habilitada no se muestra.
Mientras `clase-profesional-recorte` esté bloqueado, esas 7 revisiones no se ejecutan. Al levantar
la fase vuelven solas (misma fuente única que guards y menú).

## Acceptance Criteria

- [x] AC1 — Con el recorte de Clase Profesional bloqueado, no se consultan ni se muestran las 7
      alertas de Clase Profesional.
- [x] AC2 — Con el recorte habilitado, se muestran como antes.
- [x] AC3 — Las demás alertas no cambian.

## Regression Test

- `dashboard-alerts.facade.spec.ts` → `alertas de vistas bloqueadas en el piloto (fix-416-m)`

## Verificación (2026-10-14)

- Unit: `dashboard-alerts.facade.spec.ts`, 2 tests nuevos (bloqueado: no consulta las 3 tablas de
  Clase Profesional ni muestra sus 7 alertas, y las demás siguen; habilitado: las 7 aparecen).
  82/82 junto con `hora-chile.facades.spec.ts`. El spec simula el piloto con un mock de
  `pilot-phase.config`; por defecto lo deja habilitado para los tests anteriores de esas alertas.
- Navegador, admin en "Todas las sedes": el drawer pasó de 8 a 7 alertas; ya no aparece "6 alumnos
  con asistencia crítica". Las otras 7 siguen igual.
