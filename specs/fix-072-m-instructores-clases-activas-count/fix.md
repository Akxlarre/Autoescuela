---
# Fix: "Clases activas" de Instructores siempre muestra 0
> id: fix-072-m-instructores-clases-activas-count
> refs: ASG-019
> status: done
> closed: 2026-07-27
> created: 2026-07-27

## Root Cause

[Heredado de ASG-019, a confirmar]: Los 6 instructores muestran "0" en la columna/KPI "Clases
activas", sin excepción — incluso los que en ese momento tenían clases "Transcurriendo" según el
Dashboard. `instructores.facade.ts:622` lee `activeClassesCount: r.active_classes_count`
directamente de la columna `instructors.active_classes_count` (`DEFAULT 0`), pero esa columna nunca
se escribe en ningún trigger, Edge Function o facade de todo el repo — quedó definida en el esquema
pero nunca conectada a la lógica real. Mismo patrón de riesgo que H-016 (dato cacheado/mock
desincronizado de la realidad).

## ACs Afectados

- Ninguno — fix autónomo, sin spec asociada.

## Cambio

- **Archivo:** `src/app/core/facades/instructores.facade.ts`
  - Eliminar la lectura de `active_classes_count` de la query y del `InstructorRow` DTO.
  - Agregar una segunda query en `fetchData()` sobre `class_b_sessions` (`select instructor_id`,
    `.eq('status', 'in_progress')`, `.in('instructor_id', <ids ya obtenidos>)`) — mismo concepto de
    "Transcurriendo" que ya usa `dashboard.facade.ts` (`fetchLiveClasses`).
  - Construir un `Map<instructorId, count>` a partir de esa segunda query y pasarlo a `mapRow()`
    para calcular `activeClassesCount` en vivo, en vez de la columna cacheada.
- **Decisión de diseño (columna `active_classes_count`):** se mantiene la columna en el esquema por
  ahora (no se elimina vía migración en este fix — fuera de alcance). Queda **oficialmente sin uso**
  por ningún facade del repo tras este cambio; si en el futuro se quiere cachear el conteo por
  performance, se debe hacer vía un trigger real (mismo patrón que
  `trg_class_b_sessions_update_monthly_hours`), no como escritura manual.

## Test de Regresión

- `instructores.facade.spec.ts > InstructoresFacade — clases activas en vivo (fix-072)`:
  - `activeClassesCount refleja el COUNT en vivo de class_b_sessions en status in_progress` ✓
  - `activeClassesCount es 0 para un instructor sin sesiones in_progress` ✓
- Suite completa (`npm run test:ci`): 1452/1452 en verde (10/10 en `instructores.facade.spec.ts`,
  incluyendo los 2 tests nuevos).
- `npm run lint:arch`: 0 errores, 165 advertencias (todas pre-existentes, ninguna nueva en
  `instructores.facade.ts`).
- Verificación visual: NO ejecutada con Playwright MCP en esta sesión — el usuario (Matías) decidirá
  si la corre en `ng serve`.
