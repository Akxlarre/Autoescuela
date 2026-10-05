# Fix: La columna "Promoción" de la Base Profesional muestra el curso
> id: fix-330-m-columna-promocion-muestra-curso
> refs: fix-319-m-testing-clase-profesional-piloto (C05, D11) · ASG-i-025
> status: in_progress
> created: 2026-10-05

## Root Cause
La columna "Promoción" muestra el nombre del curso (`promotion_courses.courses.name`, p. ej.
"Clase A2 …"), porque la consulta de la Base Profesional no trae la promoción
(`admin-alumnos-profesional.facade.ts`, `RawProEnrollment.promotion_courses`).

Decisión D11 (Matías, 2026-10-05): **número/fecha de la promoción, con la categoría (A2/A3/A4/A5)
debajo.**

## ACs Afectados
Ninguno — fix autónomo.

## Cambio
- **`src/app/core/facades/admin-alumnos-profesional.facade.ts`** — traer
  `professional_promotions(code, start_date)` y `courses.license_class`; mapear a la fila.
- **`src/app/shared/components/alumnos-profesional-list-content/alumnos-profesional-list-content.component.ts`**
  (tabla y tarjeta) — mostrar promoción + categoría.
- Revisar que la búsqueda/filtro por promoción siga funcionando con el dato nuevo.

## Test de Regresión
- Spec del facade: la fila trae número de promoción y categoría.
- E2E: la columna muestra "Promoción 279" (o su fecha si no tiene número) y "A2" debajo.
