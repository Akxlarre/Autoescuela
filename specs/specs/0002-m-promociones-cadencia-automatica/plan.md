# Plan 0002-m — Promociones automáticas: cadencia, matrícula tardía y convalidaciones

> **Spec:** [spec.md](./spec.md)
> **Status:** done
> **Created:** 2026-08-06

---

## 1. Resumen ejecutivo

Se agrega una **Edge Function programada** (`auto-create-next-promotions`) que garantiza que
siempre exista un **colchón de 1 promoción activa (`in_progress`) + 2 programadas (`planned`)**
hacia adelante — no solo "la siguiente". Cada ejecución crea tantas promociones consecutivas
(cadencia 14 días) como falten para completar ese colchón, cada una con sus
`promotion_courses`, `class_book` explícitos, y feriados descontados vía la misma API pública
que hoy usa el flujo manual (`fetchHolidaysInRange` / `cancelHolidaySessions`). Se invoca desde
`pg_cron` vía `pg_net`/`net.http_post`, un patrón sin precedente en este proyecto (todos los
cron jobs existentes llaman funciones SQL puras — ver spec 0027, que descartó este mismo
patrón para el envío de Zoom). En paralelo, se agrega una validación de matrícula tardía en
`EnrollmentFacade.saveAssignment()`: si la promoción elegida lleva más de 3 días iniciada, se
muestra un modal de confirmación (reutilizando `ConfirmModalService`, ya inyectado en el
facade) antes de persistir. AC3 (listar varias promociones activas) **ya está implementado** —
solo requiere test de regresión, no código nuevo.

**Recuperación de feriados — fix incluido en esta spec, afecta ambos flujos.** Hoy
`crearPromocion()` usa `end_date` fijo (`start + 33`) y los feriados dentro del rango
**solo se cancelan** (se pierden). El owner confirmó que en vez de eso `end_date` debe
**extenderse** N días hábiles (L-S) por cada feriado dentro del rango, para que la promoción
siempre complete sus 30 clases reales — recursivo si un día de extensión también cae en
feriado. Esto es un comportamiento nuevo, no solo para la Edge Function: corrige también el
formulario manual (`admin-promocion-crear-drawer.component.ts` / `crearPromocion()`), que hoy
tiene el mismo problema. Se extrae la lógica de cálculo a un util puro compartido
(`core/utils/promotion-end-date.utils.ts`) para no duplicar la regla entre el facade Angular y
la Edge Function.

Orden: (1) util puro de cálculo de `end_date` + tests, (2) fix de `crearPromocion()` y del
preview de fecha en el drawer manual, (3) Edge Function + migración `pg_cron`/`pg_net`
(reutiliza la misma regla, portada a Deno), (4) exponer `start_date` de la promoción en
`PromotionOption`, (5) validación + modal de matrícula tardía en `EnrollmentFacade`, (6) tests,
(7) sync de índices.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/app/core/utils/promotion-end-date.utils.ts` | Util puro (Functional Core) | `computePromotionEndDate(startDate: string, holidayDates: Set<string>): string` — camina día a día desde `startDate` (L-S, salta domingos) contando días hábiles no-feriado hasta acumular 30; retorna esa fecha como `end_date`. Recursivo por construcción: si un día de "recuperación" también es feriado, simplemente no cuenta y el loop sigue. Sin I/O — recibe los feriados ya resueltos, no hace fetch. |
| `src/app/core/utils/promotion-end-date.utils.spec.ts` | Tests | Casos: sin feriados (= `start+33`, caso hoy vigente), 1 feriado a mitad de rango, 2 feriados consecutivos (AC-E2), feriado justo en el último día calculado (fuerza extensión recursiva), feriado en domingo (no debe afectar el conteo, ya excluido). |
| `supabase/functions/auto-create-next-promotions/index.ts` | Edge Function | Garantiza un colchón de 1 promoción `in_progress` + 2 `planned` (branch_id=2): calcula cuántas faltan y crea, en cadencia de 14 días desde la última `start_date` existente, cada una con sus `promotion_courses`, `class_book`, `end_date` calculado con recuperación de feriados (mismo algoritmo que `promotion-end-date.utils.ts`, portado a Deno), y feriados descontados — mismo flujo que `crearPromocion()` en `promociones.facade.ts`, pero disparado por cron en vez de por el wizard. Idempotente por `start_date`. `SECURITY DEFINER` implícito vía `service_role` key. |
| `supabase/functions/_shared/holidays.ts` | Util compartido | Puerto de `fetchHolidaysInRange()` (fetch a `apis.digital.gob.cl/fl/feriados/{año}`) + puerto del cálculo de `computePromotionEndDate()` para la Edge Function (Deno no puede importar directo `src/app/core/utils/`, se duplica la lógica pura — mismos casos de test documentados en tasks.md para mantenerlas sincronizadas). |
| `supabase/migrations/20260806HHMMSS_auto_create_next_promotions_cron.sql` | Migration | Habilita `pg_net` (si no está ya) y agrega `cron.schedule('auto-create-next-promotions', '0 6 * * *', $$ SELECT net.http_post(...) $$)` apuntando a la URL de la Edge Function, con el `service_role` key vía `vault` o `current_setting`. |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/models/ui/enrollment-assignment.model.ts` | ~~Agregar `promotionStartDate: string` a `PromotionOption`~~ — ya existe como `startDate: string \| null` (fix-089), sin cambios. | El facade necesita la fecha de inicio de la promoción padre para calcular días transcurridos; ya se selecciona y mapea en `loadPromotions()`. |
| `src/app/core/facades/enrollment.facade.ts` | (a) `loadPromotions()`: incluir `start_date` en el `select()` de `professional_promotions` y mapearlo a `PromotionOption.promotionStartDate`. (b) `saveAssignment()`: antes del branch Profesional, calcular días desde `promotionStartDate` de la opción seleccionada; si > 3, llamar `this.confirm({...})` (ya existe el wrapper) y abortar si el usuario cancela. | Implementa AC4/AC5. Reutiliza el wrapper `confirm()` ya presente en el facade — no se toca `ConfirmModalService`. |
| `src/app/core/facades/enrollment.facade.spec.ts` | Tests nuevos para el punto (b) | TDD obligatorio en facades (`testing-tdd.md`). |
| `src/app/core/facades/promociones.facade.ts` | `crearPromocion()`: reordenar el flujo — (1) fetch feriados del año(s) relevante(s) ANTES de insertar (ya no se puede filtrar por `endDate` porque aún no existe: se fetchea el año completo), (2) `end_date = computePromotionEndDate(startDate, holidays)` en vez del valor recibido del form, (3) INSERT con ese `end_date`, resto del flujo igual (cursos, relatores, cancelación de sesiones en feriados dentro del rango ya extendido). Se agrega método público `previewEndDate(startDate: string): Promise<string>` para que el drawer muestre la fecha real antes de guardar. | Implementa AC6/AC-E2 también en la creación manual (confirmado en alcance por el owner, 2026-08-07). |
| `src/app/core/facades/promociones.facade.spec.ts` | Tests nuevos: `crearPromocion()` con feriados en el rango → `end_date` insertado refleja la extensión, no el valor fijo. `previewEndDate()` expuesto y probado. | TDD obligatorio (`testing-tdd.md`), lógica de negocio nueva en un facade existente. |
| `src/app/features/admin/profesional-promociones/admin-promocion-crear-drawer.component.ts` | Elimina la función local `computeEndDate()` (pura, fija) — el preview de "Fecha de término" pasa a llamar `promocionesFacade.previewEndDate(selectedStartDate())` de forma async (con estado de carga) al seleccionar un lunes. Ajusta el texto de ayuda (línea 289) para ya no decir "sábado de la 5ta semana" a secas, sino aclarar que se extiende si hay feriados en el rango. | Consistencia con AC6 — el admin/secretaria debe ver la fecha real (ya extendida) antes de guardar, no una aproximación que luego el backend corrige. |
| `supabase/config.toml` | Agregar sección `[functions.auto-create-next-promotions]` (`verify_jwt = false`, invocada solo por el cron vía `service_role`) | Mismo patrón que `generate-class-book-pdf`/`generate-contract-pdf` ya registradas ahí. |
| `indices/DATABASE.md` | Nueva fila de función/cron + actualizar `professional_promotions`/`class_book` con el job automático + nota de `end_date` variable (ya no fijo) | Sync obligatorio de índices tras tocar BD. |
| `indices/FACADES.md` | Documentar el nuevo comportamiento de `saveAssignment()` (matrícula tardía) y de `crearPromocion()`/`previewEndDate()` (recuperación de feriados) | Sync obligatorio. |
| `indices/UTILS.md` | Documentar `promotion-end-date.utils.ts` | Sync obligatorio — util nuevo en `core/utils/`. |
| `indices/NOTIFICATIONS-MAP.md` | N/A — no aplica, no hay notificación nueva. Se omite. | — |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `app-assignment-step` (`shared/components/matricula-steps/assignment/assignment.component.ts`)
  ya itera `promotionGroups[]` y ya muestra varias promociones activas simultáneamente (AC3) — no
  se toca.

### Facades/Services existentes que extendemos
- `EnrollmentFacade.loadPromotions()` — agregar `start_date` al select.
- `EnrollmentFacade.saveAssignment()` — agregar el gate de matrícula tardía.
- `EnrollmentFacade.confirm()` (ya delega a `ConfirmModalService.confirm()`) — se reutiliza tal
  cual, sin modificar su firma.
- `auto_transition_promotion_status()` y `cascade_promotion_status_to_courses()` (SQL existentes)
  — la Edge Function nueva convive con ellos, no los reemplaza ni duplica su lógica de status
  (inserta con `status='planned'`, deja que el cron diario existente transicione cuando toque).

### Lógica existente que se **porta** (no se reutiliza en runtime, se traduce a Deno)
- `promociones.facade.ts:crearPromocion()` — flujo de referencia para el INSERT de
  `professional_promotions` + `promotion_courses` + asignación de relatores. La Edge Function
  replica el mismo orden de escritura (promoción → cursos → relatores → feriados), pero con
  `branch_id` fijo (2) y `code` auto-calculado en vez de venir del formulario.
- `fetchHolidaysInRange()` / `cancelHolidaySessions()` — mismo fetch, mismo endpoint público,
  misma tolerancia a fallos (si la API de feriados falla, la promoción se crea igual sin
  cancelar sesiones — no bloquea AC1).
- `propagateCodeToCourses()` / `licenseClassToSuffix()` — mismo formato de `code` compuesto
  (`"{code}.{sufijo}"`). El sufijo (dígito 2-5 de `license_class`) se recalcula en TS dentro de
  la Edge Function (mismo lenguaje que el util original, se puede portar casi literal).

### Componentes/Facades que NO existen y debemos crear
- La Edge Function `auto-create-next-promotions` en sí — no existe nada que resuelva "crear
  promoción sin intervención humana" hoy; el único punto de creación es el formulario manual.
- `core/utils/promotion-end-date.utils.ts` — no existe hoy ningún cálculo de `end_date` que
  contemple feriados; `computeEndDate()` actual del drawer es fijo (`+33`) y vive mal ubicado
  (función local de un componente, no un util puro reutilizable) — se reemplaza, no se extiende.

---

## 4. Modelo de datos

### Migración requerida

**Nota de alcance (owner, 2026-07-28):** Clase Profesional solo opera en `branch_id = 2`
(Conductores Chillán) y eso no va a cambiar — la función NO recorre sedes, hardcodea el branch
igual que `crearPromocion()` hoy. La numeración de `code` es una secuencia global (no por sede).
El botón manual "Programar Promoción" (`crearPromocion()`) se mantiene intacto como fallback
para lunes fuera del cron — esta función no lo reemplaza ni lo deprecia.

**Nota de duración (owner, 2026-08-06):** confirmado L-S, 5 semanas / 30 clases por promoción.
Sin feriados en el rango, `end_date = start_date + 33` (sábado de la 5ª semana) — **mismo
valor que ya usa hoy** `computeEndDate()` en `admin-promocion-crear-drawer.component.ts:31-36`.
Este valor reemplaza el supuesto anterior de `+29` del draft inicial, que no estaba confirmado.
(Corrección propia 2026-08-07: una versión intermedia de este plan tenía `+34`, aritmética
errada — semana 5 termina en el día 33, no 34, contado desde el lunes de inicio como día 0.)

**Nota de recuperación de feriados (owner, 2026-08-07) — reemplaza el cálculo fijo de arriba:**
`end_date` **no es un offset fijo** — se calcula caminando día a día desde `start_date` (L-S,
saltando domingos) hasta acumular 30 días hábiles que **no** sean feriado. Si dentro de ese
rango hay N feriados, el resultado se corre N días hábiles más allá del sábado de la 5ª semana
(ej. con 2 feriados, puede terminar el martes de la semana 6 en vez del sábado de la semana 5,
tal como lo planteó el owner). Si un día de esa extensión también cae en feriado, sigue
extendiéndose — el algoritmo es inherentemente recursivo por ser un loop de conteo, no
requiere recursión explícita. Aplica **igual a la creación automática y a la manual** —
ambas llaman al mismo util `computePromotionEndDate()` (ver Inventario). El offset fijo
`+33` de arriba queda como el caso particular "cero feriados en el rango", no como la regla.

**Nota de ancla y colchón (owner, 2026-08-07):**
- La función **no crea solo "la siguiente" promoción** — en cada ejecución debe garantizar que
  existan al menos **1 promoción `in_progress` + 2 `planned`** (branch_id=2) hacia adelante.
  Si faltan, crea tantas consecutivas (cadencia 14 días) como haga falta para completar el
  colchón, no una sola.
- El ancla de la cadencia es siempre `MAX(start_date)` entre las promociones **existentes**
  (`planned`/`in_progress`/`finished`, branch_id=2) + 14 días para la siguiente, +28 para la
  subsiguiente, etc. — nunca se calcula desde "hoy".
- **Caso bootstrap (tabla vacía, sin ninguna promoción previa):** no es un caso esperado en
  producción — ya existe una promoción `in_progress` con `start_date = 2026-07-27` (confirmado
  por el owner) de la cual la función deriva todo el resto de la cadencia. Se documentan
  **2 valores de respaldo** como constantes en el código, ambos referidos a esa misma
  promoción real, **solo como defensa** ante ese escenario vacío — si la función los usa
  alguna vez, es señal de un problema real (tabla vaciada/reseteada), no un flujo normal. No se
  diseña UI ni configuración para cambiarlos:
  - `FALLBACK_ANCHOR_START_DATE = '2026-07-27'::date`
  - `FALLBACK_ANCHOR_CODE = 275` (confirmado por el owner 2026-08-07: la promoción del
    2026-06-29 tiene `code 273` en la autoescuela real; con cadencia de 14 días sin saltos,
    2 ciclos después — el 2026-07-27 — corresponde `code 275`. Mismo criterio que AC1b:
    `MAX(code::int)+1`, este es simplemente el valor que ese `MAX` tomaría si la tabla
    estuviera vacía.)

```sql
-- supabase/migrations/20260806HHMMSS_auto_create_next_promotions_cron.sql

-- 1. Asegurar extensión pg_net (requerida para invocar la Edge Function por HTTP desde cron).
--    Precedente: este es el primer uso de pg_net en el proyecto — todos los cron jobs
--    anteriores llamaban funciones SQL puras (auto_transition_promotion_status,
--    cleanup_expired_public_enrollment, auto_transition_theory_cycle_status). La spec 0027
--    evaluó y descartó este mismo patrón para el envío de Zoom por falta de precedente; acá
--    se adopta por primera vez porque no hay alternativa SQL-pura para el fetch de feriados.
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Guardar la URL del proyecto y el service_role key en Vault (no hardcodear el JWT en la
--    migración). Se referencian por nombre desde el cron job.
--    (el valor real se setea una vez vía Supabase Dashboard / CLI, no en SQL versionado)

-- 3. Job pg_cron que invoca la Edge Function por HTTP.
SELECT cron.unschedule('auto-create-next-promotions')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-create-next-promotions');

SELECT cron.schedule(
  'auto-create-next-promotions',
  '0 6 * * *',   -- diario 06:00 UTC ≈ 03:00 CLT, mismo horario que
                 -- auto_transition_promotion_status(). La Edge Function es idempotente
                 -- (chequea start_date antes de insertar, AC-E1) — correr diario es seguro.
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/auto-create-next-promotions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

```typescript
// supabase/functions/auto-create-next-promotions/index.ts (pseudo-código, detalle en tasks.md)
//
// CONST FALLBACK_ANCHOR_START_DATE = '2026-07-27'  // solo por si branch_id=2 queda sin
// CONST FALLBACK_ANCHOR_CODE = 275                 // NINGUNA promoción — no se espera que
//                                                   // dispare nunca (ver §4).
//
// 1. v_active_count  = COUNT(*) WHERE branch_id=2 AND status='in_progress'
//    v_planned_count = COUNT(*) WHERE branch_id=2 AND status='planned'
//    v_missing = max(0, 1 - v_active_count) + max(0, 2 - v_planned_count)
//    Si v_missing === 0 → return 200, no crea nada (colchón ya cubierto).
// 2. v_last_start = MAX(start_date) de professional_promotions WHERE branch_id=2
//                   (o FALLBACK_ANCHOR_START_DATE si la tabla está vacía — no esperado, ver §4)
//    v_last_code  = MAX(code::int) de professional_promotions donde code ~ '^\d+$'
//                   (o FALLBACK_ANCHOR_CODE si no hay ninguna con code numérico — no esperado)
// 3. Loop v_missing veces (crea las promociones consecutivas que faltan):
//      v_next_start = v_last_start + 14
//      Idempotencia (AC-E1): si ya existe una promoción con start_date=v_next_start → skip,
//        no duplicar, avanzar igual v_last_start = v_next_start para la siguiente vuelta.
//      v_next_code = (v_last_code + 1).toString()
//      -- Feriados y end_date se resuelven ANTES del insert (AC6): se fetchea el año (o años,
//      -- si el rango cruza diciembre→enero) completo de feriados de apis.digital.gob.cl —
//      -- no se puede filtrar por end_date todavía porque end_date depende del resultado.
//      holidaySet = fetchHolidaysForYears(yearsSpannedFrom(v_next_start))
//      v_next_end = computePromotionEndDate(v_next_start, holidaySet)  ← mismo algoritmo que
//        core/utils/promotion-end-date.utils.ts, portado a Deno (ver _shared/holidays.ts)
//      INSERT professional_promotions (code=v_next_code, status='planned',
//        start_date=v_next_start, end_date=v_next_end, branch_id=2)
//      Por cada curso profesional relevante (is_convalidation=false, branch_id=2 vía join):
//        INSERT promotion_courses (promotion_id, course_id, max_students=25, status='planned',
//          code = `${v_next_code}.${licenseClassToSuffix(course.license_class)}`)
//        INSERT class_book (branch_id=2, promotion_course_id, period=v_next_code, status='draft')
//          ← EXPLÍCITO: no depender de saveClassBookFields()/generate-class-book-pdf (los 2
//            únicos puntos de creación hoy — ver spec.md §6, hallazgo del owner).
//      -- El trigger generate_sessions_from_promotion() ya genera TODAS las sesiones L-S del
//      -- rango extendido [v_next_start, v_next_end] al insertar cada promotion_course (dispara
//      -- solo con esas 2 columnas ya escritas en professional_promotions) — por eso el orden
//      -- (end_date correcto ANTES de insertar promotion_courses) es crítico, no cosmético.
//      holidaysInRange = holidaySet ∩ [v_next_start, v_next_end]
//      Si holidaysInRange no vacío: cancelHolidaySessions() por cada promotion_course_id creado
//        (UPDATE professional_theory_sessions / professional_practice_sessions SET
//        status='cancelled' WHERE promotion_course_id=X AND date IN holidaysInRange)
//      Si el fetch de feriados falla: continuar con end_date = start+33 (0 feriados asumidos,
//        no bloquea AC1) — mismo comportamiento tolerante a fallos que el flujo manual.
//      v_last_start = v_next_start  // encadena +14 en la siguiente vuelta del loop
//      v_last_code  = v_next_code   // encadena +1 en la siguiente vuelta del loop
```

**Nota:** `in_progress` depende de `auto_transition_promotion_status()` (cron diario existente,
06:00 UTC) para pasar de `planned`→`in_progress` cuando `start_date <= CURRENT_DATE`. Esta
Edge Function corre **después** de ese cron en el mismo horario (mismo `0 6 * * *`) — se define
el orden relativo en tasks.md para que el conteo de `in_progress` que usa el colchón ya refleje
la transición del día antes de decidir cuántas promociones faltan.

### RLS

| Tabla | Rol | Operación | Política |
|-------|-----|-----------|----------|
| `professional_promotions` | `service_role` (Edge Function con `service_role` key) | INSERT | Sin cambios — la función usa el client de `service_role`, bypassa RLS igual que las demás Edge Functions del proyecto (`create-instructor`, etc.). Policies de usuario (`admin`/`secretary` INSERT) no se tocan. |
| `promotion_courses` | `service_role` | INSERT | Igual. |
| `class_book` | `service_role` | INSERT | Igual. |
| `professional_theory_sessions` / `professional_practice_sessions` | `service_role` | UPDATE (cancelación por feriado) | Igual. |

### Modelos UI/DTO

- `core/models/ui/enrollment-assignment.model.ts` → `PromotionOption.startDate: string | null`
  ya existe (fix-089, fecha ISO de `professional_promotions.start_date`). Se reutiliza tal cual
  para el gate de matrícula tardía, sin campo nuevo.

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
[pg_cron 06:00 UTC diario]
        │
        ▼
net.http_post()  (pg_net, SQL) ──HTTP──▶  auto-create-next-promotions  (Edge Function, Deno)
                                                  │
                                                  │  1. cuenta in_progress/planned actuales
                                                  │     (branch_id=2) → ¿falta colchón
                                                  │     1 activa + 2 programadas?
                                                  │  2. por cada faltante (loop): next start_date
                                                  │     = último start_date + 14, idempotencia
                                                  │     (AC-E1); fetch feriados → end_date =
                                                  │     computePromotionEndDate() (AC6); INSERT
                                                  │     promotion + courses + class_book; cancela
                                                  │     sesiones en feriados del rango extendido
                                                  ▼
                                    (sin UI directa — visible en
                                    AdminProfesionalPromocionesComponent y en el selector
                                    del wizard, ambos ya leen la tabla normalmente)

Admin/Secretaria → admin-promocion-crear-drawer (Smart: PromocionesFacade)
        │  selecciona lunes de inicio
        ▼
PromocionesFacade.previewEndDate(startDate)
        │  fetch feriados del año + computePromotionEndDate() (mismo util que arriba)
        ▼
Drawer muestra end_date real (ya extendido si aplica) ANTES de guardar
        │  admin confirma → PromocionesFacade.crearPromocion()
        ▼
crearPromocion() reutiliza el mismo end_date ya calculado → INSERT (AC6 aplicado igual
que en la Edge Function, mismo util, sin duplicar la regla de negocio)

Usuario (Secretaria/Admin) → app-assignment-step (Smart: EnrollmentFacade)
        │  selecciona promoción (ya ve varias activas, sin cambios — AC3)
        ▼
EnrollmentFacade.saveAssignment()
        │  calcula días desde startDate de la opción elegida
        ├─ ≤ 3 días  → continúa normal
        └─ > 3 días  → this.confirm({...}) → ConfirmModalService (modal global)
                            ├─ cancela → aborta saveAssignment(), no persiste
                            └─ confirma → continúa el flujo normal de INSERT
```

### Capas tocadas

- **Núcleo Funcional**: `core/utils/promotion-end-date.utils.ts` (cálculo puro de `end_date`
  con recuperación de feriados, sin I/O — compartido entre `PromocionesFacade` y, portado, la
  Edge Function).
- **Facade**: `core/facades/enrollment.facade.ts` (gate de matrícula tardía) y
  `core/facades/promociones.facade.ts` (fix de `end_date` en `crearPromocion()` + nuevo
  `previewEndDate()`).
- **Edge Function**: `supabase/functions/auto-create-next-promotions/index.ts` (nueva).
- **Migration**: `supabase/migrations/20260806HHMMSS_auto_create_next_promotions_cron.sql`
  (`pg_net` + `pg_cron` job).
- **Modelo UI**: `core/models/ui/enrollment-assignment.model.ts` (campo nuevo, sin lógica).
- **Smart Component modificado**: `admin-promocion-crear-drawer.component.ts` — reemplaza su
  `computeEndDate()` local (pura, fija) por una llamada async a
  `PromocionesFacade.previewEndDate()`. Es el único componente que cambia; `app-assignment-step`
  sigue recibiendo `EnrollmentAssignmentData` igual que hoy, el modal de matrícula tardía lo
  dispara el facade antes de que el componente reciba confirmación de guardado exitoso.

---

## 6. Restricciones aplicables (referencia al sistema Koa)

- [x] `architecture.md` — sin componentes nuevos; el cambio de facade mantiene Signals/estado
  existente, no se introduce RxJS nuevo.
- [ ] `facades.md` — N/A, `EnrollmentFacade` no es branch-scoped en el sentido de la tabla de
  `facades.md` (usa `branchId` como parámetro explícito de `loadPromotions()`, no
  `BranchFacade.selectedBranchId()` — sin cambios a ese patrón).
- [x] `models.md` — extensión de `PromotionOption` vía campo nuevo, no se duplica interfaz.
- [ ] `visual-system.md` — N/A, no hay UI nueva (el modal reutiliza `ConfirmModalService`, ya
  themeado).
- [ ] `swr-pattern.md` — N/A, `loadPromotions()` no cachea entre navegaciones (spec dice "Solo
  fetch" para wizards de matrícula).
- [ ] `notifications.md` — N/A, no se crean notificaciones persistentes ni toasts nuevos (el
  modal de confirmación no es un toast; la Edge Function no dispara notificaciones — fuera de
  scope).
- [x] `testing-tdd.md` — 3 frentes: (1) `promotion-end-date.utils.spec.ts` para el cálculo
  puro de recuperación de feriados (obligatorio, `core/utils/` — "las más fáciles y valiosas
  de testear"), escrito ANTES de la implementación (TDD real, no solo checklist). (2)
  `enrollment.facade.spec.ts` para el gate de matrícula tardía. (3)
  `promociones.facade.spec.ts` para el fix de `crearPromocion()`/`previewEndDate()`. La Edge
  Function no corre bajo Vitest — su verificación es manual/SQL (ver §7), consistente con cómo
  se testean las demás Edge Functions del proyecto (sin `.spec.ts` de Angular), pero replica
  los mismos casos de `promotion-end-date.utils.spec.ts` documentados en tasks.md.
- [ ] `ai-readability.md` — N/A, no hay botón de mutación nuevo (el modal de confirmación ya
  usa el patrón estándar de `ConfirmModalService`, que ya tiene su propia cobertura).

---

## 7. Plan de testing

- **Unitarios (`promotion-end-date.utils.spec.ts`)** — escribir PRIMERO (TDD real):
  - Sin feriados en el rango → `end_date = start + 33` (caso base, igual al valor hoy vigente).
  - 1 feriado a mitad del rango → `end_date = start + 35` (el día 34 siempre cae domingo porque
    las promociones arrancan lunes, así que el primer día hábil de recupero es el 35, no el 34).
  - 2 feriados no consecutivos → `end_date = start + 36`.
  - 2 feriados consecutivos (L y M de la misma semana) → `end_date = start + 36` igual, sin
    loop infinito ni error (AC-E2).
  - Feriado que cae exactamente en lo que sería el último día (`start+33`) → fuerza extensión
    recursiva; como el día siguiente (34) ya es domingo, el resultado coincide con el caso de
    1 feriado (`start + 35`).
  - Feriado un domingo dentro del rango → no afecta el conteo (los domingos ya estaban
    excluidos antes de mirar feriados).
- **Unitarios (`promociones.facade.spec.ts`)**:
  - `crearPromocion()` con feriados devueltos por el mock de `fetchHolidaysInRange` → el
    `end_date` en el INSERT simulado refleja la extensión, no un valor fijo.
  - `previewEndDate(startDate)` retorna el mismo valor que calcularía `crearPromocion()` para
    ese `startDate` (consistencia preview↔persistencia).
- **Unitarios (`enrollment.facade.spec.ts`)**:
  - `saveAssignment()` con promoción seleccionada de ≤3 días desde `start_date` → no llama
    `confirm()`, persiste directo.
  - `saveAssignment()` con promoción de >3 días, usuario confirma → llama `confirm()`, luego
    persiste.
  - `saveAssignment()` con promoción de >3 días, usuario cancela → llama `confirm()`, NO
    persiste, retorna `false`.
  - Edge case: exactamente 3 días (límite inclusive, según AC4 "3 días o menos").
- **Edge Function (manual, vía `npx supabase functions serve` local + `curl`/Postman)**:
  - Invocar `auto-create-next-promotions` 2 veces seguidas sin avanzar el reloj → confirmar
    que la segunda ejecución NO crea una promoción duplicada (idempotencia, AC-E1).
  - Con 0 `planned` y 1 `in_progress` en BD de prueba → confirmar que una sola invocación crea
    exactamente 2 `planned` nuevas (colchón), encadenadas +14/+28 desde la última `start_date`.
  - Con el colchón ya completo (1 `in_progress` + 2 `planned`) → confirmar que la invocación no
    crea nada.
  - Verificar que cada `promotion_courses` insertado tiene su `class_book` correspondiente
    (join `promotion_courses` ⟕ `class_book`, cero filas huérfanas).
  - Verificar que sin feriados `end_date = start_date + 33`, y que con feriados reales del año
    de prueba `end_date` se extiende exactamente lo esperado (mismo caso que
    `promotion-end-date.utils.spec.ts` pero de punta a punta contra BD real local).
  - Verificar que las sesiones L-S existen para TODO el rango extendido (no solo hasta el
    `+33` original) salvo las que caen en feriado (canceladas).
  - Simular fallo del fetch de feriados (mockear `apis.digital.gob.cl` caído) → confirmar que
    la promoción se crea igual con `end_date = start+33` (0 feriados asumidos), sin sesiones
    canceladas, sin error 500.
- **pg_cron/pg_net (manual, vía Supabase Studio local)**:
  - Ejecutar `SELECT net.http_post(...)` manualmente contra la función local y confirmar
    respuesta 200 + efecto en BD.
  - Confirmar que el `service_role_key` vive en `vault`, no en el SQL de la migración
    versionada.
- **QA manual**: matricular un alumno Profesional en una promoción con `start_date` hace 4-5
  días (dato de seed o ajustado a mano en local) y confirmar que aparece el modal con el texto
  correcto, para admin y para secretaria.
- **QA manual (drawer de creación)**: seleccionar un lunes cuyo rango de 5 semanas contenga al
  menos 1 feriado real y confirmar que el preview de "Fecha de término" en el drawer muestra la
  fecha ya extendida (no `start+33`) antes de guardar, con estado de carga visible mientras se
  resuelve el fetch de feriados.
- No aplica `/verify` (Playwright) — no hay componente visual nuevo, el modal es
  `ConfirmModalService` ya visualmente auditado en otros flujos.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Duplicar promociones si el cron corre más de una vez el mismo día (reinicio, retry de `pg_net`) | Baja | Chequeo idempotente por `start_date` antes de insertar (contemplado en el pseudo-código, AC-E1). |
| `pg_net`/`net.http_post` falla silenciosamente (timeout, DNS, key rotado) y nadie se entera — es un patrón nuevo sin monitoreo previo en el proyecto | **Media-Alta** | `net.http_post` es asíncrono y no lanza excepción SQL en el cron aunque la Edge Function falle. Definir en tasks.md un chequeo de salud simple (ej. tabla de log de ejecución, o alerta si pasan >8 días sin una promoción nueva vía el mismo `DashboardAlertsFacade`/query manual). Este es el riesgo más nuevo del proyecto — no hay precedente de qué pasa cuando pg_net falla en silencio. |
| Carrera entre el cron automático y alguien usando el botón manual "Programar Promoción" el mismo día, generando 2 promociones para el mismo lunes | Baja | El chequeo de idempotencia (AC-E1) se basa en `start_date` existente, no en el origen (manual vs cron) — cubre este caso igual. Definir en tasks.md si hace falta un `UNIQUE(branch_id, start_date)` en `professional_promotions` para blindarlo a nivel de constraint, no solo de lógica aplicativa. |
| `code` calculado mal si la última promoción tiene `code` no numérico o `NULL` (hoy `crearPromocion()` deja `code=NULL` hasta que se edita manualmente) | Media | `MAX(code::int)` debe filtrar `code ~ '^\d+$'` (mismo regex que usa `editarPromocion()` en TS) antes de castear. Definir en tasks.md qué pasa si NINGUNA promoción histórica tiene `code` numérico todavía (semilla manual una vez). |
| El cálculo de "días desde inicio" en el facade usa timezone del cliente en vez de Chile | Baja | Reutilizar el mismo patrón de comparación de fechas que ya usa el proyecto para `expiry_date`/`license_expiry` (`CURRENT_DATE`-based en SQL; en TS, comparar solo la parte de fecha, no `Date.now()` con horas). |
| La API pública de feriados (`apis.digital.gob.cl`) cambia de contrato o se cae permanentemente | Baja | Mismo riesgo que ya asume el flujo manual hoy — comportamiento ya definido: fallo tolerado, promoción se crea con `end_date = start+33` (0 feriados asumidos). No es un riesgo nuevo introducido por esta spec, pero ahora afecta también el cálculo de `end_date`, no solo la cancelación de sesiones. |
| El algoritmo de recuperación (`computePromotionEndDate()`) entra en un rango donde el fetch de feriados solo cubrió el año de `start_date` pero la extensión cruza a enero del año siguiente (promoción que arranca en diciembre) | Media | `fetchHolidaysForYears()` debe recibir explícitamente el/los año(s) cubiertos por el rango **extendido estimado**, no solo el año de `start_date` — cubrir con margen (ej. `start_date` a `start_date + 45`) antes de correr el algoritmo, para no cortar feriados de enero a mitad de cálculo. Caso de prueba explícito en `promotion-end-date.utils.spec.ts` (promoción que arranca fin de diciembre). |
| El fix a `crearPromocion()` cambia el comportamiento de un flujo YA usado en producción — un `end_date` distinto al que el admin esperaba (más largo) puede sorprender si no se comunica | Baja | El preview async en el drawer (`previewEndDate()`) muestra la fecha real ANTES de guardar — el admin ve el efecto antes de confirmar, no después. Texto de ayuda actualizado explica la extensión por feriados. |

---

## 9. Orden de implementación

1. `promotion-end-date.utils.spec.ts` — escribir los 6 casos de recuperación de feriados
   (TDD real, antes de implementar el util).
2. `promotion-end-date.utils.ts` — implementar hasta que los tests del punto 1 pasen.
3. `promociones.facade.ts` — fix de `crearPromocion()` (reordenar fetch de feriados antes del
   insert, usar el util nuevo) + `previewEndDate()`. Tests en `promociones.facade.spec.ts`.
4. `admin-promocion-crear-drawer.component.ts` — reemplazar `computeEndDate()` local por
   `previewEndDate()` async, estado de carga, texto de ayuda actualizado.
5. Edge Function `auto-create-next-promotions` (Deno) — colchón 1 activa + 2 programadas (loop),
   `class_book` explícito, `end_date` vía el mismo algoritmo (portado a `_shared/holidays.ts`),
   fetch de feriados, idempotencia.
6. Migración SQL: `pg_net` + `vault` (secrets) + `pg_cron` job que invoca la función por HTTP.
7. ~~`enrollment-assignment.model.ts`: agregar `promotionStartDate` a `PromotionOption`~~ — ya
   existe como `startDate`, sin cambios.
8. `enrollment.facade.spec.ts`: escribir tests del gate de matrícula tardía (TDD, antes del
   punto 9).
9. `enrollment.facade.ts`: `saveAssignment()` (gate, usando `startDate` ya disponible en
   `loadPromotions()`).
10. `npm run test:ci` — confirmar verde.
11. QA manual: invocar la Edge Function local 2 veces (idempotencia, AC-E1) + verificar
    `class_book`/feriados/extensión de `end_date` + probar el preview del drawer manual con un
    lunes que cruce feriados + probar el modal de matrícula tardía (AC5) para admin y
    secretaria.
12. Sync `indices/DATABASE.md` + `indices/FACADES.md` + `indices/UTILS.md`.
13. `npm run lint:arch`.

---

## 10. Estimación

M/L — 2 a 3 días. Sube de la estimación anterior (1-2 días) porque se agregó un fix real a un
flujo YA en producción (`crearPromocion()`), no solo la automatización nueva: hay un util nuevo
con 6 casos de test, un cambio de UX async en el drawer manual (preview con estado de carga), y
la Edge Function debe portar el mismo algoritmo en vez de un offset fijo. Los mayores riesgos de
tiempo son (a) sincronizar el mismo algoritmo de recuperación de feriados entre TS (Angular) y
Deno (Edge Function) sin que diverjan con el tiempo, y (b) el monitoreo de fallos silenciosos de
`pg_net` (§8) — no la lógica de negocio en sí, que ya quedó completamente especificada.

---

## Changelog

- 2026-07-28 — plan inicial, a partir de spec.md aprobada (incluye hallazgo de `class_book`
  perezoso detectado por el owner).
- 2026-07-28 — agregada auto-asignación de `code` secuencial global (AC1b) y confirmado
  branch_id=2 fijo (sin filtrado de sedes). Aclarado que el botón manual "Programar Promoción"
  se mantiene sin cambios. Verificado `licenseClassToSuffix()` — sufijo es solo el dígito 2-5,
  trivial de replicar en SQL.
- 2026-08-06 — plan regenerado tras desbloquear la spec: arquitectura cambia de trigger SQL
  puro a Edge Function programada invocada vía `pg_cron`+`pg_net` (para poder hacer fetch a la
  API de feriados, confirmado por el owner). `end_date` corregido de `+29` a `+34` días
  (L-S, 5 semanas / 30 clases, confirmado por el owner). Talla re-evaluada de S/M a M por ser
  un patrón de infraestructura sin precedente en el proyecto (ver riesgo `pg_net` en §8).
- 2026-08-07 — 3 ajustes del owner: (1) verificado que la creación manual
  (`admin-promocion-crear-drawer.component.ts`) ya calcula L-S/5 semanas correctamente — el
  error de `+34` era propio de este plan, corregido a `+33` (mismo valor que usa el código
  manual real). (2) La función deja de garantizar solo "la siguiente" promoción: ahora
  mantiene un colchón mínimo de 1 `in_progress` + 2 `planned`, creando en loop las que falten.
  (3) Ancla de cadencia documentada explícitamente: siempre `MAX(start_date)` real + 14, nunca
  "hoy"; caso de tabla vacía (no esperado en producción) usa `2026-07-27` como constante de
  respaldo, anclado a la promoción `in_progress` real confirmada por el owner.
- 2026-08-07 — cambio de alcance del owner (AC6/AC-E2 en spec.md): `end_date` deja de ser un
  offset fijo (`+33`) — se calcula extendiéndose N días hábiles por cada feriado dentro del
  rango, para completar siempre 30 clases reales, en vez de perderlas (`crearPromocion()` hoy
  solo cancela sesiones de feriado, no recupera el día). Confirmado que esto corrige también
  la creación manual, no solo la Edge Function nueva — agregado util puro
  `promotion-end-date.utils.ts` compartido entre `PromocionesFacade` y la Edge Function
  (portada a Deno), fix de `crearPromocion()`, y cambio de UX en el drawer manual (preview
  async con estado de carga en vez del cálculo síncrono fijo anterior). Estimación sube de
  M (1-2 días) a M/L (2-3 días).
- 2026-08-07 — agregada constante de respaldo `FALLBACK_ANCHOR_CODE = 275` para el caso
  bootstrap de `code` (tabla vacía), junto a `FALLBACK_ANCHOR_START_DATE` ya existente — ambas
  refieren a la misma promoción real `in_progress` (2026-07-27). Valor confirmado por el owner
  a partir de un dato real de producción (promoción del 2026-06-29 tiene `code 273`; con
  cadencia de 14 días sin saltos, 2 ciclos después corresponde `code 275`).
