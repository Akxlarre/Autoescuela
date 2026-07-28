# Asignación ASG-041 — Fecha de obtención de licencia B + advertencia de los 2 años (Profesional)

> **status:** pendiente
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-07-28
> **created_by:** b

---

## Contexto / Objetivo

Anotación de la reunión (2026-07-28):

> *"Pedir fecha obtención licencia clase B para quienes quieran matricularse a Clase
> Profesional, deben haber tenido 2 años al menos licencia clase B. Dejar la opción para
> matricular pero con advertencia clara de no haber cumplido los 2 años de licencia aún."*

Requisito legal para las licencias profesionales. El cliente fue explícito: **advertir, no
bloquear** — la secretaría debe poder matricular igual bajo su criterio.

## Hallazgo — la columna ya existe

`indices/DATABASE.md` → **`students.license_obtained_date` (DATE, nullable)** ya está en el
modelo, junto con `current_license_class`. No hace falta migración para guardar el dato; falta
**pedirlo en el wizard** de matrícula Profesional y usarlo.

## Decisión ya tomada (confirmada con el owner, 2026-07-28)

Los 2 años se cuentan **hasta la fecha de inicio del curso**, no hasta la fecha de matrícula.
Razón: es lo que le conviene al alumno (puede matricularse antes de cumplirlos si al empezar
ya los tiene) y es lo que importa legalmente. Si el cliente lo cuenta distinto, corregir acá.

## Alcance sugerido

- Campo de fecha en el wizard de matrícula Profesional, persistido en
  `students.license_obtained_date`.
- Cálculo de la antigüedad contra la fecha de inicio del curso.
- **Advertencia clara y no bloqueante** si no llega a los 2 años: debe decir cuánto le falta,
  no un genérico "no cumple requisitos".
- Usar `<p-datepicker>` y no un input de fecha nativo (ver ASG existentes sobre inputs de fecha
  y spec `0014-b-reemplazar-inputs-fecha-nativos-por-p-datepicker`).

## Archivos involucrados (opcional, para detectar solapes)

- Wizard de matrícula Profesional
- `src/app/core/facades/enrollment.facade.ts`

## Notas para quien la reclame

- La advertencia es un mensaje de negocio con consecuencia legal: redactarla con el cliente,
  no inventarla. Sugerencia de fondo: dejar registro de **quién** matriculó a pesar de la
  advertencia, para que después no sea la palabra de nadie contra nadie.
- ⚠️ Coordinar con **ASG-035** si toca el mismo wizard (selector de promoción Profesional).
