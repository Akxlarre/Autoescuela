# Fix: Carnet Clase B (6 y 12 clases) — rediseño visual retroactivo
> id: fix-083-m-carnet-clase-b-rediseno-visual
> refs: —
> status: done
> closed: 2026-07-27
> created: 2026-07-27

## Root Cause
No es un bug de lógica: el carnet PDF generado por `generate-student-license-pdf`
(construido a mano con operadores PDF crudos en `buildCarnetPdf()`) se había alejado
visualmente del carnet físico que la autoescuela imprime y usa hoy — dimensiones
distintas (A5 595×421pt en vez de 8.5×5.9in), fondo pastel amarillo/verde según plan
pagado (6 o 12 clases) que ya no se necesita porque en la práctica usan papel de color
en vez de imprimir el color, tabla desproporcionada, tipografía pequeña/no negrita,
columna "Firma Instructor" muy ancha, bloque de logo/colegio pegado al borde superior,
subrayado incompleto en "V.- CLASES PRÁCTICAS", y un typo ("Uónete" en vez de "Únete"
por un escape `\xF3`/ó en vez de `\xDA`/Ú). Se contrastó contra PDFs reales del carnet
físico (6 y 12 clases) provistos por el usuario.

Los cambios se hicieron directamente sobre el código de producción
(`supabase/functions/generate-student-license-pdf/index.ts` y
`supabase/functions/_shared/pdf-utils.ts`) sin abrir un track SDD primero — este fix
se crea retroactivamente para dejar trazabilidad, ya cerrado porque el trabajo ya fue
validado visualmente por el usuario contra los PDFs reales.

## ACs Afectados
Ninguno — no hay spec previa para el carnet; es un fix autónomo de fidelidad visual.

## Cambio
- **Archivo:** `supabase/functions/generate-student-license-pdf/index.ts`
  - Página A5 595×421pt → 612×425pt (8.50 × 5.90 in landscape), igual para ambas
    variantes (antes el carnet de 12 heredaba dimensiones distintas del físico).
  - Eliminado el fondo pastel condicional por `variant` (amarillo para 6 clases,
    verde para 12) — el papel de color se aplica físicamente al imprimir, no en el PDF.
  - Eliminada la barra vertical divisoria central entre columna izquierda/derecha.
  - Eliminado el texto "Completada" que se imprimía en las filas 1-6 de la columna
    "Firma Instructor" del carnet de 12 clases — ahora queda en blanco como en el físico.
  - Tabla "V.- CLASES PRÁCTICAS" rehecha: más angosta, columnas parejas entre sí
    (antes "Firma Instructor" era desproporcionadamente ancha), encabezados
    centrados vertical y horizontalmente dentro de una celda de header más alta
    (`HDR_H=20`) y partidos en dos líneas cuando no caben en una ("Hora"/"inicio",
    "Hora"/"Término", "Firma"/"Instructor"), contenido de fila en negrita y tamaño
    grande (`ROW_FONT=9.5`) apretado contra una fila más baja (`ROW_H=16`) para
    igualar la densidad visual del carnet físico.
  - Bloque logo + datos del colegio movido más abajo (`TOP_R_Y = H - 34`, antes
    pegado al borde superior) y foto del alumno movida levemente a la izquierda.
  - Textos "Únete a nosotros… únete a la vida", el correo y la nota azul
    "No olvide llevar consigo…" pasados a negrita; encabezado y links de
    "PÁGINAS WEB PARA PRACTICAR EXAMEN TEÓRICO" agrandados (7→9.5pt y 6.5→8.5pt).
  - Eliminado el link del sitio web (`SCHOOL.website`) del bloque de datos del colegio.
  - Corregido typo `'U\xF3nete...'` ("Uónete") → `'\xDAnete...'` ("Únete").
  - Espacio agregado entre la tabla y la fila APROBADO/REPROBADO (carnet de 6 clases),
    antes quedaba pegada al borde inferior de la tabla.
  - Subrayado de "V.- CLASES PRÁCTICAS" con +2pt de margen para cubrir el texto
    completo pese a la imprecisión residual de `textWidth()`.
- **Archivo:** `supabase/functions/_shared/pdf-utils.ts`
  - Agregadas métricas de ancho para caracteres acentuados españoles (Á É Í Ó Ú Ñ Ü
    y minúsculas) en `HV_REG`/`HV_BOLD`, que antes caían al ancho por defecto y
    subestimaban el largo de textos con tildes — causa raíz de que el subrayado de
    "V.- CLASES PRÁCTICAS" quedara corto. Beneficia a todos los generadores de PDF
    que comparten este util (certificados, libro de clase, contrato, etc.), no solo
    el carnet.

## Test de Regresión
No hay test automatizado — la función es un Edge Function que ensambla PDF con
operadores crudos (sin test harness Deno configurado en este repo) y la validación
fue visual: el usuario comparó los PDFs generados contra los carnets físicos reales
(6 y 12 clases) en cada iteración hasta confirmar "ahora sí quedó perfecto".
Desplegado (`supabase functions deploy generate-student-license-pdf`) y verificado
en producción por el usuario — correcto.
