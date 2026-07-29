# Asignación ASG-b-035 — Promociones automáticas: cadencia, convalidaciones y matrícula tardía

> **status:** reclamada
> **owner:** m
> **tipo_sugerido:** spec
> **priority:** P1
> **created:** 2026-07-28
> **created_by:** b
> **claimed_by:** m
> **claimed_at:** 2026-07-28
> **resulting_track:** [0002-m-promociones-cadencia-automatica](../specs/0002-m-promociones-cadencia-automatica/spec.md)
> **bloqueada_por:** respuesta del cliente sobre convalidaciones (pregunta 3 — cadencia y
> solapamiento ya confirmados por Matías, ver nota 2026-07-28 más abajo). No bloquea el resto
> del alcance, que ya quedó fuera del scope de la spec activa.

---

## Contexto / Objetivo

Agrupa 3 anotaciones de la reunión con el cliente (2026-07-28) que son un solo nudo:

1. *"Las promociones empiezan cada 15 días, siempre lunes. Trigger SQL para que se creen
   automáticamente, en matrícula elegir a cuál asignar al alumno. Pueden haber libros de
   clases sin ningún estudiante si nadie se matriculó a una promoción."*
2. *"Convalidaciones duran menos (2 semanas / 2 semanas y media), salen a la mitad del libro
   de clases de la clase padre."*
3. *"Usualmente se matriculan en promociones que aún no comienzan, pero puede darse en
   promociones transcurriendo o ya finalizadas. Máximo 3 días después de haber comenzado.
   Dar la mayor flexibilidad para añadir alumnos."*

**Actualización 2026-07-28 (Matías):** el "conflicto" con `DATABASE.md` (RF-059 decía "período
de 30 días") era vacío documental, no una discrepancia real — desde el inicio del proyecto se
sabe que las promociones se solapan y que arrancan cada 14 días (siempre lunes, técnicamente
cada 2 semanas, no cada 15 — el "15" de la nota de reunión era redondeo). Ese conocimiento nunca
quedó escrito en `indices/`, por eso Benjamín no tenía cómo saberlo al procesar la anotación.
`DATABASE.md` ya se corrigió para reflejar los 14 días y el solapamiento esperado.

Lo de las convalidaciones (punto 2) sigue siendo un tema aparte, genuinamente sin definir — no
se sabe si la fecha de inicio de la convalidación es una regla fija derivada del padre o se
decide caso a caso.

## Preguntas abiertas (BLOQUEANTE — preguntar al cliente antes de codear)

~~1. ¿Cuánto dura una promoción de punta a punta?~~ **Resuelto:** cadencia cada 14 días
   (2 lunes), pueden convivir varias promociones vivas simultáneamente. No es un tope fijo de
   30 días.
~~2. ¿Cuántas promociones pueden estar vivas al mismo tiempo?~~ **Resuelto:** sí se solapan,
   el selector de matrícula debe listar varias promociones activas a la vez, no una.
3. **¿La convalidación arranca a la mitad del libro padre por regla fija, o se decide caso a
   caso?** Si es fija, se puede derivar automáticamente; si es caso a caso, necesita fecha
   manual al crearla. **Sigue bloqueante.**

## Alcance sugerido

- Cron/trigger SQL que garantice que siempre exista la promoción del próximo lunes que
  corresponda, con su `class_book` asociado **aunque quede sin alumnos** (el cliente lo
  confirmó explícitamente: un libro vacío es válido).
- Selector de promoción en el wizard de matrícula Profesional, capaz de mostrar **varias
  promociones activas a la vez** + las que aún no arrancan.
- Regla de matrícula tardía: permitir inscribir hasta **3 días después** del inicio.
  El cliente pidió "la mayor flexibilidad" → validar si los 3 días son un tope duro o una
  advertencia que el admin puede saltarse.
- Convalidaciones con duración propia (~15 días) y fecha de inicio derivada del padre.

## Referencias

- `indices/DATABASE.md` → `professional_promotions`, `promotion_courses`, `class_book`,
  `license_validations` (columna `convalidation_promotion_course_id`, `book2_open_date`).
- Ya existe `auto_transition_promotion_status()` (pg_cron `0 6 * * *`) que mueve
  `planned→in_progress→finished`. El trigger nuevo debe convivir con ese, no duplicarlo.
- Ya existe `cascade_promotion_status_to_courses()` que propaga el status a los cursos hijos.

## Archivos involucrados (opcional, para detectar solapes)

- `supabase/migrations/` (migración nueva)
- `src/app/core/facades/promociones.facade.ts`
- Wizard de matrícula Profesional

## Notas para quien la reclame

- Las 3 preguntas de arriba van juntas a la misma conversación con el cliente. **No las
  repartas ni las preguntes de a una en reuniones distintas** — las respuestas tienen que ser
  coherentes entre sí o el diseño queda inconsistente.
- `class_book` cuelga de `promotion_course_id`: crear promociones automáticamente implica crear
  libros automáticamente. Verificar que el auto-insert existente (`20260405100000`) siga
  cubriendo el caso.
