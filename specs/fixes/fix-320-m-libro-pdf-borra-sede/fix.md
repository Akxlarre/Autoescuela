# Fix: Generar el PDF del libro de clases le borra la sede al libro
> id: fix-320-m-libro-pdf-borra-sede
> refs: fix-319-m-testing-clase-profesional-piloto (S24) · ASG-i-025
> status: in_progress
> created: 2026-10-05

## Root Cause
`generate-class-book-pdf` pide `professional_promotions(… branches(name, address))` **sin `id`**
(`supabase/functions/generate-class-book-pdf/index.ts:92`), así que `branch?.id` siempre es
`undefined` y el `upsert` final escribe `branch_id = null` (`:130,267`), aun si el libro ya tenía
sede. Existe desde que se creó el módulo (`d75c2777`).

Confirmado en la BD de desarrollo el 2026-10-05: 13 libros con `branch_id = null` (9 `active`,
4 `in_review`), todos de promociones de la sede 2.

Impacto bajo hoy: solo la sede 2 tiene Clase Profesional y siempre será así (Matías, 2026-10-05).
Se corrige porque bloquea `fix-321-m` (un RLS por sede sobre `class_book` dejaría fuera las filas
con sede NULL).

## ACs Afectados
Ninguno — fix autónomo (bug encontrado en el testing de `ASG-i-025`).

## Cambio
- **`supabase/functions/generate-class-book-pdf/index.ts`** — pedir `branches(id, name, address)`
  para que el `upsert` guarde la sede real. De paso, dejar de pedir `phone` (`:107,199`): el PDF
  no lo imprime (minimización de datos).
- **Migración nueva** — rellenar `class_book.branch_id` desde
  `promotion_courses → professional_promotions.branch_id` donde esté en NULL. Idempotente.
- La migración la aplica Matías y la función la despliega Matías.

## Test de Regresión
- Generar el PDF de un libro de la sede 2 y comprobar por API que `class_book.branch_id = 2`.
- Consulta de control: 0 filas de `class_book` con `branch_id IS NULL`.
