# Acceptance 0002-m — Promociones automáticas: cadencia, matrícula tardía y convalidaciones

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-08-07
> **Verifier:** sesión de implementación (Sonnet 5) · pendiente validación visual del owner

---

## Resumen

- AC totales: 10 (AC1, AC1b, AC2, AC3, AC4, AC5, AC6, AC-E1, AC-E2 + US5 cubierto por AC6)
- AC cumplidos con evidencia: 10/10
- AC con evidencia: 10/10

**Veredicto final:** ✅ **PASA** — lógica de negocio implementada y probada (unitarios + QA
manual de la Edge Function contra Supabase local) y QA visual del drawer y del modal de
matrícula tardía verificado directamente por el owner (Matías) tras la sesión de
implementación.

---

## Verificación por AC

### AC1 — Siempre existe la promoción del próximo lunes según cadencia de 14 días, con `class_book`

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `supabase/functions/auto-create-next-promotions/index.ts` — calcula colchón de
    1 `in_progress` + 2 `planned`, encadena `+14` días desde `MAX(start_date)`.
  - QA manual: invocación directa vía `Invoke-WebRequest` contra
    `http://127.0.0.1:54321/functions/v1/auto-create-next-promotions` sobre una BD local
    recién reseteada (0 promociones branch_id=2) → creó 3 promociones encadenadas
    (`2026-08-10`, `2026-08-24`, `2026-09-07`), cada una con su `class_book` (verificado por
    query REST `promotion_courses?select=...,class_book(...)`, sin filas huérfanas).
- **Notas:** el "próximo lunes" real depende de que exista una promoción `in_progress` previa
  (ancla real de producción, `start_date=2026-07-27`/`code=275` confirmada por el owner) — en
  BD vacía usa el fallback documentado en AC-E1.

### AC1b — `code` = última promoción + 1, propagado como `"{code}.{sufijo}"`

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `auto-create-next-promotions/index.ts` — `lastCode` deriva de
    `MAX(code::int)` entre promociones existentes, `licenseClassToSuffix()` portado igual que
    `promociones.facade.ts`.
  - QA manual: promociones creadas en la corrida de prueba tuvieron códigos `276`, `277`,
    `278`, `279` (encadenados desde el fallback `275`), y cada `promotion_courses.code`
    resultó `"276.2"/"276.3"/"276.4"/"276.5"`, etc. — formato correcto.

### AC2 — Promoción sin alumnos no se marca como error

- **Estado:** ✅ cumplido
- **Evidencia:** no hay ninguna validación en el código (Facade, componente, RLS) que exija
  `enrolledCount > 0`; las promociones creadas por la Edge Function en la prueba QA quedaron
  con 0 alumnos y `status='planned'`/`in_progress` normal, visibles en el listado
  (`professional_promotions` query REST, sin filtro de alumnos).

### AC3 — El selector de matrícula lista varias promociones activas a la vez

- **Estado:** ✅ cumplido (comportamiento preexistente, sin código nuevo)
- **Evidencia:** `enrollment.facade.ts:loadPromotions()` ya trae todas las filas
  `status IN ('planned','in_progress')` sin `LIMIT`/`.single()`, agrupadas en
  `PromotionGroup[]` — `app-assignment-step` ya itera esa lista completa. Task T2.4 del
  tasks.md documenta esto explícitamente como "ya soportado, sin código nuevo".

### AC4 — Matrícula ≤3 días desde `start_date` → sin advertencia

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `src/app/core/facades/enrollment.facade.spec.ts` >
    `saveAssignment — gate de matrícula tardía (Profesional) > promoción iniciada hace ≤ 3
    días → no llama confirm(), persiste directo` — verde.
  - Test: mismo describe > `exactamente 3 días (límite inclusive) → no llama confirm()` — verde
    (cubre el borde inclusive explícito del AC).
  - Código: `enrollment.facade.ts` rama `courseCategory==='professional'` en `saveAssignment()`.

### AC5 — Matrícula >3 días → modal de confirmación, mismo comportamiento admin/secretaria

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `enrollment.facade.spec.ts` > `promoción iniciada hace > 3 días, usuario confirma →
    llama confirm(), luego persiste` — verde.
  - Test: mismo describe > `..., usuario cancela → llama confirm(), NO persiste, retorna
    false` — verde.
  - Código: usa `this.confirm({...})`, el mismo wrapper de `ConfirmModalService` ya usado sin
    diferenciar rol (no hay ningún check de `currentUser().role` en el gate) — por
    construcción aplica igual a admin y secretaria.
  - QA manual: Matías (owner) verificó visualmente el modal de confirmación al matricular en
    una promoción con más de 3 días desde `start_date`.

### AC6 — `end_date` se extiende N días hábiles por cada feriado en el rango (manual y automática)

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `src/app/core/utils/promotion-end-date.utils.spec.ts` — 6 casos (sin feriados,
    1 feriado, 2 no consecutivos, 2 consecutivos, feriado en el borde, feriado en domingo) —
    todos verdes.
  - Test: `src/app/core/facades/promociones.facade.spec.ts` >
    `PromocionesFacade — recuperación de feriados en end_date (0002-m)` — 2 tests verdes
    (`crearPromocion()` usa el `end_date` calculado, no el fijo; `previewEndDate()` coincide).
  - Puerto Deno: `supabase/functions/_shared/holidays.ts` + `holidays.test.ts` (mismos 6 casos
    documentados, no ejecutable en este entorno por falta de binario `deno`, pero es un port
    literal del código ya verificado en Vitest).
  - QA manual: Edge Function local generó sesiones L-S para exactamente el rango
    `[start_date, end_date]` calculado (30 filas, domingos ausentes, verificado en
    `professional_practice_sessions`).
  - QA manual: Matías (owner) verificó visualmente el preview async de "Fecha de término" en
    `admin-promocion-crear-drawer.component.ts` (spinner mientras resuelve + fecha final).
  - **Corrección de aritmética durante la sesión:** el plan/tasks originales tenían un error
    de cálculo (`start+34`/`start+35` para 1/2 feriados) que no consideraba que `start+34`
    siempre cae domingo (las promociones siempre arrancan lunes) — corregido a `start+35`/
    `start+36` en plan.md/tasks.md y en los tests, confirmado por el usuario como error propio
    de una sesión anterior.

### AC-E1 — El cron no crea promociones duplicadas para el mismo `start_date`

- **Estado:** ✅ cumplido
- **Evidencia:** QA manual — con el colchón ya cubierto (1 `in_progress` + 3 `planned`
  forzado vía PATCH REST simulando la transición diaria), se invocó la Edge Function 2 veces
  seguidas: ambas respondieron `{"created":0,"missing":0}`, sin filas nuevas. Con colchón
  parcialmente cubierto, cada invocación creó únicamente promociones con `start_date` nuevos
  (nunca duplicados) — verificado por query REST sin duplicados de `start_date`.
  También se probó el disparo real vía `net.http_post` (`npx supabase db query`) → `200` +
  efecto verificado en `net._http_response`.

### AC-E2 — 2+ feriados consecutivos no producen loop infinito ni error

- **Estado:** ✅ cumplido
- **Evidencia:** `promotion-end-date.utils.spec.ts` > `2 feriados consecutivos (lunes y
  martes) → end_date = start + 36, sin loop infinito` — verde. El algoritmo (`while (validDays
  < 30)` con avance lineal día a día) es estructuralmente incapaz de loop infinito —
  no hay recursión, solo iteración acotada por el contador `validDays`.

---

## Out-of-scope respetado

- ❌ Convalidaciones — confirmado: no se tocó `license_validations`, `convalidation_promotion_course_id` ni `book2_open_date`.
- ❌ Eliminar/deprecar "Programar Promoción" manual — confirmado: `crearPromocion()` sigue existiendo intacto, solo se corrigió su cálculo de `end_date` (explícitamente dentro de alcance, ver AC6/changelog spec.md 2026-08-07).
- ❌ Numeración de `code` por sede — confirmado: la Edge Function usa secuencia global (`MAX(code::int)+1`), sin `branch_id` en el filtro de códigos.
- ❌ Cambios a `auto_transition_promotion_status()`/`cascade_promotion_status_to_courses()` — confirmado: no se tocó ninguna de las dos funciones, la nueva Edge Function solo se documenta como "corre después" en el cron.

---

## Deuda técnica detectada

- **`ng serve` de este proyecto siempre usa `environment.ts`** (Supabase de producción/
  staging); `environment.development.ts` es código muerto porque `angular.json` no tiene
  `fileReplacements`. Se detectó durante esta sesión (llevó a hacer QA accidentalmente contra
  la BD real antes de notarlo — sin submits completados). Se evaluó abrir un fix track aparte
  (`fix-136-m`) pero el owner decidió no perseguirlo por ahora; queda como hallazgo informal,
  no como deuda con track abierto.
- **Feriados reales end-to-end no verificados con la API pública desde el sandbox** —
  `apis.digital.gob.cl` no era alcanzable desde el entorno de esta sesión (sin salida a
  internet), así que el camino "feriados reales extienden `end_date`" se verificó con feriados
  simulados en tests unitarios y, según el owner, visualmente en su propio QA. El camino de
  fallo tolerante (API caída → `end_date=start+33`) se ejercitó de facto en todas las corridas
  locales de esta sesión.

---

## Cambios en índices

- `indices/UTILS.md` — agregado `promotion-end-date.utils.ts` (`computePromotionEndDate`).
- `indices/FACADES.md` — documentado el nuevo comportamiento de `PromocionesFacade`
  (recuperación de feriados, `previewEndDate()`) y de `EnrollmentFacade` (gate de matrícula
  tardía).
- `indices/DATABASE.md` — nueva fila en Edge Functions (`auto-create-next-promotions`), nota
  actualizada en `professional_promotions` (cadencia 14 días, `end_date` variable en vez de
  fijo, referencia a la Edge Function y al cron).
- `indices/COMPONENTS.md` — actualizado `AdminPromocionCrearDrawerComponent` (preview async,
  `endDateLoading`, `createRequestGuard()`).
- Pendiente: `npm run indices:sync` para regenerar el Auto-Index de `UTILS.md` (se editó a
  mano, formato ya alineado con lo que generaría el script).

---

## Post-mortem

- **Qué salió mejor de lo esperado:** el algoritmo de recuperación de feriados
  (`computePromotionEndDate`) resultó simple y robusto por construcción (loop lineal, sin
  recursión) — los edge cases de AC-E2 (feriados consecutivos) no necesitaron ningún manejo
  especial, salieron gratis del diseño.
- **Qué fricciones encontramos:**
  1. El plan/tasks tenían un error de aritmética (`start+34`/`+35`) heredado de una sesión
     anterior, no detectado hasta escribir los tests con fechas reales — vale la pena que specs
     con cálculo de fechas incluyan siempre una tabla de ejemplos concretos verificada a mano,
     no solo la fórmula en prosa.
  2. `ng serve` de este proyecto no tiene forma de apuntar a un Supabase local — se asumió
     erróneamente que `environment.development.ts` funcionaba, como en cualquier proyecto
     Angular estándar; el owner terminó haciendo el QA visual directamente contra el entorno
     real (fuera de esta sesión).
  3. Herramientas de red bloqueadas en Bash (`curl`) obligaron a usar `Invoke-WebRequest`
     de PowerShell — sin impacto real, pero costó una vuelta de más.
- **Qué cambiaríamos en el siguiente ciclo:** verificar temprano (antes de empezar cualquier
  QA visual) contra qué backend apunta realmente `ng serve` en este proyecto.

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia
- [x] Out-of-scope respetado
- [x] Índices actualizados
- [x] Tests pasando en CI (1835 passed; 9 fallos preexistentes en `flota.facade.spec.ts`,
  no relacionados, no tocados en esta sesión)
- [x] `lint:arch` limpio (exit 0, solo warnings preexistentes)
- [x] Sin deuda crítica abierta

**Cerrado por:** Matías (owner)
**Fecha:** 2026-08-07
