# Asignación ASG-035 — Promociones automáticas: cadencia, convalidaciones y matrícula tardía

> **status:** pendiente
> **owner:** m
> **tipo_sugerido:** spec
> **priority:** P1
> **created:** 2026-07-28
> **created_by:** b
> **bloqueada_por:** respuesta del cliente (ver "Preguntas abiertas")

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

**Conflicto detectado con el modelo actual:** `indices/DATABASE.md` documenta
`professional_promotions` como *"Período de **30 días** que agrupa hasta 4 cursos profesionales
en paralelo (RF-059)"*. La nota del cliente dice *"empiezan cada 15 días"*. Eso es una
**cadencia**, no una duración — las dos cosas solo conviven si las promociones **se solapan**
(≈2 vivas al mismo tiempo).

Esa hipótesis además explica el punto 2: si la promoción padre dura 30 días y la convalidación
~15, entonces "sale a la mitad del libro del padre" es exactamente cuando arranca la promoción
siguiente. Pero es una hipótesis, no un hecho confirmado.

## Preguntas abiertas (BLOQUEANTE — preguntar al cliente antes de codear)

1. **¿Cuánto dura una promoción de punta a punta?** ¿Siguen siendo 30 días como documenta
   RF-059, o cambió a 15?
2. **¿Cuántas promociones pueden estar vivas al mismo tiempo?** Si duran 30 días y arrancan
   cada 15, hay 2 solapadas de forma permanente — el selector de matrícula tiene que listar
   varias activas, no una.
3. **¿La convalidación arranca a la mitad del libro padre por regla fija, o se decide caso a
   caso?** Si es fija, se puede derivar automáticamente; si es caso a caso, necesita fecha
   manual al crearla.

⚠️ No asumir la respuesta. Si se implementa la cadencia al revés, arrastra el libro de clases,
las convalidaciones y la elegibilidad de matrícula con ella.

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
