# Fix: PDF de la Ficha Técnica — clases completadas, fecha y hora, y doble clic
> id: fix-292-m-pdf-de-la-ficha-tecnica-clases-completadas-y-doble-clic
> refs: ASG-i-024
> status: done
> closed: 2026-10-04
> created: 2026-10-04

## Root Cause
Defectos del informe "Ficha Técnica" (B30 de la 2ª pasada de `fix-264-m`, `024b` E05 y E06):

1. **"Pendiente de sesión" en clases ya hechas.** La Edge Function `generate-ficha-tecnica-pdf` no
   sabía si una clase está completada: su modelo solo tenía `ausente` y `cancelada`, así que toda
   clase sin observaciones caía en "Pendiente de sesión". La pantalla sí lo distingue
   (`clase.completada`).
2. **Fecha y hora distintas de la pantalla.** Encontrado al bajar el PDF que genera hoy la función
   desplegada: la fecha sale "18/8" y la hora "04:40 p. m." (la pantalla muestra "18-08" y
   "16:40"). En `es-CL`, `toLocaleDateString` ignora "2 dígitos" y `toLocaleTimeString` usa el
   reloj de 12 horas.
3. **Dos clics rápidos = dos PDF.** `imprimirFicha()` no revisaba si ya había una generación en
   curso; el botón se deshabilita recién cuando la vista se vuelve a pintar.

**Descartado:** la columna "Val." cortada que anotó la 2ª pasada. En el PDF desplegado y en el
generado en local la columna cabe entera (la tabla mide 505 pt en 515 disponibles); lo que se vio
cortado era el visor del navegador.

## ACs Afectados
- `024b` E05: una clase completada sin observaciones deja la columna Observaciones vacía; fecha
  `dd-mm` y hora de 24 h, en hora de Chile.
- `024b` E06: dos clics rápidos en "Imprimir Informe" generan un solo PDF.

## Cambio
- **Archivo:** `supabase/functions/_shared/ficha-tecnica-pdf.ts` (nuevo) — el armado del PDF sale
  de `index.ts` a un módulo sin dependencias de red, para probarlo con `deno test`. Suma
  `completada` al modelo de la clase y `fechaHoraClase()`.
- **Archivo:** `supabase/functions/generate-ficha-tecnica-pdf/index.ts` — usa el módulo, manda
  `completada` (`status = 'completed'`) y arma fecha y hora con `fechaHoraClase()`.
- **Archivo:** `src/app/features/admin/alumno-detalle/ficha-tecnica-drawer/admin-ficha-tecnica-drawer.component.ts`
  — `imprimirFicha()` no hace nada si ya está generando.

## Test de Regresión
- `deno test supabase/functions/_shared/ficha-tecnica-pdf.test.ts` ✓ (9 tests)
- PDF de muestra generado en local y revisado a la vista: clases completadas en blanco, tildes y ñ
  correctas, columna de validación entera.

## Despliegue
- `generate-ficha-tecnica-pdf` desplegada por Matías el 2026-10-04. PDF bajado desde la app
  (alumno 2815) y revisado: las 5 clases completadas en blanco, fechas "18-08" … "05-10" y horas
  de 24 h.

## Sin test automático
- El doble clic (3) no tiene test automático: el guard es una línea y probarlo exige montar el
  drawer con sus cuatro dependencias. Se comprueba a mano con dos clics rápidos.
