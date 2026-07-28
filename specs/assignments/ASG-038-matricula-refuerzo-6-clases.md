# Asignación ASG-038 — Matrícula de refuerzo (6 clases) sin romper el modelo de Clase B

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** spec
> **priority:** P2
> **created:** 2026-07-28
> **created_by:** b
> **bloqueada_por:** respuesta del cliente (ver "Preguntas abiertas")

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
  que **ASG-014** está por reforzar server-side.
- Los KPIs de avance del alumno son "N/12".

Un alumno de 6 clases de refuerzo **no es candidato al certificado Clase B**. Meterlo en la
misma matrícula rompe el gate del certificado y descuadra los indicadores de avance.

## Preguntas abiertas (BLOQUEANTE — preguntar al cliente antes de codear)

1. **El alumno de refuerzo, ¿qué es respecto de la Clase B?**
   - **(a) Otro producto** — un curso "Refuerzo" propio en `courses`, con su precio y su
     cantidad de clases. No toca el modelo de Clase B. **Recomendada.**
   - **(b) Una Clase B con menos clases** — implica volver variable el 12 en todo el sistema:
     CHECK constraint, gate del certificado, KPIs, precio prorrateado. Transversal y caro.
2. **¿El alumno de refuerzo recibe algún certificado o constancia?**
3. **¿Puede hacer refuerzo alguien que nunca hizo la Clase B con ustedes** (un externo), o solo
   ex-alumnos propios?
4. **¿El precio es por clase suelta o es un paquete cerrado de 6?**

## Alcance sugerido

Depende enteramente de la respuesta a la pregunta 1. Si es (a) — que es lo probable — el
alcance es acotado: curso nuevo en `courses`, ajuste del wizard de matrícula para ofrecerlo, y
verificar que el gate del certificado y los KPIs de avance filtren por tipo de curso en vez de
asumir 12.

## Referencias

- `indices/DATABASE.md` → `class_b_sessions` (constraints), `courses`, `enrollments`
  (`license_group`)
- ASG-014 (gate server-side del certificado Clase B) — tocan el mismo criterio de elegibilidad

## Archivos involucrados (opcional, para detectar solapes)

- Sin declarar — depende de la respuesta. Si es (b), el alcance toca medio sistema.

## Notas para quien la reclame

- ⚠️ **Coordinar con ASG-014.** Si esta asignación introduce cursos con distinta cantidad de
  prácticas, el gate del certificado que ASG-014 va a escribir **no puede hardcodear 12** —
  tiene que leer la cantidad desde el curso. Quien llegue segundo hereda el problema.
- Ojo con la memoria del proyecto: ya existe el hallazgo de que "Alumnos Profesional vs B" no
  está dividido en la base de alumnos y que la división vive en `enrollments.license_group`.
  Un tercer tipo de matrícula agrava eso.
