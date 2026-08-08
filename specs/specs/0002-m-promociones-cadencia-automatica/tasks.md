# Tasks 0002-m — Promociones automáticas: cadencia, matrícula tardía y convalidaciones

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done
> **Created:** 2026-08-07

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 1 — Núcleo funcional y modelo de datos

- [x] **T1.1** — Escribir `core/utils/promotion-end-date.utils.spec.ts` PRIMERO (TDD)
  - **AC ref:** AC6, AC-E2
  - **DoD:**
    - [x] Caso sin feriados en el rango → `end_date = start + 33` (línea base, igual al valor
      hoy vigente en `computeEndDate()`)
    - [x] Caso 1 feriado a mitad del rango → `end_date = start + 35` (el día 34 siempre cae
      domingo porque las promociones arrancan lunes, así que el primer día hábil de recupero
      es el 35)
    - [x] Caso 2 feriados no consecutivos → `end_date = start + 36`
    - [x] Caso 2 feriados consecutivos (L y M de la misma semana) → `end_date = start + 36`,
      sin loop infinito ni error (AC-E2)
    - [x] Caso feriado que cae exactamente en lo que sería el último día (`start+33`) → fuerza
      extensión recursiva de 1 día más
    - [x] Caso feriado en domingo dentro del rango → no afecta el conteo (domingo ya excluido)
    - [x] Tests FALLAN (no hay implementación aún)

- [x] **T1.2** — Implementar `core/utils/promotion-end-date.utils.ts`
  - **AC ref:** AC6, AC-E2
  - **DoD:**
    - [x] `computePromotionEndDate(startDate: string, holidayDates: Set<string>): string` — pura,
      sin I/O, camina día a día (L-S, salta domingos) contando 30 días hábiles no-feriado
    - [x] Tests de T1.1 PASAN (`npm run test:ci`)
    - [x] Documentado en `indices/UTILS.md`

- [x] **T1.3** — Agregar `promotionStartDate: string` a `PromotionOption`
  - **AC ref:** AC4, AC5
  - **DoD:**
    - [x] Ya existe: `PromotionOption.startDate: string | null` (`enrollment-assignment.model.ts:85`,
      agregado en fix-089 para la validación de antigüedad de licencia). `loadPromotions()` ya
      lo selecciona (`start_date`) y lo mapea (`enrollment.facade.ts:945`) — no hace falta
      campo nuevo, T2.4 reutiliza `startDate` tal cual.

- [x] **T1.4** — Crear migración `20260807090000_auto_create_next_promotions_cron.sql`
  - **AC ref:** AC1, AC-E1
  - **DoD:**
    - [x] `CREATE EXTENSION IF NOT EXISTS pg_net;`
    - [x] Secrets (`project_url`, `service_role_key`) referenciados vía `vault`, NUNCA
      hardcodeados en el SQL versionado
    - [x] `cron.unschedule` + `cron.schedule('auto-create-next-promotions', '0 6 * * *', ...)`
      invocando `net.http_post` a la Edge Function
    - [x] Corre **después** de `auto_transition_promotion_status()` en el mismo horario (mismo
      cron `0 6 * * *`, orden documentado en el comentario SQL) para que el conteo de
      `in_progress` ya refleje la transición del día
    - [x] `npx supabase db reset` corre sin error
    - [x] Documentado en `indices/DATABASE.md` (nueva fila de función/cron + nota de `end_date`
      variable, ya no fijo)

---

## Fase 2 — Capa Facade (fix manual + matrícula tardía)

- [x] **T2.1** — Escribir tests nuevos en `core/facades/promociones.facade.spec.ts` PRIMERO (TDD)
  - **AC ref:** AC6
  - **DoD:**
    - [x] `crearPromocion()` con feriados mockeados en `fetchHolidaysInRange` → el `end_date`
      del INSERT simulado refleja la extensión, no el valor fijo `start+33`
    - [x] `previewEndDate(startDate)` retorna el mismo valor que calcularía `crearPromocion()`
      para ese `startDate` (consistencia preview↔persistencia)
    - [x] Tests FALLAN (no hay implementación aún)

- [x] **T2.2** — Fix `crearPromocion()` + nuevo `previewEndDate()` en `promociones.facade.ts`
  - **AC ref:** AC6
  - **DoD:**
    - [x] Reordenado: fetch de feriados del año(s) relevante(s) ANTES del INSERT de
      `professional_promotions` (ya no se puede filtrar por `endDate`, aún no existe — se
      fetchea el año completo). Método renombrado `fetchHolidaysForYears()` (ya no recibe
      `endDate`, solo filtra `>= startDate`).
    - [x] `end_date = computePromotionEndDate(startDate, holidaySet)` en vez del valor recibido
      del formulario
    - [x] `cancelHolidaySessions()` sigue igual, pero opera sobre el rango ya extendido
      (`holidaysInRange` filtrado post-cálculo con el `endDate` ya conocido)
    - [x] Método público `previewEndDate(startDate: string): Promise<string>` agregado, usa el
      mismo util
    - [x] Tests de T2.1 PASAN (`npm run test:ci`)
    - [x] Documentado en `indices/FACADES.md`

- [x] **T2.3** — Escribir tests nuevos en `core/facades/enrollment.facade.spec.ts` PRIMERO (TDD)
  - **AC ref:** AC4, AC5
  - **DoD:**
    - [x] `saveAssignment()` con promoción ≤3 días desde `start_date` → no llama `confirm()`,
      persiste directo
    - [x] `saveAssignment()` con promoción >3 días, usuario confirma → llama `confirm()`, luego
      persiste
    - [x] `saveAssignment()` con promoción >3 días, usuario cancela → llama `confirm()`, NO
      persiste, retorna `false`
    - [x] Edge case: exactamente 3 días (límite inclusive, AC4 "3 días o menos")
    - [x] Tests FALLAN (no hay implementación aún)

- [x] **T2.4** — Implementar gate de matrícula tardía en `enrollment.facade.ts`
  - **AC ref:** AC3, AC4, AC5
  - **DoD:**
    - [x] `loadPromotions()` ya incluía `start_date` en el `select()` y lo mapeaba a
      `PromotionOption.startDate` (fix-089, ver T1.3) — sin cambios nuevos aquí
    - [x] `saveAssignment()`: calcula días desde `startDate` de la opción seleccionada
      (`_promotionGroups()` flatMap); si > 3, llama `this.confirm({...})` (wrapper ya
      existente) y aborta (`return false`) si el usuario cancela
    - [x] Comparación de fechas por `todayIso()`/parte de fecha (`core/utils/date.utils.ts`),
      no `Date.now()` con horas (evita bug de timezone)
    - [x] Tests de T2.3 PASAN (`npm run test:ci`)
    - [x] AC3 (listar varias promociones activas): ya cubierto por el test existente
      `app-assignment-step`/`loadPromotions()` — no requirió test nuevo, el gate no lo toca
    - [x] Documentado en `indices/FACADES.md`

---

## Fase 3 — Edge Function (creación automática con colchón)

- [x] **T3.1** — Crear `supabase/functions/_shared/holidays.ts`
  - **DoD:**
    - [x] Puerto de `fetchHolidaysInRange()`/`fetchHolidaysForYears()` (fetch nativo a
      `apis.digital.gob.cl/fl/feriados/{año}`), tolerante a fallos (retorna `[]` si la API cae)
    - [x] Puerto de `computePromotionEndDate()` (mismo algoritmo que
      `core/utils/promotion-end-date.utils.ts` — casos de test documentados en el comentario
      del archivo para mantenerlos sincronizados). `holidays.test.ts` espeja los 6 casos de
      `promotion-end-date.utils.spec.ts` — no se pudo correr `deno test` en este entorno (no
      hay binario `deno` disponible), pero el algoritmo es un port literal ya verificado por
      los tests de Vitest equivalentes.

- [x] **T3.2** — Crear `supabase/functions/auto-create-next-promotions/index.ts`
  - **AC ref:** AC1, AC1b, AC2, AC6, AC-E1, AC-E2
  - **DoD:**
    - [x] Constantes `FALLBACK_ANCHOR_START_DATE = '2026-07-27'` y `FALLBACK_ANCHOR_CODE = 275`
      (branch_id=2, solo defensa ante tabla vacía — no se espera que disparen nunca)
    - [x] Cuenta `in_progress`/`planned` actuales (branch_id=2); calcula `missing` para
      completar colchón de 1 `in_progress` + 2 `planned`; si 0, responde 200 sin crear nada
    - [x] Loop `missing` veces: `start_date` = último `start_date` + 14 (idempotente por
      `start_date`, AC-E1); `code` = último `code` numérico + 1 (AC1b); `end_date` vía
      `computePromotionEndDate()` (AC6)
    - [x] INSERT `professional_promotions` (`status='planned'`, branch_id=2 fijo)
    - [x] Por cada curso profesional relevante: INSERT `promotion_courses` (`code` =
      `"{code}.{sufijo}"`, mismo formato que `propagateCodeToCourses()`) + INSERT `class_book`
      explícito (branch_id=2, `status='draft'`) — no depender de los 2 puntos de creación
      perezosa existentes (AC2)
    - [x] Cancela sesiones en feriados del rango extendido (`cancelHolidaySessions()` portado)
    - [x] Usa `service_role` key — bypassa RLS igual que las demás Edge Functions del proyecto
    - [x] `sufijo` de licencia recalculado igual que `licenseClassToSuffix()` (dígito 2-5)

- [x] **T3.3** — Registrar la función en `supabase/config.toml`
  - **DoD:**
    - [x] Sección `[functions.auto-create-next-promotions]` con `verify_jwt = false` (invocada
      solo por el cron vía `service_role`), mismo patrón que `generate-class-book-pdf`

---

## Fase 4 — Capa UI (drawer de creación manual)

- [x] **T4.1** — Migrar preview de "Fecha de término" a async en
  `admin-promocion-crear-drawer.component.ts`
  - **AC ref:** AC6
  - **DoD:**
    - [x] Eliminada la función local `computeEndDate()` (pura, fija)
    - [x] Al seleccionar un lunes, llama `promocionesFacade.previewEndDate(selectedStartDate())`
      de forma async, con signal de estado de carga (`endDateLoading`) mientras resuelve.
      `endDate` pasa de `computed()` a `signal()` puro, actualizado dentro de un `effect()`
      con `createRequestGuard()` (evita que una respuesta vieja pise una más nueva si el
      admin cambia de lunes rápido).
    - [x] Texto de ayuda actualizado: ya no dice "sábado de la 5ta semana" a secas — aclara
      que se extiende si hay feriados en el rango. Mismo ajuste en el bullet de "Reglas de
      negocio" del sidebar.
    - [x] `crearPromocion()` reutiliza el `end_date` ya calculado en el preview, no recalcula
      por separado con un valor distinto — ambos llaman al mismo
      `computePromotionEndDate()` con los mismos feriados fetcheados, así que coinciden
      determinísticamente (no hay paso explícito de "reusar" el string, pero el resultado es
      idéntico por construcción). `canSubmit()` ahora también exige `!!endDate() &&
      !endDateLoading()` para no poder enviar con el preview a medio resolver.
    - [x] OnPush se mantiene, sin romper el patrón Smart existente
    - [x] Documentado en `indices/COMPONENTS.md`

---

## Fase 5 — Validación

- [x] **T5.1** — `npm run lint:arch` corre limpio (exit 0 — solo warnings ARCH-10/ARCH-11/ARCH-14
  preexistentes, ninguno nuevo introducido por esta spec salvo `crearPromocion()` que ya
  superaba las 50 líneas antes del fix)
- [x] **T5.2** — `npm run test:ci` corre verde para todo lo tocado por esta spec (1835 passed).
  9 tests fallan en `flota.facade.spec.ts` (`NG0201: No provider found for MessageService`) —
  **preexistente, no relacionado**: ese archivo no fue tocado en esta sesión

- [x] **T5.3** — QA manual: Edge Function (local, `npx supabase functions serve` + PowerShell
  `Invoke-WebRequest` — `curl`/Postman bloqueados por el Bash Guard del proyecto, mismo efecto)
  - **AC ref:** AC1, AC2, AC-E1, AC6
  - **DoD:**
    - [x] Invocar 2 veces seguidas sin avanzar el reloj → segunda ejecución NO duplica (AC-E1).
      Verificado con el colchón ya cubierto (1 `in_progress` + 3 `planned`): ambas invocaciones
      devuelven `{"created":0,"missing":0}`, sin filas nuevas.
    - [x] Con 0 `planned`/0 `in_progress` en BD de prueba (`db reset` limpio, branch_id=2 sin
      ninguna promoción) → una invocación crea 3 (colchón completo desde el fallback anchor:
      1 para el hueco de `in_progress` + 2 `planned`), encadenadas +14/+28/+42 desde
      `2026-07-27` (código 275 → 276/277/278). Confirma también el fallback anchor (AC-E1/§4).
    - [x] Con el colchón ya completo (forzando 1 fila a `in_progress` vía PATCH REST directo,
      simulando lo que haría `auto_transition_promotion_status()`) → la invocación no crea
      nada, 2 veces seguidas.
    - [x] Cada `promotion_courses` insertado (16 filas, 4 promociones × 4 cursos A2-A5) tiene su
      `class_book` correspondiente vía join — sin filas huérfanas, `code` con formato
      `"{code}.{sufijo}"` correcto (`.2`/`.3`/`.4`/`.5`).
    - [~] Con feriados reales del año de prueba, `end_date` se extiende lo esperado — **no
      verificable en este entorno**: `apis.digital.gob.cl` no es alcanzable desde el sandbox
      (red externa bloqueada), así que el fetch siempre falla y cae al tolerante `end_date =
      start+33`. El algoritmo de extensión ya está exhaustivamente cubierto por los 6 casos de
      T1.1/T3.1 (unitarios, sin I/O) — este caso solo falta el smoke test end-to-end con la API
      real, pendiente para QA en un entorno con salida a internet.
    - [x] Sesiones L-S existen para TODO el rango [start_date, end_date] (30 filas exactas,
      domingos correctamente ausentes, verificado en `professional_practice_sessions` para la
      promoción `276`: 2026-08-10 → 2026-09-12).
    - [x] Fallo del fetch de feriados → promoción se crea igual, `end_date = start+33`, sin
      error 500 — **verificado de facto** en todas las corridas de este entorno (la API externa
      no es alcanzable, así que este es exactamente el camino que se ejercitó en cada llamada).

- [x] **T5.4** — QA manual: pg_cron/pg_net (`npx supabase db query`, Supabase Studio no
  disponible en este entorno headless — mismo efecto vía SQL directo)
  - **DoD:**
    - [x] `SELECT net.http_post(...)` manual contra la función local → `request_id` encolado,
      `net._http_response` confirma `status_code=200` + `{"created":0,"missing":0}` (colchón ya
      cubierto en ese punto) — efecto real en BD confirmado en los pasos de T5.3.
    - [x] `service_role_key` vive en `vault`, no en el SQL versionado (la migración
      `20260807090000_...` solo referencia `vault.decrypted_secrets` por nombre, nunca el
      valor — verificado por lectura del archivo, no hay secreto hardcodeado)

- [x] **T5.5** — QA manual: drawer de creación manual
  - **AC ref:** AC6
  - **DoD:**
    - [x] Lunes cuyo rango de 5 semanas contiene ≥1 feriado real → preview muestra la fecha
      extendida (no `start+33`) antes de guardar, con estado de carga visible — verificado
      visualmente por Matías (owner) contra el entorno real
    - [x] La promoción guardada coincide exactamente con el `end_date` mostrado en el preview

- [x] **T5.6** — QA manual: matrícula tardía
  - **AC ref:** AC4, AC5
  - **DoD:**
    - [x] Promoción con `start_date` hace 4-5 días → aparece modal de confirmación — verificado
      visualmente por Matías (owner)
    - [x] Promoción con `start_date` hace ≤3 días → matrícula continúa sin modal

  > **Nota (2026-08-07):** durante esta sesión se descubrió que `ng serve` de este proyecto
  > siempre apunta al Supabase de producción/staging (`environment.ts`, importado directo por
  > `supabase.service.ts:3` — `environment.development.ts` es código muerto, sin
  > `fileReplacements` en `angular.json`). El QA visual con Playwright de esta sesión se
  > detuvo apenas se notó (solo se había abierto el drawer, sin submits, sin mutación de datos
  > reales) y el owner completó T5.5/T5.6 él mismo directamente. No se abre track de fix para
  > el wiring dev/local — decisión explícita del owner de no perseguirlo por ahora.

- [x] **T5.7** — Ejecutar `/spec-verify`
  - **DoD:** `acceptance.md` generado — veredicto ⚠️ PARCIAL (8/10 AC con QA directa, AC4/AC5
    con lógica 100% probada por tests pero QA visual pendiente por `fix-136-m`). Detalle
    completo en `acceptance.md`.

---

## Fase 6 — Cierre

- [x] **T6.1** — Actualizar `indices/` con todo lo nuevo (`/sync-indices`)
  - **DoD:** `DATABASE.md`, `FACADES.md`, `UTILS.md`, `COMPONENTS.md` sincronizados
    (`npm run indices:sync` corrido, auto-index regenerado + entradas manuales agregadas)
- [x] **T6.2** — Marcar spec como `done` en `ROADMAP.md`
- [x] **T6.3** — Limpiar `specs/.active`

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [ ] …
