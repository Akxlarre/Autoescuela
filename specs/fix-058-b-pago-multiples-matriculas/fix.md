# Fix: Alumno con 2+ matrículas no puede pagar su saldo real
> id: fix-058-b-pago-multiples-matriculas
> refs: ASG-002 (specs/assignments/ASG-002-fix-h039-pago-dos-matriculas.md)
> status: in_progress
> created: 2026-07-23

## Root Cause
[Heredado de ASG-002, a confirmar]: Un alumno con dos matrículas (ej. Clase B con saldo
pendiente + Profesional pagada, creada después) queda sin forma de ver ni pagar su deuda
real desde el portal — la página "Pagos y Clases" siempre muestra la matrícula más reciente,
sin importar si tiene saldo pendiente. Confirmado en producción con un alumno real
preexistente en la base. Bloquea directamente el flujo de cobro para ese perfil de alumno.

## ACs Afectados
Ninguno — fix autónomo (bug real detectado en Auditoría QA de Flujos, hallazgo H-039).

## Cambio
<!-- Pendiente de investigación — ver Alcance sugerido de ASG-002 -->
- Cambiar el filtro en `supabase/functions/student-payment/index.ts:206-217` (acción
  `load-enrollment-status`) de "más reciente por `created_at`" a "priorizar la matrícula
  con `pending_balance > 0`, y solo caer a la más reciente cuando todas están saldadas".
- Alternativa (más grande, evaluar antes de implementar): agregar selector de matrícula a
  la página de Pagos, igual al que ya existe en el Dashboard vía
  `StudentEnrollmentContextFacade` — esta página hoy no lo usa en absoluto.
- Fuera de scope: no tocar el flujo de pago en sí (Webpay), solo la resolución de qué
  matrícula mostrar.
- **Archivo:** por confirmar
- **Qué cambia:** por confirmar

## Test de Regresión
<!-- Pendiente -->
