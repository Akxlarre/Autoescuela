# Plan 0010-b — Hardening de Seguridad del Flujo de Inscripción Online Público

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-06-03

---

## 1. Resumen ejecutivo

Endurecer la Edge Function pública `public-enrollment` y su frontend contra abuso, fuga de PII y fraude de identidad, sin agregar dependencias externas. Orden grueso: (1) migración de la tabla de throttle, (2) helpers puros de anti-abuso testables, (3) cambios en la Edge Function (gate rate-limit+honeypot, CORS allowlist, invite hardening, redacción de PII, reconciliación de monto), (4) frontend (honeypot + token sin fallback débil), (5) verificación E2E con Playwright + tarjetas Transbank.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `supabase/migrations/20260603120000_public_enrollment_rate_limit_throttle.sql` | Migration | Tabla `public_enrollment_throttle` + índice + función de limpieza. RLS on sin policy. (S1) |
| `supabase/functions/_shared/anti-abuse.ts` | Deno shared (lógica pura) | Funciones puras testables: `isRateLimited()`, `isOriginAllowed()`, `amountsMatch()`, `isHoneypotTripped()`. (S1/S2/S6) |
| `supabase/functions/_shared/anti-abuse.test.ts` | Deno test | Tests de las funciones puras (runtime Deno nativo, cero deps). |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `supabase/functions/public-enrollment/index.ts` | (a) Gate honeypot + rate-limit por IP en el handler principal antes del dispatch de acciones de mutación; (b) CORS allowlist — orígenes desde **env var `PUBLIC_ENROLLMENT_ALLOWED_ORIGINS`** (CSV) en `corsHeaders`/respuestas; (c) `inviteStudentToAuth` usa email almacenado para RUT existente; (d) redactar PII de todos los `console.*`; (e) `confirm-payment` compara `commitResponse.amount` vs esperado | S1, S2, S3, S4, S6 |
| `src/app/core/facades/public-enrollment.facade.ts` | (a) `generateToken()` sin fallback inseguro (lanza error si no hay `crypto.randomUUID`); (b) inyectar campo `honeypot` en el `body` de `initiate-payment`/`submit-clase-b`/`submit-pre-inscription`/`generate-contract-preview` | S5, S1 |
| `src/app/shared/components/public-enrollment-steps/public-personal-data/public-personal-data.component.ts` | Campo honeypot oculto (input no visible, `tabindex=-1`, `autocomplete=off`, `aria-hidden`) cuyo valor se propaga al facade | S1 |
| `src/app/core/facades/public-enrollment.facade.spec.ts` | Tests para `generateToken` sin fallback + propagación de honeypot | testing-tdd |
| `indices/DATABASE.md` | Documentar `public_enrollment_throttle` | regla DATABASE |

### Archivos a ELIMINAR
| Path | Motivo |
|------|--------|
| — | — |

---

## 3. Reutilización (Discovery)

### Patrones/infra existentes que reutilizamos
- **Edge Function `public-enrollment`** — ya centraliza todo el flujo; extendemos su handler principal, no creamos función nueva.
- **Patrón de tabla `slot_holds`/`payment_attempts`** (`20260317100000`) — `public_enrollment_throttle` copia el patrón: `RLS ENABLE` sin policies (solo service role la escribe vía EF) + función `cleanup_*` invocable por pg_cron.
- **`cleanup_expired_public_enrollment()`** — extender o crear gemela para limpiar filas viejas de throttle.
- **Helper `findOrCreateUser`** ya valida RUT/email server-side — el hardening de invite (S3) se inserta en `inviteStudentToAuth`, que ya existe.
- **`buildStructuredPdf` / `_shared/contract-pdf.ts`** — patrón de módulo `_shared` existente; `anti-abuse.ts` sigue la misma convención de carpeta.

### Lo que NO existe y debemos crear (justificado)
- **Tabla de throttle** — no hay rate-limiting hoy; es la capacidad nueva central de S1.
- **`_shared/anti-abuse.ts`** — no hay lógica de anti-abuso reutilizable; se extrae como funciones puras (Functional Core) para poder testearlas sin levantar la EF completa.
- **Campo honeypot** — no existe; debe ser un input real del form para que un bot lo llene.

---

## 4. Modelo de datos

### Migración requerida

```sql
-- supabase/migrations/20260603120000_public_enrollment_rate_limit_throttle.sql
CREATE TABLE IF NOT EXISTS public.public_enrollment_throttle (
  id         bigserial   PRIMARY KEY,
  ip         text        NOT NULL,
  action     text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Conteo por (ip, action) dentro de la ventana deslizante
CREATE INDEX IF NOT EXISTS idx_pe_throttle_lookup
  ON public.public_enrollment_throttle (ip, action, created_at);

-- RLS on sin policies → solo service role (la Edge Function) escribe/lee
ALTER TABLE public.public_enrollment_throttle ENABLE ROW LEVEL SECURITY;

-- Limpieza de filas fuera de cualquier ventana razonable (ej. > 1 día)
CREATE OR REPLACE FUNCTION public.cleanup_public_enrollment_throttle()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM public.public_enrollment_throttle WHERE created_at < now() - interval '1 day';
$$;
```

### RLS

| Tabla | Rol | Operación | Política |
|-------|-----|-----------|----------|
| `public_enrollment_throttle` | anon / authenticated | TODAS | ❌ Ninguna policy → bloqueado. Solo `service_role` (EF) accede. |

### Lógica de rate-limit (en EF, antes del dispatch de mutaciones)
- Leer IP de `x-forwarded-for` (primer hop) / `x-real-ip`.
- `INSERT` la fila `(ip, action)`.
- `COUNT` filas de `(ip, action)` con `created_at > now() - ventana`.
- Si `count > umbral` → responder `429`. **Decidido (2026-06-03): 10 req / 10 min por `(ip, action)`** para mutaciones pesadas.

### Modelos UI/DTO
- N/A — el honeypot no se persiste; es un flag de request.

---

## 5. Arquitectura del feature

```
Request anónimo (browser)
   │  body incluye { action, honeypot, ...payload }
   ▼
Deno.serve(req)  ── handler principal EF ─────────────────────────────┐
   │ 1. extraer Origin → isOriginAllowed(origin, ALLOWLIST)  (S2)      │
   │ 2. si acción ∈ MUTACIONES:                                        │
   │      a. isHoneypotTripped(body.honeypot)            → 400 (S1)    │
   │      b. extraer IP; isRateLimited(count, max)       → 429 (S1)    │
   │ 3. dispatch a handleXxx(supabase, body)                           │
   └───────────────────────────────────────────────────────────────────┘
              │
              ▼
   handlers existentes (submit-clase-b, initiate-payment, confirm-payment…)
   con hardening interno:
     · inviteStudentToAuth → email almacenado si RUT existe   (S3)
     · console.* sin PII                                       (S4)
     · confirm-payment: amountsMatch(commit, esperado)         (S6)

Frontend:
   public-personal-data.component  ── honeypot oculto ──▶ facade
   public-enrollment.facade        ── generateToken() sin fallback (S5)
                                   ── honeypot en body de mutaciones (S1)
```

### Capas tocadas
- **Edge Function**: `supabase/functions/public-enrollment/index.ts` + `_shared/anti-abuse.ts`
- **Migration**: `supabase/migrations/20260603120000_*`
- **Facade**: `core/facades/public-enrollment.facade.ts`
- **Dumb**: `shared/components/public-enrollment-steps/public-personal-data/`

---

## 6. Restricciones aplicables

- [x] `architecture.md` — Functional Core: lógica anti-abuso como funciones puras testables (`_shared/anti-abuse.ts`). Facade sigue siendo el único que habla con la EF.
- [x] `facades.md` — el honeypot/token se manejan en el facade; la UI no toca la EF directo.
- [ ] `models.md` — sin DTOs nuevos.
- [x] `visual-system.md` — el honeypot debe ser invisible pero accesible-safe (no romper a11y; `aria-hidden`, fuera del tab order).
- [ ] `swr-pattern.md` — no aplica.
- [ ] `notifications.md` — no dispara toasts nuevos (salvo mensaje de rate-limit, que reusa el `_error` signal existente).
- [x] `testing-tdd.md` — `.spec.ts` para `generateToken` (facade) + `deno test` para helpers puros.
- [x] `ai-readability.md` — ⚠️ el honeypot NO lleva `data-llm-*` (al contrario: debe ser invisible para humanos y agentes legítimos; documentar que es trampa anti-bot).
- [x] `database.md` — documentar `public_enrollment_throttle` en `indices/DATABASE.md`, RLS estricta.

---

## 7. Plan de testing

- **Unit (Functional Core, `deno test` en `_shared/anti-abuse.test.ts`):**
  - `isRateLimited(count, max)` — bajo/sobre umbral.
  - `isOriginAllowed(origin, allowlist)` — permitido / no permitido / sin Origin.
  - `amountsMatch(a, b)` — igual / distinto.
  - `isHoneypotTripped(value)` — vacío (humano) / con valor (bot).
- **Unit (vitest, facade spec):**
  - `generateToken()` usa `crypto.randomUUID`; sin él → lanza error (no fallback).
  - El `body` de las mutaciones incluye el campo honeypot.
- **E2E (Playwright + Transbank integración):**
  - AC-F1: pago aprobado (`4051…6623`) → enrollment `active`, número, `payment` creado, holds liberados, `/retorno` success.
  - AC-F2: pago rechazado (`5186…0568`) → enrollment `cancelled`, holds liberados, sin `payment`, `/retorno` rejected.
  - AC-E1/E2: usuario legítimo no bloqueado; ventana de rate-limit se reinicia.
- **QA manual:** verificar honeypot lleno → rechazo; CORS desde origen no permitido → bloqueado; grep de logs sin PII.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| No hay harness de tests para Edge Functions Deno (vitest es solo `src/`) | Alta | Extraer lógica a funciones puras y testear con `deno test` nativo (cero deps); el resto vía E2E Playwright |
| `x-forwarded-for` spoofeable o con múltiples hops detrás de proxies/Supabase | Media | Tomar el primer hop de confianza; combinar con honeypot (defensa en capas); no depender solo de IP |
| Umbral de rate-limit mal calibrado → bloquea usuarios legítimos (familias compartiendo IP/NAT) | Media | Umbral por `(ip, action)` generoso; ventana corta; AC-E1 valida que el happy path no se bloquea; afinar en tasks |
| Hardening de invite (S3) rompe el alta legítima de alumnos nuevos | Media | Solo cambia el caso "RUT ya existe"; RUT nuevo sigue igual. Test explícito del caso existente vs nuevo |
| Probar pago real contra Transbank integración desde Playwright (redirect externo + form de Webpay) | Media | Usar las credenciales de prueba documentadas; si el form de Webpay es inestable en automation, fallback a verificación de `confirm-payment` por API con token simulado |
| Reconciliación de monto (S6) con `partial` (`Math.ceil(base/2)`) puede diferir por redondeo | Baja | `amountsMatch` compara contra el mismo cálculo server-side, no contra `base_price` crudo |

---

## 9. Orden de implementación

1. **Migración** `public_enrollment_throttle` + función de limpieza + documentar en `DATABASE.md`.
2. **`_shared/anti-abuse.ts`** (funciones puras) + `anti-abuse.test.ts` (TDD: tests primero).
3. **Edge Function** — integrar el gate (CORS allowlist S2 + honeypot/rate-limit S1) en el handler principal; luego hardening interno (S3 invite, S4 logs, S6 reconciliación).
4. **Facade** — `generateToken` sin fallback (S5) + honeypot en payloads (S1) + spec.
5. **`public-personal-data`** — campo honeypot oculto wired al facade.
6. **E2E Playwright** — AC-F1/F2 + AC-E1/E2; QA manual de honeypot/CORS/logs.
7. **`/spec-verify`** — generar `acceptance.md` con evidencia.

---

## 10. Estimación

**M — 1.5 a 2.5 días.** El grueso es la Edge Function (5 de 6 fixes) + la verificación E2E real contra Transbank.

---

## Changelog

- 2026-06-03 — plan inicial (derivado de auditoría de seguridad fase 1).
