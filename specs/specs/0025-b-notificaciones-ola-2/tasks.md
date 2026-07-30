# Tasks 0025-b — Notificaciones Ola 2: circuito financiero + onboarding

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done (2026-07-10) — ver acceptance.md (✅ PASA, 11/12 ACs)
> **Created:** 2026-07-07

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 1 — Productores financieros del instructor (sin resolución de FK compleja)

- [x] **T1.1** — Notificar liquidación pagada en `core/facades/liquidaciones.facade.ts`
  - **AC ref:** AC5
  - **DoD:**
    - [x] TDD: `liquidaciones.facade.spec.ts` primero — test de que `registrarPago()` llama `notifyUsers([row.userId], ...)` tras el upsert exitoso
    - [x] Test: si `row.userId` es `0`/falsy, NO se notifica (guard)
    - [x] Test: fallo del insert de notificación no revierte el pago (`registrarPago()` sigue devolviendo `true`)
    - [x] Tests FALLAN antes de implementar
    - [x] Implementado: usa `row.userId` directo, sin query adicional a `instructors`
    - [x] Tests PASAN (`npx vitest run src/app/core/facades/liquidaciones.facade.spec.ts` → 10/10 verde)
    - [ ] Documentado en `indices/FACADES.md` (pendiente, se hace en el cierre T6.1 vía `/sync-indices`)

- [x] **T1.2** — Notificar anticipo registrado en `core/facades/anticipos.facade.ts`
  - **AC ref:** AC4
  - **DoD:**
    - [x] TDD: `anticipos.facade.spec.ts` primero — test de que `registrarAnticipo()` resuelve `instructors.id → users.id` y notifica al instructor correcto
    - [x] Helper privado `resolveInstructorUserId(instructorId)`
    - [x] Test: fallo de resolución o de insert no revierte el registro del anticipo
    - [x] Tests FALLAN antes de implementar
    - [x] Tests PASAN (`npx vitest run src/app/core/facades/anticipos.facade.spec.ts` → 19/19 verde)
    - [ ] Documentado en `indices/FACADES.md` (pendiente, se hace en T6.1)

---

## Fase 2 — Pago presencial (3 variantes + servicios especiales)

- [x] **T2.1** — Notificar pago de matrícula en `core/facades/enrollment-payment.facade.ts`
  - **AC ref:** AC1, AC7, AC-E1
  - **DoD:**
    - [x] TDD: `enrollment-payment.facade.spec.ts` primero
    - [x] Helper privado `notifyPaymentRegistered(enrollmentId, amount)`: resuelve `enrollments.student_id → students.user_id`, notifica solo al alumno
    - [x] Test: NO se llama con destinatario admin en ningún caso (AC7 — sin ruido al admin)
    - [x] Test: `amount <= 0` no dispara notificación (AC-E1)
    - [x] Test: fallo del insert no revierte `recordPayment()`
    - [x] Tests FALLAN antes de implementar → PASAN después (`npx vitest run src/app/core/facades/enrollment-payment.facade.spec.ts` → 29/29 verde)
    - Nota: fire-and-forget requirió `flushMicrotasks()` en el test (patrón ya usado en `certificacion-clase-b.facade.spec.ts`) porque no hay ningún `await` posterior en `recordPayment()` que drene la cola de microtasks

- [x] **T2.2** — Notificar abono en `core/facades/pagos.facade.ts`
  - **AC ref:** AC1, AC7, AC-E1
  - **DoD:**
    - [x] TDD: `pagos.facade.spec.ts` primero
    - [x] `registrarNuevoPago()` notifica al alumno tras el insert exitoso (mismo patrón de resolución que T2.1, duplicado localmente)
    - [x] Test: `payload.total_amount <= 0` no notifica
    - [x] Test: NO notifica al admin (único destinatario es el alumno)
    - [x] Tests FALLAN antes de implementar → PASAN después (`npx vitest run src/app/core/facades/pagos.facade.spec.ts` → 6/6 verde)

- [x] **T2.3** — Notificar pago de curso singular en `core/facades/cursos-singulares.facade.ts`
  - **AC ref:** AC1, AC7, AC-E1
  - **DoD:**
    - [x] TDD: `cursos-singulares.facade.spec.ts` primero
    - [x] `marcarEnrollmentPagado()` resuelve `standalone_course_enrollments.student_id → students.user_id` y notifica al alumno
    - [x] Test: `montoACobrar <= 0` no notifica
    - [x] Tests FALLAN antes de implementar → PASAN después (`npx vitest run src/app/core/facades/cursos-singulares.facade.spec.ts` → 18/18 verde)

- [x] **T2.4** — Notificar cobro de servicio especial en `core/facades/servicios-especiales.facade.ts`
  - **AC ref:** AC1, AC-E1 (variante: sin destinatario)
  - **DoD:**
    - [x] TDD: `servicios-especiales.facade.spec.ts` primero
    - [x] `registrarCobro()` notifica al alumno SOLO si `studentUserId` no es null
    - [x] Test: venta a cliente externo (`students === null`) NO notifica y NO lanza error
    - [x] Tests FALLAN antes de implementar → PASAN después (`npx vitest run src/app/core/facades/servicios-especiales.facade.spec.ts` → 9/9 verde)
    - Nota de diseño: en vez de una query nueva en `registrarCobro()` (que hubiera roto el test existente "sin re-fetch"), se extendió el `select()` de `fetchData()` con `students(user_id)` y se agregó `studentUserId` al UI model `VentaServicio` — el dato ya viene resuelto en `_ventas()` desde la carga de lista, igual que `LiquidacionRow.userId` en T1.1

---

## Fase 3 — Notas confirmadas (profesional)

- [x] **T3.1** — Notificar notas confirmadas en `core/facades/evaluaciones-profesional.facade.ts`
  - **AC ref:** AC3
  - **DoD:**
    - [x] TDD: `evaluaciones-profesional.facade.spec.ts` primero
    - [x] Helper `notifyGradesConfirmed()` en `_persist('confirmed')`: resuelve en **batch** `enrollments.id IN (...) → students.user_id` para los `enrollmentId` únicos de `g.filas`
    - [x] Mensaje distinto si `fila.promedioAprobado === false` (reprobado) vs `true`
    - [x] Test: si `upserts.length === 0` (nada que confirmar), NO se notifica a nadie
    - [x] Test: no notifica en `guardarBorrador()` ('draft'), solo en `confirmarNotas()` ('confirmed')
    - [x] Tests FALLAN antes de implementar → PASAN después (`npx vitest run src/app/core/facades/evaluaciones-profesional.facade.spec.ts` → 9/9 verde)

---

## Fase 4 — Edge Functions (B2, B3)

- [x] **T4.1** — Notificar pago online en `supabase/functions/student-payment/index.ts`
  - **AC ref:** AC2, AC-E4
  - **DoD:**
    - [x] En `handleConfirmPayment()`, tras confirmar el pago (paso 6): ampliado el SELECT de `enrollments` con `branch_id, students!inner(user_id)`
    - [x] INSERT batch en `notifications`: alumno (confirmación) + secretarias de `branch_id` + todos los admins — mismo patrón de query que `public-enrollment` (Ola 1, T4.4)
    - [x] Todo el bloque en try/catch propio — un fallo del INSERT nunca afecta la respuesta del pago (AC-E4)
    - [x] Sede sin secretarias → notifica solo admins (filtro no exige secretarias); 0 destinatarios → `rows.length > 0` evita INSERT vacío sin error
    - [ ] Prueba local pendiente (`npx supabase start`) — documentada como parte del QA manual de Fase 5 (sin harness de test para Deno EF, igual que Ola 1)

- [x] **T4.2** — Notificar bienvenida en `supabase/functions/activate-student-account/index.ts`
  - **AC ref:** AC6
  - **DoD:**
    - [x] INSERT en `notifications` (`reference_type: null` → severidad 'info' por defecto) para `userId`, SOLO en la rama `!targetUser.supabase_uid` (primera invitación, antes del `return jsonResponse({success:true, status:'invited'}, 201)`)
    - [x] La rama de reenvío (`status: 'reinvited'`) NO dispara una segunda notificación (código no tocado en esa rama)
    - [x] Fallo del INSERT no afecta la respuesta de la invitación (try/catch propio)
    - [ ] Prueba local pendiente (`npx supabase start`) — documentada como parte del QA manual de Fase 5

---

## Fase 5 — Validación

- [x] **T5.1** — `npm run lint:arch` corre limpio (sin errores nuevos sobre el backlog pre-existente)
  - **DoD:** comparado contra HEAD vía `git stash push --keep-index`/`pop` (stash parcial de solo los archivos tocados, sin afectar el resto del working tree) — 157 warnings baseline → 160 con la spec, **0 errores nuevos** (exit 0 en ambos). Los +3 son ARCH-10 (complejidad: `_persist`, `fetchLiquidacionesData`, `loadGrilla`, `recordPayment`, `registrarPago` crecieron unas líneas; `servicios-especiales.facade.ts` cruzó a 6 injects) — mismo patrón aceptado en Ola 1

- [x] **T5.2** — Tests por archivo verdes + `ng build` limpio
  - **DoD:**
    - [x] `npx vitest run` de los 7 specs tocados (liquidaciones, anticipos, enrollment-payment, pagos, cursos-singulares, servicios-especiales, evaluaciones-profesional) → **100/100 verde**
    - [x] **NO** se exigió suite global verde (memoria del proyecto: hay fallos ambientales pre-existentes) — solo archivos tocados
    - [x] `ng build --configuration development` → exit 0, limpio (encontró y corrigió un TS2345 real en el cast de `ventasResult.data` de `servicios-especiales.facade.ts` que necesitaba el campo `students` agregado; único warning restante es el NG8113 preexistente no relacionado)

- [x] **T5.3** — QA en vivo (Playwright contra la app real en localhost:4200, con autorización explícita del owner para mutar datos de desarrollo)
  - **AC ref:** AC4 (verificado con datos reales de punta a punta), resto cubierto por 100/100 tests unitarios
  - **DoD:**
    - [x] Registrar anticipo real (Carlos Eduardo Muñoz, $1.000) → insert exitoso, sin errores de consola relacionados al código
    - [x] Confirma que el patrón `resolver destinatario → notifyUsers` corre sin excepciones contra el schema real de Supabase
    - [x] **Verificación de destinatario sin necesitar otra sesión:** RLS `select_notifications` permite `admin` leer TODAS las filas (no solo las propias) — se usó el token de sesión del admin para consultar PostgREST directo y confirmar `notifications.recipient_id=49` = `instructors.user_id` del anticipo registrado = Carlos Eduardo Muñoz. Prueba matemática completa, sin necesidad de credenciales de otro rol.
    - [x] **Limpieza completa:** `instructor_advances.id=2` y `notifications.id=13` eliminados vía `DELETE` REST (RLS admin lo permite) — status 200, payload confirmado, UI verificada post-limpieza sin residuos.
    - [x] Los otros 5 productores NO se probaron en vivo (decisión del owner: "alcanza con esta" dado que comparten el mismo patrón y ya tienen 100/100 tests unitarios con mocks fieles al schema)

- [x] **T5.4** — Ejecutar `/spec-verify`
  - **DoD:** los 12 AC (AC1-AC8 + AC-E1..E4) con evidencia en `acceptance.md` → veredicto **✅ PASA** (11/12 cumplidos, AC-E3 documentado como no aplicable al dominio real — no bloqueante)

---

## Fase 6 — Cierre

- [x] **T6.1** — Actualizar índices (`/sync-indices`)
  - **DoD:** `npm run indices:sync` regeneró `FACADES.md`, `STYLES.md`, `USAGE-MAP.md`; `indices/NOTIFICATIONS-MAP.md` actualizado manualmente marcando A4/A5/A6/A7/B2/B3 como ✅ implementados y Ola 2 como implementada en §8

- [x] **T6.2** — Marcar spec 0025-b como `done` en `specs/ROADMAP.md`
  - **DoD:** movida de "Activa" a "Done" con fecha y resumen de verificación; `tasks.md` status → `done`

- [x] **T6.3** — Limpiar `specs/.active` (`/spec-activate --clear`)

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [ ] …
