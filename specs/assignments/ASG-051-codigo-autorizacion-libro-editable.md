# Asignación ASG-051 — Poder cambiar el código de autorización del libro de clases

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P3
> **created:** 2026-07-28
> **created_by:** b

---

## Contexto / Objetivo

Anotación de la reunión (2026-07-28):

> *"Código autorización libro de clases: dar opción de poder cambiar."*

## Hallazgo — la columna ya existe

`class_book` ya tiene **`sence_code` (TEXT)** — descrita en `indices/DATABASE.md` como *"código
SENCE autorizado"* — agregada en `20260405100000` junto con `horario`. Lo que falta es poder
editarla desde la interfaz.

⚠️ **Confirmar que `sence_code` es efectivamente el "código de autorización" del que habla el
cliente.** Podría estar refiriéndose a otro código. Si no es ese, esta asignación cambia de
alcance y probablemente necesite migración.

## Alcance sugerido

- Campo editable del código en la vista del libro de clases.
- Permisos: RLS de `class_book` es **admin + secretaría, CRUD**. Confirmar con el cliente si
  quiere que secretaría pueda cambiarlo o solo admin — es un código de autorización oficial, no
  un campo cualquiera.
- Considerar dejar registro de quién lo cambió y cuándo. La tabla ya tiene `generated_by` y
  `closed_by`; un código de autorización que cambia sin rastro es el tipo de cosa que después
  nadie puede explicar en una fiscalización.

## Referencias

- `indices/DATABASE.md` → `class_book` (`sence_code`, `horario`, `period`, `promotion_course_id`,
  `branch_id`, `generated_by`, `closed_by`)
- `src/app/core/facades/libro-de-clases.facade.ts`

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/libro-de-clases.facade.ts`
- Feature de libro de clases

## Notas para quien la reclame

- Tarea chica **si** `sence_code` es el campo correcto. Verificar eso **antes** de estimar.
- ⚠️ Si el libro ya está cerrado (`closed_by` no nulo), ¿se puede seguir cambiando el código?
  Misma familia de preguntas que ASG-037 y ASG-050 sobre modificar registros cerrados.
