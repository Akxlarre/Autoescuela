# Fix: La columna "Promoción" de la Base Profesional muestra el curso
> id: fix-330-m-columna-promocion-muestra-curso
> refs: fix-319-m-testing-clase-profesional-piloto (C05, D11) · ASG-i-025
> status: done
> closed: 2026-10-05
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

**Verificado el 2026-10-05:** `admin-alumnos-profesional.facade.spec.ts` (fila con "Promoción 280"
y A4; sin promoción → "—" con categoría igual; promoción sin número → "Promoción del 12-10-2026"):
18/18; specs de la lista 2/2. `tsc` y `lint:arch` sin errores. La **categoría ahora sale del curso
de la matrícula** (`enrollments.courses.license_class`), no del curso de la promoción: así también
la tienen los 60 alumnos del seed sin promoción, y el filtro por clase funciona con ellos (antes
quedaban con categoría vacía). Visual (`secretaria2@test.com`, búsqueda "E2E-Prof"): 0092 y 0093
"Promoción 280 · A2", 0094 "Promoción 281 · A4", 0095 "Promoción 280 · A3", en tabla y tarjeta.
La consola mostró `NG0955` (claves duplicadas) por las 2 filas de E2E-ProfDoble: es B05, lo
corrige `fix-331-m`.
