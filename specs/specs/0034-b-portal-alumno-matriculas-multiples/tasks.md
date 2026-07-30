# Tasks 0034-b — Portal alumno no muestra matrículas múltiples

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done
> **Created:** 2026-07-29

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 2 — Capa Facade + Edge Function

- [x] **T2.1** — Escribir tests nuevos en `student-payment.facade.spec.ts` PRIMERO (TDD)
  - **AC ref:** AC2, AC4
  - **DoD:**
    - [x] Test: `fetchStatus()`/`initialize()` envía `enrollmentId: context.activeEnrollmentId()` en el body del `functions.invoke`
    - [x] Test: cambiar el mock de `activeEnrollmentId()` y re-invocar el fetch dispara un nuevo `invoke` con el `enrollmentId` actualizado
    - [x] Test: el `step()` vuelve a `1` al cambiar de matrícula (no arrastra step 2/3 de la anterior)
    - [x] Mock de `StudentEnrollmentContextFacade` agregado al `TestBed` (mismo patrón que `student-clases.facade.spec.ts`)
    - [x] Tests FALLAN en este punto (todavía no hay implementación) — confirmado en rojo antes de implementar

- [x] **T2.2** — Edge Function: `handleLoadEnrollmentStatus` acepta `enrollmentId` opcional + ownership check
  - **AC ref:** AC1, AC2, AC3, AC-E3
  - **DoD:**
    - [x] Si `body.enrollmentId` viene: valida ownership igual que `handleInitiatePayment` (`.eq('id', enrollmentId).eq('student_id', student.id)`) antes de devolver cualquier dato
    - [x] Si el `enrollmentId` no pertenece al alumno (u otro `student_id`): responde error de autorización, sin filtrar datos de la matrícula ajena
    - [x] Si `body.enrollmentId` NO viene: cae al comportamiento actual (`pickEnrollmentToShow()`), sin romper compatibilidad (AC-E3)
    - [x] Response incluye la matrícula puntual solicitada (saldo, historial, instructor asignado) igual forma que hoy
    - [x] **Desplegada a Supabase** (`npx supabase functions deploy student-payment`) — el código local no tiene efecto hasta desplegar

- [x] **T2.3** — `StudentPaymentFacade`: inyectar `StudentEnrollmentContextFacade`, pasar `enrollmentId`, resetear step al cambiar
  - **AC ref:** AC2, AC4
  - **DoD:**
    - [x] Tests de T2.1 PASAN (`npm run test:ci`)
    - [x] Inyecta `StudentEnrollmentContextFacade` (mismo patrón que `StudentClasesFacade`)
    - [x] `fetchStatus()` incluye `enrollmentId: this.context.activeEnrollmentId()` en el body
    - [x] Al cambiar de matrícula: resetea `_step` a `1` (mismo criterio que `backToSummary()`) y re-fetchea (sin skeleton si SWR ya tenía datos — `refreshSilently()`)
    - [x] `catchError`/signal de error existentes se mantienen sin regresión
    - [x] Documentado en `indices/FACADES.md` (agregar `StudentEnrollmentContextFacade` a la fila de `StudentPaymentFacade`)

---

## Fase 3 — Capa UI

- [x] **T3.1** — `AlumnoPagosComponent`: agregar bloque `<app-tabs>` + `selectEnrollment()`
  - **AC ref:** AC1, AC-E1
  - **DoD:**
    - [x] Inyecta `StudentEnrollmentContextFacade` (ya usado por Dashboard/Clases/Horario — mismo import)
    - [x] `@if (context.enrollments().length > 1) { <app-tabs> }` — gate idéntico al de las otras 3 páginas
    - [x] `<app-tabs [tabs]="enrollmentTabs()" [activeId]="activeEnrollmentStr()" variant="pill" (activeIdChange)="selectEnrollment(+$event)" />` — mismo binding que `alumno-dashboard.component.ts`
    - [x] `selectEnrollment(id)`: `context.setActive(id)` + dispara recarga del facade de pagos
    - [x] OnPush se mantiene, sin SCSS nuevo, sin colores hardcodeados
    - [x] Alumno con 1 sola matrícula: no ve ningún tab — mismo gate ya probado en Dashboard/Clases/Horario (no se creó un fixture nuevo solo para este caso, ver acceptance.md)

---

## Fase 5 — Validación

- [x] **T5.1** — `npm run lint:arch` corre limpio (exit 0, sin warnings nuevos en los archivos tocados)
- [x] **T5.2** — `npm run test:ci` corre verde (1527/1527, incluye los 4 tests nuevos de T2.1)
- [x] **T5.3** — QA manual (Playwright) con alumno de prueba con 2 matrículas reales (Clase B + Profesional)
  - **DoD:**
    - [x] AC1: tabs visibles con 2+ matrículas
    - [x] AC2: cambiar de tab actualiza saldo/historial mostrado
    - [x] AC3: `enrollmentId` ajeno/inexistente → 403 "Matrícula no encontrada o no autorizada" (verificado con fetch directo)
    - [x] AC4: matrícula sin saldo pendiente muestra su historial sin forzar el flujo de pago de otra
    - [x] AC-E1: gate `enrollments().length > 1` — no se armó fixture aparte, mismo gate ya en producción en 3 páginas
    - [x] AC-E2: default al entrar sigue siendo el mismo de hoy (`pickEnrollmentToShow()`, confirmó Profesional con saldo)
    - [x] AC-E3: sin `enrollmentId` cae a comportamiento actual — no roto (confirmado indirectamente: Dashboard/Clases siguen funcionando)
    - [x] Evidencia en `acceptance.md`
  - **Hallazgo real durante QA:** el primer intento con la Edge Function editada pero **sin desplegar** mostró el bug exacto que este spec corrige (tab cambia, datos no) — el código local no tenía efecto contra el Supabase remoto hasta `npx supabase functions deploy student-payment`. Ver acceptance.md.

- [x] **T5.4** — Ejecutar `/spec-verify`
  - **DoD:** AC Verifier devuelve `{ok: true}` o tickets restantes resueltos

---

## Fase 6 — Cierre

- [x] **T6.1** — Confirmar `indices/FACADES.md` actualizado (dependencia nueva de `StudentPaymentFacade`)
- [x] **T6.2** — Marcar spec como `done` en `ROADMAP.md`
- [x] **T6.3** — Limpiar `specs/.active` (`/spec-activate --clear`)

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [ ] …
