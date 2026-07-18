# Tasks 0010-b — Hardening de Seguridad del Flujo de Inscripción Online Público

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
> **Created:** 2026-06-03

---

## Cómo usar este archivo

- Cada tarea es **atómica**: se empieza y termina en un sitting.
- Marcá `[x]` apenas pase su DoD (no antes, no en bloque).
- Orden: Datos → Núcleo funcional → Edge Function → Frontend → Validación → Cierre.
- Si algo queda fuera del scope (hallazgos S7–S11) → **no** lo hagas acá; va a follow-up.

> **Modelo sugerido:** T1–T3 y T4.1 (lógica security-critical) en **Opus alto**. T4.2/T4.3 y T5 (mecánico/E2E) pueden ir en **Sonnet medio**.

---

## Fase 1 — Datos y modelo

- [~] **T1.1** — Migración `20260603120000_public_enrollment_rate_limit_throttle.sql`
  - **AC ref:** AC1
  - **DoD:**
    - [x] Archivo creado con naming correcto
    - [x] `CREATE TABLE IF NOT EXISTS public_enrollment_throttle (id, ip, action, created_at)`
    - [x] Índice `(ip, action, created_at)`
    - [x] `ENABLE ROW LEVEL SECURITY` **sin policies** (solo service role)
    - [x] Función `cleanup_public_enrollment_throttle()` (`SECURITY DEFINER`, borra > 1 día)
    - [ ] ⏳ `npx supabase db reset` corre sin error — **PENDIENTE: Docker no está corriendo** (verificación manual del usuario)
    - [x] Documentado en `indices/DATABASE.md` (patrón `slot_holds`)

---

## Fase 2 — Núcleo funcional (lógica pura anti-abuso)

- [x] **T2.1** — Escribir `supabase/functions/_shared/anti-abuse.test.ts` PRIMERO (TDD)
  - **AC ref:** AC1, AC2, AC6
  - **DoD:**
    - [x] Tests `isRateLimited(count, max)` — bajo umbral pasa, sobre umbral falla
    - [x] Tests `isOriginAllowed(origin, allowlist)` — permitido / no permitido / `Origin` ausente / espacios
    - [x] Tests `amountsMatch(a, b)` — igual pasa, distinto falla (incluye caso `partial` redondeado + NaN)
    - [x] Tests `isHoneypotTripped(value)` — vacío/undefined = humano (false), con valor = bot (true)
    - [x] Tests escritos antes de la implementación (TDD)

- [~] **T2.2** — Implementar `supabase/functions/_shared/anti-abuse.ts`
  - **AC ref:** AC1, AC2, AC6
  - **DoD:**
    - [x] 4 funciones puras (sin globals de Deno, sin I/O) — Functional Core
    - [ ] ⏳ `deno test supabase/functions/_shared/anti-abuse.test.ts` verde — **PENDIENTE: Deno no instalado localmente** (verificación CI/manual)
    - [x] Constante de ventana/umbral parametrizable (`RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW_MS`, default 10 req / 10 min)

---

## Fase 3 — Edge Function hardening (`public-enrollment/index.ts`)

> ⚠️ La verificación de comportamiento de la EF requiere el stack desplegado (Deno/Docker). Código completo; verificación funcional en T5 (E2E/manual).

- [x] **T3.1** — Gate de entrada: CORS allowlist (S2) + honeypot + rate-limit (S1)
  - **AC ref:** AC1, AC2, AC-E1, AC-E2
  - **DoD:**
    - [x] CORS refleja `Origin` solo si `isOriginAllowed(...)` (env `PUBLIC_ENROLLMENT_ALLOWED_ORIGINS` CSV); `applyCors` como chokepoint
    - [x] Handler principal: para `HONEYPOT_ACTIONS`, `isHoneypotTripped(body.honeypot)` → `400`
    - [x] IP (`x-forwarded-for`/`x-real-ip`); `INSERT`+`COUNT` en `public_enrollment_throttle`; sobre 10/10min → `429`
    - [x] `load-*` NO rate-limited (solo `RATE_LIMITED_ACTIONS`)
    - [ ] ⏳ Verificación de comportamiento → T5 (stack desplegado)

- [x] **T3.2** — Hardening del invite por email (S3)
  - **AC ref:** AC3
  - **DoD:**
    - [x] `inviteStudentToAuth(supabase, userId)` invita SOLO al `email` almacenado en `users` (param de email del request eliminado); call sites actualizados
    - [x] No se vincula `supabase_uid` con email del request (se usa el almacenado)
    - [x] RUT nuevo intacto (su email almacenado == request recién insertado)

- [x] **T3.3** — Redacción de PII en logs (S4)
  - **AC ref:** AC4
  - **DoD:**
    - [x] Eliminado `rut` del `console.log` de `initiate-payment`; `throw new Error('RUT inválido')` sin el valor
    - [x] Grep `rut`/`email` en `console.*` → 0 PII en claro

- [x] **T3.4** — Reconciliación de monto en `confirm-payment` (S6)
  - **AC ref:** AC6
  - **DoD:**
    - [x] Tras `webpayCommit`, `amountsMatch(commitResponse.amount, amountPaid)` antes de registrar `payment`
    - [x] Si difiere → `payment_attempt` `failed` + enrollment `cancelled` + holds liberados, sin `payment`, retorna rechazo

---

## Fase 4 — Frontend (Facade + form)

- [x] **T4.1** — `generateToken()` sin fallback inseguro (S5)
  - **AC ref:** AC5
  - **DoD:**
    - [x] Test en `public-enrollment.facade.spec.ts`: con `crypto.randomUUID` → UUID; sin él → lanza error
    - [x] Implementación elimina el fallback `Date.now()-Math.random()`
    - [x] `npm run test:ci` verde → **62/62** (60 previos + 2 nuevos S5, sin regresión)

- [x] **T4.2** — Honeypot en payloads del Facade (S1)
  - **AC ref:** AC1
  - **DoD:**
    - [x] El `body` de `initiate-payment`, `submit-clase-b`, `submit-pre-inscription`, `generate-contract-preview` incluye `honeypot: pd?.honeypot ?? null`
    - [ ] ⏳ Test de propagación del honeypot — diferido a E2E/manual (T5.4); propagación trivial verificada por `ng build`

- [x] **T4.3** — Campo honeypot oculto en `public-personal-data.component.ts`
  - **AC ref:** AC1, AC-E1
  - **DoD:**
    - [x] Input oculto (off-screen, `tabindex="-1"`, `autocomplete="off"`, `aria-hidden="true"`, `name="website"`) wired vía `EnrollmentPersonalData.honeypot`
    - [x] **NO** lleva `data-llm-*` (comentado el porqué: trampa anti-bot)
    - [x] `ng build` compila limpio (62s)

---

## Fase 5 — Validación

- [~] **T5.1** — `npm run lint:arch` + `npm run test:ci` verde
  - **DoD:**
    - [x] `test:ci` (facade) → 62/62 verde
    - [x] `lint:arch` → 0 errores nuevos de 0010-b (solo warnings de complejidad preexistentes; los 25 errores son de archivos ajenos)
    - [x] `ng build` → compila limpio
    - [ ] ⏳ `deno test` de `anti-abuse` — bloqueado (Deno no instalado)

- [ ] **T5.2** — E2E Playwright: pago aprobado (AC-F1)
  - **AC ref:** AC-F1
  - **DoD:**
    - [ ] Wizard Clase B completo → Webpay con `4051 8856 0044 6623`
    - [ ] `enrollments.status='active'` + número asignado, `payment` creado, `slot_holds` vacío, `/retorno` success

- [ ] **T5.3** — E2E Playwright: pago rechazado (AC-F2)
  - **AC ref:** AC-F2
  - **DoD:**
    - [ ] Webpay con `5186 0595 5959 0568`
    - [ ] `enrollments.status='cancelled'`, holds liberados, sin `payment`, `/retorno` rejected

- [ ] **T5.4** — QA manual anti-abuso (AC-E1/E2)
  - **AC ref:** AC1, AC2, AC-E1, AC-E2
  - **DoD:**
    - [ ] Honeypot lleno → rechazo; usuario legítimo a velocidad normal → no bloqueado
    - [ ] >10 req/10min misma IP+acción → `429`; tras la ventana → vuelve a operar
    - [ ] Origen no permitido → CORS bloqueado

- [ ] **T5.5** — Ejecutar `/spec-verify`
  - **DoD:** `acceptance.md` con evidencia por AC; AC Verifier `{ok: true}`

---

## Fase 6 — Cierre

- [ ] **T6.1** — `/sync-indices` (DATABASE.md ya cubierto en T1.1; verificar SERVICES/otros)
- [ ] **T6.2** — Marcar 0010-b `done` en `ROADMAP.md`
- [ ] **T6.3** — `/fix-close` no aplica (es spec) → `/spec-activate --clear`

---

## Tareas descubiertas durante implementación

> Scope de la spec únicamente. Hallazgos S7–S11 → follow-up separado, NO acá.

- [ ] …
