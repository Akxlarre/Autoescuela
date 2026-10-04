# Fix: PDF de la ficha de matrícula — tildes, concepto del pago y hora
> id: fix-293-m-pdf-de-la-ficha-de-matricula-tildes-concepto-y-hora
> refs: ASG-i-024
> status: done
> closed: 2026-10-04
> created: 2026-10-04

## Root Cause
La Edge Function `generate-enrollment-sheet` tiene su propia función de escape (`pdfStr`) que
**quita las tildes y la ñ** de todo el texto antes de escribirlo, aunque la fuente del PDF está
declarada con `WinAnsiEncoding`, que sí las tiene. Por eso sale "Reyes Munoz", "Telefono",
"practicas", "MATRICULA". Las demás funciones de PDF usan `escapePdfWinAnsi` (`_shared/pdf-utils`),
que las conserva. Además:

- el concepto del pago se escribe con el valor crudo de la base (`enrollment`);
- la hora del pie se arma con `toLocaleString('es-CL')`, que usa reloj de 12 horas con un espacio
  especial que la fuente no tiene: sale "12:10 a.?m.";
- en la cabecera, "FICHA DE MATRÍCULA" y "Generada: …" quedan montados sobre el nombre de la sede y
  el número (visto al bajar el PDF desplegado);
- **la fecha de cada pago sale un día antes** (visto al generar la muestra): `payments.payment_date`
  es una fecha sin hora y se pasaba por `new Date()` + hora de Chile. En el PDF desplegado de la
  matrícula 0080, el pago figura el 21-09 y la matrícula ingresó el 22-09.

Es B27 de la 2ª pasada de `fix-264-m` (`024a` J02).

## ACs Afectados
- `024a` J02: el PDF de la ficha de matrícula conserva tildes y ñ, muestra el concepto del pago en
  español ("Matrícula"), la hora del pie en formato de 24 h y la cabecera sin textos montados.

## Cambio
- **Archivo:** `supabase/functions/_shared/enrollment-sheet-format.ts` (nuevo) — `conceptoPago()`,
  `fechaPago()` y `fechaHoraGeneracion()`, funciones puras.
- **Archivo:** `supabase/functions/generate-enrollment-sheet/index.ts` — escapa con
  `escapePdfWinAnsi`, usa las tres funciones y separa las líneas de la cabecera.
  `buildEnrollmentSheetPdf` queda exportada para poder generar una muestra sin levantar la función.

## Test de Regresión
- `deno test supabase/functions/_shared/enrollment-sheet-format.test.ts` ✓ (8 tests)
- PDF de muestra generado en local y revisado a la vista: "Reyes Muñoz", "Teléfono", "Clases
  prácticas", concepto "Matrícula", pie "04-10-2026, 00:10", cabecera en dos líneas separadas y la
  fecha del pago igual a la guardada.

## Despliegue
- `generate-enrollment-sheet` desplegada por Matías el 2026-10-04. PDF bajado desde la app
  (matrícula 0080) y revisado: tildes y ñ, concepto "Matrícula", pie "04-10-2026, 01:42",
  cabecera separada y el pago con fecha 22-09-2026 (antes 21-09).

## No incluido
- El nombre del archivo descargado sigue con la fecha en UTC (`ASG-i-054`); no se tocó.
