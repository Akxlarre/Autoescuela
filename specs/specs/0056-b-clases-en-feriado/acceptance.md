# Acceptance — Spec 0056-b (clases en feriado)

> Verificado: 2026-11-06 · BD de desarrollo `skvekggejikzxhzsjmkz` (migración aplicada) · Chrome + `ng serve`

| AC | Estado | Evidencia |
|---|---|---|
| AC1 | ✅ | `fix-186-b-cron-fin-de-jornada.sql` **M09**: clase de ayer en feriado, sin iniciar → `cancelled`, sin asistencia |
| AC2 | ✅ | Mismo test, M01–M07 en verde con la función nueva (13/13 en la primera corrida completa) |
| AC3 | ✅ | **M09b**: clase `in_progress` en el feriado → sigue `in_progress` |
| AC4 | ✅ | **M09c** (la cancelada por el cron está en la vista), **M10** (agendada en feriado futuro → en la vista), **M10b** (cancelada antes del feriado → fuera), **M10c** (cancelada en el feriado con la matrícula penalizada → fuera). RLS: como `secretaria@test.com` (rol `authenticated`) la vista devuelve la clase de su sede |
| AC5 | ✅ | `e2e/clases-en-feriado.spec.ts`: la secretaria ve "N clases en día feriado · De M alumnos… hay que reagendarlas" en su dashboard. Unit: `dashboard-alerts.facade.spec.ts` B-4 (conteo, singular, filtro de sede, sin alerta) |
| AC6 | ✅ | `e2e/clases-en-feriado.spec.ts`: en "Todas las alertas" la secretaria abre "Ver clases" (`aria-expanded` false → true), ve la fila del alumno con "Clase 1" y el nombre del feriado, y la fila la lleva a `/app/secretaria/alumnos/<studentId>`. Unit: `holiday-classes.utils.spec.ts` (texto, orden, ruta por rol, cancelada), facade B-4 (`details`, `detailsLabel`) y `alerts-drawer.component.spec.ts` (desplegar/plegar, cerrar drawer y navegar). Visual en claro y oscuro con una clase sembrada (sesión 20174, borrada) |
| AC-E1 | ✅ | Unit B-4: consulta con error → `loadProblem()` = "No se pudieron revisar todas las alertas." |

## Hallazgo durante la verificación
La primera versión de la vista contaba 2 clases del 18/09 de desarrollo canceladas por la
penalización de 2 faltas esa misma noche (de antes de fix-384-m, sin `absence_penalty_applied_at`).
Se excluyen las matrículas penalizadas desde el día del feriado y las cancelaciones anteriores al
2026-11-06 (el cron nunca canceló por feriado antes). La vista quedó en 0 filas.

## Otros
- `npm run test:ci`: 4648 ok, 1 falla intermitente ajena (`promociones.facade.spec.ts` AC3 consulta
  la API real de feriados; pasa sola). `npm run lint:arch`: 0 errores.
