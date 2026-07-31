# Fix: Ex-Alumnos B — conteo de egresados discrepante (2 vs 16)
> id: fix-005-i-exalumnos-egresados-discrepancia
> refs: ASG-b-027
> status: done
> closed: 2026-07-30
> created: 2026-07-30

## Root Cause
[Heredado de ASG-b-027, a confirmar]: En `/app/admin/ex-alumnos` con "Todas las sedes", el hero/KPI dice "2 Egresados" mientras la sección "Balance de Gestión Anual (REAL-TIME)" de la misma página dice "16 egresados" — dos fuentes de datos distintas mostrando lo mismo, sin conciliar. Posible hipótesis: una filtra por sede/clase y la otra no, o usan criterios de "egresado" distintos.

## ACs Afectados
Ninguno — fix autónomo (originado de Asignación de equipo, no de una spec).

## Cambio
- **Diagnóstico:** ambos números vienen del mismo facade (`src/app/core/facades/ex-alumnos.facade.ts`, `ExAlumnosFacade`), consumido por `AdminExAlumnosComponent` (hero/KPI "2 Egresados") y por `AdminStatsPanelComponent` vía `AdminExAlumnosTasasDrawerComponent` ("Balance de Gestión Anual" → `annualEgresadosTotal`).
  - **Hero (2 Egresados)** → `egresadosClaseB` (computed) filtra `loadEgresadosList()`: `enrollments.status = 'completed'` + `license_group = 'class_b'` (client-side) + `.eq('branch_id', branchId)` cuando hay sede activa.
  - **Balance Anual (16 egresados)** → `annualEgresadosTotal`, seteado en `loadStatistics()`: `enrollments.status = 'completed'` + `.gte('updated_at', startOfYear)` — **sin** filtro de `license_group` (contaba también `professional`) y **sin** `branch_id` (siempre todas las sedes, incluso con una sede específica seleccionada).
  - Mismo patrón que H-013 (`fix-056-b-reportes-contables-branch-id`): una query resuelve el scope correctamente (la del hero), la otra no — se alinea la incorrecta a la correcta, no se promedian criterios.
- **Cambio aplicado en `loadStatistics()`** (`ex-alumnos.facade.ts`): se agregó `.eq('license_group', 'class_b')` y, cuando hay sede activa (`getActiveBranchId() !== null`), `.eq('branch_id', branchId)` a la query de `annualEgresadosTotal` — mismo criterio que `loadEgresadosList()`. Se mantuvo intencionalmente la ventana temporal `gte('updated_at', startOfYear)` (Balance Anual = "este año") vs. el hero (all-time) — son ventanas de tiempo legítimamente distintas; lo que se unificó es el filtro de entidad (`license_group`) y el scope de sede, que era lo que causaba el 2 vs 16.
- Fuera de scope (detectado pero no tocado en este fix, para no violar "un fix = una causa raíz"): `annualLicensesTotal` (conteo de `student_surveys.obtained_license`) tampoco tiene scope de `branch_id` ni relación directa con `license_group` — mismo tipo de bug latente, candidato a una Asignación nueva si el cliente lo reporta.

## Test de Regresión
- `src/app/core/facades/ex-alumnos.facade.spec.ts` — test nuevo en `describe('loadStatistics — annualEgresadosTotal (fix-005-i, H-003)', ...)`: mockea `enrollments`/`class_b_exam_scores`/`student_surveys` con un builder encadenable, invoca `loadStatistics()` con una sede activa (`branchId=7`), y verifica que la query de `enrollments` recibe `.eq('status','completed')`, `.eq('license_group','class_b')` y `.eq('branch_id', 7)`, y que `annualEgresadosTotal()` queda seteado al valor mockeado (2).
- Verificación empírica: `npx tsc -p tsconfig.app.json --noEmit` limpio, `ng build --configuration=development` exitoso, `npm run lint:arch` → 0 errores (warnings pre-existentes sin cambios), `npx vitest run src/app/core/facades/ex-alumnos.facade.spec.ts` → 6/6 verde (5 pre-existentes + 1 nuevo).
- Verificación visual pendiente: confirmar en `/app/admin/ex-alumnos` (drawer "Tasas de Aprobación" → sección "Balance de Gestión Anual") que el número de "egresados" coincide con el del hero/KPI, tanto con "Todas las sedes" como con una sede específica seleccionada.
