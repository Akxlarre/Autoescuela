# Fix: Guardar el código SENCE falla después de exportar el PDF de un libro nunca guardado
> id: fix-349-m-codigo-sence-se-guarda-despues-de-exportar-el-pdf
> refs: ASG-i-025 · fix-319-m (Q05, S8) · 0018-m · fix-098-m
> status: done
> closed: 2026-10-07
> created: 2026-10-07

## Root Cause
Un libro de clases no tiene fila en `class_book` hasta que alguien guarda su código SENCE o
exporta su PDF (las convalidaciones y las promociones manuales parten sin fila). La pantalla lee
esa fila al abrir el libro y recuerda su id en `cabecera.classBookId`:

- "Guardar" decide con ese valor en memoria: con id hace `UPDATE`, sin id hace `INSERT`
  (`libro-de-clases.facade.ts:613-637`).
- "Exportar PDF" crea la fila en el servidor (la función hace `upsert`), pero la pantalla no se
  entera: `classBookId` sigue en `null`.

Entonces, exportar y después guardar sin recargar hace un `INSERT` de una fila que ya existe y
choca con la unicidad `class_book_promotion_course_conv_key`: toast "Error al guardar" y el código
no queda guardado. Reproducido en 280 Conv. A-4 (Q05).

## ACs Afectados
- `fix-098-m` / `0018-m` AC10 — guardar el código SENCE de cada libro.

## Cambio
- `src/app/core/facades/libro-de-clases.facade.ts` — `saveClassBookFields`: si no tiene el id en
  memoria, antes de insertar busca la fila del libro (mismo curso y misma convalidación). Si
  existe, la actualiza; solo inserta si de verdad no hay fila.

No cambia la función del PDF ni la base de datos.

## Test de Regresión
- `libro-de-clases.facade.spec.ts`: libro abierto sin fila, la fila aparece después (como tras
  exportar) → guardar hace `UPDATE` sobre esa fila, no `INSERT`, y la cabecera queda con su id.
  Los casos existentes (sin fila → `INSERT`; con fila → `UPDATE`) siguen igual.

## Progreso
- [x] Test nuevo + facade. Vitest: 29/29 en el spec del facade del libro.
- [x] `tsc` limpio; `lint:arch` sin errores.
- [x] Revisión en navegador (admin, 2026-10-07): libro 281.5 sin fila (se borró la que tenía,
  vacía). Exportar PDF crea la fila; sin recargar, se escribe el código y se pulsa "Guardar" dos
  veces seguidas → queda una sola fila, la del PDF, con el código. Antes quedaban dos filas o el
  guardado fallaba. El código de prueba se borró después.
