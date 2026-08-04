# Asignación ASG-b-038 — Matrícula de refuerzo (6 clases) sin romper el modelo de Clase B

> **status:** pendiente
> **owner:** m
> **tipo_sugerido:** spec
> **priority:** P2
> **created:** 2026-07-28
> **created_by:** b

---

## Contexto / Objetivo

Anotación de la reunión (2026-07-28):

> *"Puede pasar que alumnos que necesitan reforzar ciertas cosas, se matriculen sólo para
> 6 clases."*

### Por qué esto no es un cambio menor

El modelo actual asume **12 prácticas** en todas partes:

- `class_b_sessions` tiene `CHECK (class_number BETWEEN 1 AND 12)`
  (`chk_class_b_sessions_class_number_range`) y `UNIQUE (enrollment_id, class_number)`,
  ambos agregados deliberadamente en `20260709120100` (fix-028-m).
- El certificado Clase B se emite contra las 12 prácticas completadas — es justamente el gate
  que **ASG-b-014** está por reforzar server-side.
- Los KPIs de avance del alumno son "N/12".

Un alumno de 6 clases de refuerzo **no es candidato al certificado Clase B**. Meterlo en la
misma matrícula rompe el gate del certificado y descuadra los indicadores de avance.

## Respuesta del cliente (2026-08-02)

Opción **(a) Otro producto** — confirmado. Curso "Refuerzo" propio en `courses`, con su precio y
su cantidad de clases (6). No toca el modelo de 12 prácticas de Clase B.

> Preguntas 2–4 (certificado/constancia, elegibilidad de externos, precio por clase suelta vs.
> paquete cerrado) no se respondieron explícitamente — quien reclame esta asignación debe
> confirmarlas con el cliente antes de definir el detalle del curso nuevo, pero ya no son
> bloqueantes para arrancar el diseño del modelo (curso separado).

## Alcance sugerido

Con la pregunta 1 resuelta, el alcance es acotado: curso nuevo en `courses`, ajuste del wizard
de matrícula para ofrecerlo, y verificar que el gate del certificado y los KPIs de avance
filtren por tipo de curso en vez de asumir 12.

## Referencias

- `indices/DATABASE.md` → `class_b_sessions` (constraints), `courses`, `enrollments`
  (`license_group`)
- ASG-b-014 (gate server-side del certificado Clase B) — tocan el mismo criterio de elegibilidad

## Archivos involucrados (opcional, para detectar solapes)

- Sin declarar — depende de la respuesta. Si es (b), el alcance toca medio sistema.

## Notas para quien la reclame

- ⚠️ **Coordinar con ASG-b-014.** Si esta asignación introduce cursos con distinta cantidad de
  prácticas, el gate del certificado que ASG-b-014 va a escribir **no puede hardcodear 12** —
  tiene que leer la cantidad desde el curso. Quien llegue segundo hereda el problema.
- Ojo con la memoria del proyecto: ya existe el hallazgo de que "Alumnos Profesional vs B" no
  está dividido en la base de alumnos y que la división vive en `enrollments.license_group`.
  Un tercer tipo de matrícula agrava eso.
