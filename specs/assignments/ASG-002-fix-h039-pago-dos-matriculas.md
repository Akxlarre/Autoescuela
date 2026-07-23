# Asignación ASG-002 — Fix H-039: alumno con 2+ matrículas no puede pagar su saldo real

> **status:** reclamada
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** b
> **claimed_at:** 2026-07-23
> **resulting_track:** fix-058-b-pago-multiples-matriculas

---

## Contexto / Objetivo

Un alumno con dos matrículas (ej. Clase B con saldo pendiente + Profesional pagada, creada después) queda sin forma de ver ni pagar su deuda real desde el portal — la página "Pagos y Clases" siempre muestra la matrícula más reciente, sin importar si tiene saldo pendiente. Confirmado en producción con un alumno real preexistente en la base. Bloquea directamente el flujo de cobro para ese perfil de alumno.

## Alcance sugerido

- Cambiar el filtro en `supabase/functions/student-payment/index.ts:206-217` (acción `load-enrollment-status`) de "más reciente por `created_at`" a "priorizar la matrícula con `pending_balance > 0`, y solo caer a la más reciente cuando todas están saldadas".
- Alternativa (más grande, evaluar con el equipo): agregar selector de matrícula a la página de Pagos, igual al que ya existe en el Dashboard vía `StudentEnrollmentContextFacade` — esta página hoy no lo usa en absoluto.
- Fuera de scope: no tocar el flujo de pago en sí (Webpay), solo la resolución de qué matrícula mostrar.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgo H-039 (detalle completo con causa raíz confirmada en código).

## Archivos involucrados (opcional, para detectar solapes)

- `supabase/functions/student-payment/index.ts`

## Notas para quien la reclame

- Bug real, no cosmético — prioridad alta aunque el caso de negocio (2 matrículas) es acotado.
- Verificado con Webpay sandbox real durante el audit — el resto del flujo de pago SÍ funciona bien una vez resuelto este filtro.
