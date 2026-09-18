# Asignación ASG-m-002 — Mover el paso de Pago antes de la Firma de contrato en matrícula

> **status:** completada
> **owner:** i
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-09-14
> **created_by:** m
> **claimed_by:** i
> **claimed_at:** 2026-09-18
> **resulting_track:** fix-034-i-orden-pago-firma-y-pasos-por-nombre

> **Nota de reclamación (2026-09-18):** alcance acotado tras discusión con el equipo —
> solo flujo presencial (Admin/Secretaria), la matrícula pública online se bloquea aparte
> (`ASG-i-013`, no se resuelve el caso de pago por pasarela sin firmar). Sin alerta a la
> secretaria (se cancela en el momento). Sin migración de datos de borradores (no hay
> producción real hoy). Se corrige además la causa raíz de fondo: el wizard identificará
> los pasos por nombre en vez de por número, para que este riesgo no se repita en futuros
> reordenamientos. Ver `fix-034-i` para el detalle completo.

---

## Contexto / Objetivo

En todos los flujos de matrícula (Clase B y Profesional, ambas escuelas), el paso de Pago
debe pasar a ir **antes** que el paso de Firma de contrato (hoy va después). El objetivo es
que el alumno pague primero y firme el contrato después, en vez del orden actual.

## Alcance sugerido

- Aplica a todos los flujos de matrícula por igual: Clase B y Profesional, ambas escuelas.
- Si el alumno paga pero luego no llega a firmar el contrato (se arrepiente, no vuelve,
  etc.), el pago **no se pierde ni se descarta**: queda registrado en el sistema como pago
  pendiente de aplicar, y la matrícula no se da por completada hasta que se firme el
  contrato. Ese pago pendiente se puede reembolsar o reasignar manualmente después.
- Revisar el estado de la matrícula/enrollment en ese punto intermedio (pagado pero sin
  contrato firmado) — probablemente necesita su propio estado o flag para diferenciarlo de
  una matrícula completada.

## Referencias

- Ninguna.

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno declarado. Probablemente toca el wizard/stepper de matrícula (ambos flujos B y
  profesional) y el modelo de estados de `enrollments`.

## Notas para quien la reclame

- Este cambio de orden afecta el flujo central de matrícula — coordinar con quien esté
  trabajando en matrícula profesional (ASG-m-001) para evitar pisarse, ya que ambos tocan
  el mismo wizard.
- Diseñar con cuidado el estado intermedio "pagado, contrato no firmado" — no debe
  confundirse con una matrícula activa ni con un pago huérfano sin trazabilidad.
