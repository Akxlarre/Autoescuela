# Fix: La Edge Function de inscripción pública responde aunque el módulo está bloqueado
> id: fix-193-b-inscripcion-publica-cerrada-en-servidor
> refs: ASG-i-037 (sospecha S7, confirmada en fix-190-b)
> status: done
> created: 2026-10-06

## Root Cause
El bloqueo de la fase piloto (`fix-255-m`, `pilot-phase.config.ts`) vive solo en el frontend: el
guard `pilotPhaseGuard('inscripcion-publica')` esconde `/inscripcion`, pero la Edge Function
`public-enrollment` sigue publicada sin sesión (`verify_jwt` apagado por diseño). Cualquiera con la
URL y la anon key obtiene `load-instructors` (nombres + patentes) y `check-duplicate` (si un RUT
tiene matrícula en curso → enumeración de alumnos), y las acciones que escriben siguen vivas.

## ACs Afectados
Ninguno de una spec previa. ACs propios (decisión del owner 2026-10-06: cerrar, recomendación):

- **F1:** sin el secret `PUBLIC_ENROLLMENT_ENABLED=true`, toda acción de `public-enrollment`
  responde 503 "La inscripción en línea no está disponible." sin tocar la BD (ni el rate-limit).
  Falla cerrado: secret ausente, vacío o distinto de `true` = cerrado.
- **F2:** con `PUBLIC_ENROLLMENT_ENABLED=true` el comportamiento es el de hoy (para el día que se
  levante la fase piloto: sacar el módulo de `BLOCKED_MODULES` **y** setear el secret).
- **F3:** el preflight CORS (OPTIONS) sigue respondiendo.

## Cambio
- `supabase/functions/_shared/anti-abuse.ts` (+ test) — `isPublicEnrollmentOpen(flag)`, función pura.
- `supabase/functions/public-enrollment/index.ts` — gate al inicio del handler.
- `src/app/core/config/pilot-phase.config.ts` — nota: levantar `inscripcion-publica` requiere el secret.

## Fuera de alcance
- `student-payment` conserva `reserve-slots`/`release-slots` legacy (requiere sesión; queda anotado).

## Test de Regresión
- `deno test supabase/functions/_shared/anti-abuse.test.ts`
- Tras el deploy: POST `load-instructors` y `check-duplicate` con la anon key → 503.

## Progreso
- [x] `deno test supabase/functions/_shared/anti-abuse.test.ts` → 15/15 (3 nuevos), 2026-10-06.
- [x] PR #203 abierto.
- [x] Deploy de `public-enrollment` v70 (aprobado por el owner; Management API, `verify_jwt:false` como antes).
- [x] POST `load-instructors` / `check-duplicate` con la anon key → 503 "La inscripción en línea no está disponible."; OPTIONS → 200.
