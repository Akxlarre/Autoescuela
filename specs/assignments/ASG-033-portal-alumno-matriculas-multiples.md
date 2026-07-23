# Asignación ASG-033 — Portal alumno no muestra matrículas múltiples

> **status:** pendiente
> **owner:** b
> **tipo_sugerido:** spec
> **priority:** P2
> **created:** 2026-07-23
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Cuando un alumno tiene 2+ matrículas activas (ej. Clase B con saldo pendiente + Profesional
pagada), la página "Pagos y Clases" y el KPI de saldo del Dashboard del alumno solo muestran
UNA matrícula — la que resuelve `pickEnrollmentToShow()` (fix-058, prioriza la que tiene
saldo real). La otra matrícula queda completamente invisible para el alumno: no aparece en
ningún lado, aunque esté activa y pagada. El panel admin ya resuelve este mismo problema con
tabs por matrícula en la ficha del alumno (`admin-alumno-detalle.component.ts`); el portal
alumno no tiene el equivalente. Encontrado y confirmado en vivo al verificar `fix-058-b`
(H-039) con un alumno de prueba con 2 matrículas reales — el fix corrigió CUÁL matrícula se
prioriza, pero no resuelve que la otra quede oculta.

## Alcance sugerido

- Definir cómo el alumno debería ver/navegar entre sus matrículas cuando tiene más de una
  (¿tabs como en admin? ¿selector? ¿todo en una sola vista combinada?).
- Afecta al menos: `/app/alumno/pagos` (`student-payment.facade.ts` + Edge Function
  `student-payment`) y el KPI "Saldo" del Dashboard alumno (`student-home.facade.ts`, que ya
  tiene `buildClassBSnapshot()`/`buildProfessionalSnapshot()` — posible base a reutilizar).
- Evaluar si aplica también a "Mis Clases" / "Mi Horario" del alumno, o si esos ya manejan
  bien multi-matrícula (no verificado en esta sesión).
- Caso de negocio acotado (alumnos con doble matrícula Clase B + Profesional), pero real —
  no es hipotético.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgo H-039.
- `specs/fix-058-b-pago-multiples-matriculas/fix.md` — root cause y verificación E2E del
  bug de selección de matrícula que motivó este hallazgo colateral.
- `specs/assignments/ASG-002-fix-h039-pago-dos-matriculas.md` — ya mencionaba esta
  alternativa ("selector de matrícula en Pagos, igual al del Dashboard") como fuera de
  alcance de un fix simple.

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/student-payment.facade.ts`
- `supabase/functions/student-payment/index.ts`
- `src/app/core/facades/student-home.facade.ts`
- `src/app/features/alumno/pagos/*` (o el path equivalente del componente de Pagos alumno)

## Notas para quien la reclame

- Requiere decisión de diseño real (no es un fix acotado) — por eso `tipo_sugerido: spec`.
- Prioridad Media: no corrompe datos ni bloquea pagos (fix-058 ya asegura que el alumno ve
  y puede pagar SU saldo real), pero es una fuga de transparencia — el alumno no sabe que
  tiene otra matrícula activa.
