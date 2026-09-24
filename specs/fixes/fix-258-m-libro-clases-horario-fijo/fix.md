# Fix: Horario del Libro de Clases pasa a texto fijo (deja de ser editable)
> id: fix-258-m-libro-clases-horario-fijo
> refs: fix-098-m-codigo-autorizacion-libro-editable
> status: done
> closed: 2026-09-22
> created: 2026-09-22

## Root Cause
El dueño pidió que en el Libro de Clases (curso profesional), el campo "Horario" deje de
ser un input de texto libre editable por sede/curso y pase a ser un valor fijo para toda
la escuela: "Lunes a Viernes de 17:30 a 22:30 hrs. Sábado de 9:00 a 14:00 hrs." Hoy
`class_book.horario` es texto libre editable (junto al Código SENCE, ver fix-098-m), pero
el horario real de la escuela no varía por curso — dejarlo editable solo agrega
posibilidad de error/inconsistencia sin ningún beneficio.

## ACs Afectados
Ninguno — fix autónomo, no deriva de una spec con ACs.

## Cambio
- **`src/app/features/libro-de-clases/libro-de-clases.component.ts`**: reemplaza el input
  editable de "Horario" por texto estático fijo. Elimina `editHorario` y su uso en
  `hasEditableChanges()` / `onSaveClassBook()`.
- **`src/app/core/facades/libro-de-clases.facade.ts`**: `saveClassBookFields()` deja de
  recibir/escribir `horario`. `loadCabecera()` deja de leer la columna `horario`.
- **`src/app/core/models/ui/libro-de-clases.model.ts`**: `LibroCabecera` pierde el campo
  `horario` (ya no se carga desde BD).
- **`supabase/functions/generate-class-book-pdf/index.ts`**: la fila `HORARIO` del PDF
  usa el mismo texto fijo en vez de `class_book.horario`.
- La columna `class_book.horario` no se elimina (no se justifica una migración solo para
  esto); simplemente deja de leerse/escribirse desde el código.

## Test de Regresión
- `src/app/core/facades/libro-de-clases.facade.spec.ts`: `saveClassBookFields` ya no
  recibe/envía `horario`, y `loadCabecera` no depende de esa columna.
