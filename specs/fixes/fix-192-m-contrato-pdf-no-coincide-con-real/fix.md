# Fix: Contrato PDF de matrícula no coincide con el contrato físico real

> id: fix-192-m-contrato-pdf-no-coincide-con-real
> refs: 0009-m-consentimiento-ley-21719 (extiende la cláusula QUINTA que esa spec corrigió)
> status: done
> created: 2026-08-18
> closed: 2026-08-19

## Root Cause

`buildStructuredPdf()` (`supabase/functions/_shared/contract-pdf.ts`) genera un contrato inventado
desde cero — nunca se construyó a partir del documento físico real que la escuela usa y hace firmar
en papel. El dueño adjuntó una foto del contrato real de Clase B de Conductores Chillán (folio N°
3564, firmado 24-07-2026) y confirmó que **no se parece en nada** al PDF que produce el sistema hoy:
membrete distinto, texto de identificación de partes distinto (prosa vs. tabla de filas), y las 5
cláusulas reales (asistencia, clases teóricas por Zoom, examen práctico, cambio de instructor/vehículo,
condiciones económicas) no existen en el PDF actual — que en cambio inventa cláusulas propias
(objeto del contrato, política de devolución, vigencia) que no están en el documento real.

Un contrato generado por el sistema que no coincide con el que la escuela realmente usa **no es
válido como evidencia** ante una fiscalización ni reemplaza al proceso real de firma.

## ACs Afectados

Ninguno de una spec cerrada formalmente, pero extiende 0009-m AC1: esa spec corrigió el contenido
legal de la cláusula de datos personales (QUINTA) asumiendo una estructura de contrato que resulta
ser ficticia. Este fix reemplaza la estructura completa por la real y conserva el contenido legal
de datos personales ya corregido, reubicándolo donde corresponda en el documento real.

## Cambio

- **Archivo:** `supabase/functions/_shared/contract-pdf.ts`
- **Qué cambia:** Rediseño de `buildStructuredPdf()` para replicar el layout y el texto del contrato
  físico real (membrete de la sede, párrafo de identificación de partes en prosa, cláusulas
  PRIMERO–QUINTO reales de Conductores Chillán/Clase B), adaptado por sede (Conductores Chillán vs.
  Autoescuela Chillán/OTEC) y por tipo de curso (Clase B vs. Profesional — pendiente de contrato
  físico de referencia, lo sube el dueño). Se agrega una cláusula nueva de protección de datos
  (Ley 21.719) que no existe en el documento físico actual, manteniendo todo en una página.

## Bugs adicionales encontrados y corregidos (mismo root cause: nadie había validado esto contra
la realidad)

1. **`public-enrollment/index.ts` — `handleSubmitClaseB`**: llamaba a `generateAndSaveFinalContract`
   con una variable `branch` **nunca declarada** en ese scope (`ReferenceError` en runtime) y un
   `course` que solo traía `.id` (el resto de campos —`name`, `base_price`, etc.— llegaban
   `undefined`). El contrato firmado del flujo público de Clase B nunca se generaba. Corregido:
   se amplió el `select()` de `course` y se agregó el fetch de `branch` antes de generar el PDF.
2. **`generate-contract-pdf/index.ts`**: importaba `escapePdfWinAnsi`, `wrapTextToLines` y
   `assemblePdf` desde `contract-pdf.ts`, que nunca los reexporta (son imports internos de ese
   módulo). Import de un nombre inexistente → error de carga del módulo ESM. Ninguno se usaba en
   el archivo; se eliminaron.
3. Los tres `select()` de `branches` que alimentan `EnrollmentData` (en `public-enrollment/index.ts`
   ×2 y `generate-contract-pdf/index.ts`) no traían `slug`/`email`/`phone`, campos que el código ya
   intentaba leer — llegaban `undefined` en silencio. Ampliados los tres.

## Huecos de datos conocidos, no resueltos acá (documentados en el código, no fabricados)

- Nº de boleta y monto abonado al firmar (cláusula económica real, QUINTO) — `EnrollmentData` no
  los modela; se usa precio total/neto en su lugar.
- Nivel educacional (Clase B) y licencia previa + fecha de otorgamiento (Profesional) — se omiten
  de la prosa de identificación de partes en vez de inventarlos.
- `APP_BASE_URL` (dominio de la app para el enlace a la Política de Privacidad) sigue **pendiente
  de confirmar** por el negocio — mismo hueco que ya existía antes de este fix, ahora aislado del
  dominio comercial de cada sede (que sí se confirmó, ver `BRANCH_LEGAL`).
- El contrato profesional de referencia (folio 4686) es A2/A4; A3/A5 solo se ajustó la duración
  (160 h vs 150 h, confirmado por el dueño) — el resto del texto se asume igual hasta verificar
  contra un físico A3/A5 real.

## Ronda 2 (18-08-2026, feedback del dueño tras ver el primer render real de la app)

Correcciones sobre el layout de la ronda 1, que estaba estructuralmente correcto pero con
desviaciones visuales del físico:

- Membrete y título en MAYÚSCULAS y **subrayados** por su propio ancho de texto (no el ancho de
  página) — como el físico. Nuevo helper `TCU` (texto centrado + subrayado).
- Línea de contacto: sin la ciudad repetida (`streetOnly()`), fono en dígitos corridos sin código
  de país (`localPhoneDigits()`: `+56 42 224 4030` → `422244030`, el bug exacto que se reportó).
- Nº de matrícula movido a la esquina superior derecha (antes iba pegado al título).
- **Foto carnet del alumno, esquina superior derecha**: sí se pudo resolver — ya existe una foto
  real subida a `students/{enrollmentId}/id_photo` (Storage, bucket `documents`) en el paso previo
  del wizard, antes de que se genere el contrato. `tryLoadIdPhoto()` (nuevo, exportado desde
  `contract-pdf.ts`) la trae vía signed URL en las dos Edge Functions; best-effort, si no existe el
  contrato se genera igual sin la foto. No requería ningún asset nuevo, solo conectar un dato que
  ya se guardaba.
- Espaciado general aumentado (line-height 12→13, gaps entre bloques 4→6, membrete más aireado) sin
  perder la 1 página — quedó ajustado por iteración: la variante más larga (Profesional) cierra con
  ~23pt de margen sobre el mínimo, sin overflow.
- Firmas: nombre de la escuela y del alumno en MAYÚSCULA, negrita, tamaño 12 (antes 9pt regular).

## Ronda 3 (18-08-2026) — el logo sí existía

La ronda 2 daba por cerrado "no hay ningún archivo del logo en el repo" — cierto, pero incompleto:
el dueño señaló que **3 Edge Functions ya lo usan** (`generate-certificate-b-pdf`,
`generate-certificate-professional-pdf`, `generate-student-license-pdf`), vía una constante
`LOGO_URL` que apunta al bucket público `assets` de Supabase Storage
(`chillan_capacita.png`) — no al repo. Buscar solo en `src/`/`public/` fue insuficiente; había que
revisar cómo otros generadores de PDF ya resolvían el mismo problema.

- `assemblePdf()` (`pdf-utils.ts`) solo soportaba 2 imágenes (`logo`→`Im1`, `photo`→`Im2`), y el
  contrato ya usaba ambos slots (idPhoto en `Im1`, firma en `Im2`). Se agregó un tercer slot
  opcional (`extra`→`Im3`) — parámetro nuevo al final, no rompe ninguno de los otros 4 callers
  existentes de `assemblePdf`. Se refactorizó la triplicación de código de embebido de imagen a un
  helper `embedImage()` compartido.
- `buildStructuredPdf()` gana un 4º parámetro `logo`, dibujado en la esquina superior izquierda
  (55×55pt, junto al margen). El `idPhoto` se reubicó de `Im1` a `Im3` para dejarle `Im1` al logo.
- `tryLoadIdPhoto` vive en `contract-pdf.ts`, pero `LOGO_URL` se dejó **duplicado en cada Edge
  Function caller** (`generate-contract-pdf/index.ts`, `public-enrollment/index.ts`) en vez de
  centralizarlo en `_shared/`, replicando el patrón que ya usan los otros 3 generadores — no se creó
  una convención nueva para una sola constante.
- Verificado con imágenes PNG 1×1 sintéticas simulando logo+foto+firma simultáneos: las 3 quedan en
  slots `Im1`/`Im2`/`Im3` distintos, sin colisión visual (logo bajo el nombre de marca, foto bajo el
  folio, título centrado entre ambos sin solaparse), y sigue en 1 página.

## Ronda 4 (19-08-2026) — el primer render real (no un fixture) destapó 4 bugs

El dueño probó con un enrollment real de la nube y mandó capturas del PDF generado. Las
verificaciones con fixtures de rondas 1–3 no los agarraron porque usaban imágenes 1×1 (sin
proporción real que deformar) y textos cortos (sin suficiente longitud para que se notara el
ragged-right). Con datos reales aparecieron:

1. **"N° ?" en vez de "N° -".** No era el número — era el propio carácter de fallback. `'—'`
   (guion largo, U+2014) no es un código WinAnsi de un solo byte alcanzable por el mapeo directo
   0–255 que hacía `escapePdfWinAnsi()` (`pdf-utils.ts`): en CP1252/WinAnsi, el rango 0x80–0x9F
   **no coincide** con los mismos puntos Unicode (a diferencia de 0xA0–0xFF, que sí son Latin-1
   directo), así que cualquier guion largo, comilla tipográfica o bullet caía al `else out += '?'`
   de emergencia. **Bug de raíz, no solo del contrato** — afecta a cualquier PDF generado por
   cualquiera de los ~7 generadores que comparten `pdf-utils.ts`. Corregido con una tabla de mapeo
   `WINANSI_HIGH` para los caracteres tipográficos comunes (guiones, comillas, bullet, elipsis).
2. **Foto y logo deformados.** Se dibujaban forzando el `cm` a una caja fija (60×75, 55×55) sin
   preservar la proporción original de la imagen — cualquier foto que no fuera exactamente esa
   proporción salía estirada/aplastada. Nuevo helper `fitContain()`: encaja la imagen dentro de la
   caja preservando su aspect ratio real (`img.width/img.height`), nunca la deforma.
3. **La foto se superponía al párrafo de identificación de partes.** El bloque de membrete
   reservaba altura fija asumiendo que logo/foto no bajaban de cierto punto; con una foto real
   (proporción distinta a la sintética 1×1 de las rondas previas) su borde inferior invadía las
   primeras líneas del párrafo siguiente. Rediseñado como 3 "columnas" independientes (logo |
   nombre/subtítulo/contacto | folio+foto), cada una con su propio punto final; la regla horizontal
   y el título recién se dibujan bajo **la más baja de las tres** (`headerBottom`), así ninguna
   imagen puede invadir el cuerpo sin importar su proporción real.
4. **Texto sin justificar (ragged-right).** El físico justifica ambos márgenes. Agregado
   `drawJustified()`: reparte el espacio sobrante de cada línea (salvo la última de cada bloque)
   entre las palabras vía el operador PDF `Tw` (word spacing), calculado con `textWidth()` contra
   el ancho imprimible real (485pt). Con un tope de 6pt de espaciado extra por palabra — si una
   línea quedaría con un espaciado antinaturalmente grande (palabra larga que fuerza un corte
   temprano), se deja sin justificar en vez de estirarla de forma que se note peor que no
   justificarla.

Ajuste de espaciado consecuente: la cabecera con foto/logo real ocupa más alto que la versión solo
texto de la ronda 2, así que se recuperó margen en el cuerpo (line-height 13→12.5, `MB` 45→38,
reserva de firma 60→42) para seguir en 1 página con margen real (no sintético).

## Ronda 5 (19-08-2026) — feedback sobre el render de la ronda 4, con datos reales de nuevo

1. **Logo "enano".** `fitContain()` lo encajaba en una caja **cuadrada** (62×62); el logo real
   (`chillan_capacita.png`, confirmado en `generate-class-book-pdf/logo_const.ts`: 231×106px,
   ratio ≈2.18:1, landscape) quedaba forzado a 62×28 — una franja chica. Igual que
   `generate-certificate-b-pdf` (que ya usa este logo con `logoH = 70` fijo, ancho libre), se pasó
   a una caja **no cuadrada** (150×52): altura generosa, ancho libre según la proporción real.
2. **El folio iba arriba de la foto; en el físico va abajo.** Invertido el orden de dibujo: foto
   primero (ancla arriba), folio debajo del borde inferior de la foto.
3. **"N° -" en el preview (sin enrollment aún).** Cierto que no hay `enrollments.number` todavía,
   pero `get_next_enrollment_number()` (la misma función Postgres que asigna el correlativo real)
   es de **solo lectura** hasta que un `enrollment` se inserta con ese número — no reserva nada, así
   que llamarla desde el preview es segura. `handleGenerateContractPreview` ahora la invoca y
   muestra el número previsto (puede diferir del final si otra persona matricula en el mismo curso
   entre el preview y la confirmación — es una previsión, no una garantía; no hay forma de
   garantizarlo sin reservar el número, que es justo lo que la función deliberadamente no hace).
4. **Línea divisoria de más.** El título "PRESTACIÓN DE SERVICIOS..." se dibujaba con `TCU`
   (subrayado a su propio ancho), y como el texto es casi tan ancho como la página, su subrayado
   quedaba pegado a la regla horizontal de arriba — dos líneas casi idénticas en muy poco espacio,
   leídas como "una de más". El dueño solo pidió subrayar **nombre de marca y subtítulo**
   ("CONDUCTORES CHILLÁN" / "ESCUELA DE CONDUCTORES..."); el título del tipo de curso no lleva
   subrayado en el físico. Cambiado a `TC` (centrado, sin subrayar).
5. **Texto "sigue sin estar justificado del todo".** La causa real: `wrapLines()` (de
   `pdf-utils.ts`) envuelve por **conteo de caracteres** (98 por línea), no por ancho renderizado —
   Helvetica no es monoespaciada, así que dos líneas con el mismo conteo de caracteres pueden pesar
   pixeles muy distintos. Eso dejaba líneas muy lejos del ancho objetivo, que el tope de seguridad
   de `Tw` (6pt por espacio) rechazaba justificar, produciendo un resultado mixto: algunas líneas sí
   se estiraban, otras no. Nuevo `wrapToWidth()`: envuelve por ancho real en puntos (`textWidth()`),
   así cada línea ya llega casi llena antes de justificar — el `Tw` que hace falta después quedó
   chico y parejo (0–4pt típico en vez de 0–7pt+). De paso, líneas más llenas → **menos líneas
   totales** por bloque, lo que ayudó a compensar el espacio extra que pidió el punto 6.
6. **Firma pegada al texto, sin espacio para firmar a mano.** El salto antes de la línea de firma
   era de 18pt; subido a 40pt. Compensado recuperando espacio en otro lado (ver punto 5) para
   seguir en 1 página — el `need()` de esa sección se ajustó a la altura real usada (56, no un
   valor sobredimensionado) para no gatillar un salto de página innecesario.

## Ronda 6 (19-08-2026) — la ronda 5 sí se desplegó, pero la justificación seguía mal

El dueño confirmó redeploy y que el PDF ya reflejaba los cambios de la ronda 5 (título subrayado
sin regla de más, ver evidencia). Pero la justificación seguía viéndose mal: algunas líneas
llegaban al margen derecho y otras no, de forma visiblemente inconsistente.

Verificación matemática de mi propio código: calculando a mano el ancho renderizado de cada línea
justificada con el mismo `textWidth()` que usa `drawJustified`, **todas** las líneas no-últimas de
un bloque caían exactamente en x=540.0 (el margen derecho real) — el cálculo del `Tw` era
correcto. La discrepancia entre "mi cálculo dice que está bien" y "se ve mal en el render" apunta a
una sola explicación: **el operador `Tw` (word-spacing) no se estaba respetando en el pipeline que
generó las capturas**, aunque es PDF estándar desde la v1.0 — algunos rasterizadores/generadores de
miniatura simplificados lo ignoran, y sin `Tw` el texto vuelve a su ancho "natural" sin estirar, que
sí varía mucho línea a línea (Helvetica no es monoespaciada) — exactamente el patrón reportado.

**Solución que no depende de que nadie interprete `Tw`:** se reemplazó el enfoque por posicionamiento
manual palabra por palabra. `TJustifiedLine()` calcula el ancho de cada palabra y el espacio exacto
entre ellas, y emite un `Td` relativo por palabra (`dx = ancho_palabra_anterior + espacio_calculado`)
en vez de un solo `Tj` con `Tw` global. Es matemáticamente equivalente (la suma de anchos de palabra
+ espacios da exactamente el ancho objetivo, `x0 + TEXT_WIDTH`), pero la posición de cada palabra
queda **explícita** en el stream — no hay ningún parámetro de espaciado que un renderizador simplón
pueda ignorar. Costo: streams de contenido más largos (un `Tj` por palabra en vez de por línea), sin
impacto real en tamaño de archivo ni rendimiento a esta escala.

## Ronda 7 (19-08-2026) — la justificación seguía imperfecta incluso sin `Tw`

Con el posicionamiento manual ya en producción, el dueño reportó que la justificación mejoró pero
seguía sin llegar perfecta al margen derecho. Causa raíz real, esta vez sí: **la tabla `HV_REG`/
`HV_BOLD` de anchos de Helvetica en `pdf-utils.ts` no coincidía con las métricas oficiales Adobe
AFM** — varios caracteres estaban "engordados" (ej. `C` 667→722 real, `L` 611→556 real, `i`/`j`/`l`
278→222 real, la mayoría de minúsculas 50-60/1000 más anchas de lo real). Como `TJustifiedLine()`
calcula la posición de cada palabra a partir de `textWidth()`, una tabla de anchos incorrecta hace
que la posición calculada no coincida con dónde el glifo **realmente** se dibuja — sin importar
cuán exacta sea la aritmética del posicionamiento manual, si el insumo (el ancho de cada letra) está
mal, el resultado se queda corto del margen. Corregida la tabla completa contra el AFM oficial de
Helvetica y Helvetica-Bold (ambas fuentes base del documento). Como `pdf-utils.ts` es compartido,
esto también mejora la precisión de centrado de texto en los otros ~6 generadores de PDF del
proyecto que lo usan — no es un cambio exclusivo del contrato.

De paso: `LEGAL_REPRESENTATIVE.name` había quedado como `'Jorge Pérez Godoy C.'` desde la ronda 3
(deducido, sin verificar el físico letra por letra); el dueño confirmó contra el documento real que
el nombre no lleva ese ". C" final y lo corrigió a `'Jorge Pérez Godoy'`. Se agregó también logging
del error de `get_next_enrollment_number()` en el preview (antes se descartaba en silencio) para
poder diagnosticar por qué el folio seguía en "N° -" pese al redeploy confirmado — pendiente de
revisar en los logs de Supabase la próxima vez que se reproduzca.

## Ronda 8 (19-08-2026) — el folio seguía en "N° -" porque estaba arreglando el flujo equivocado

Confirmado con evidencia (Ronda 6-7: título subrayado y justificación ya reflejaban el código
nuevo) que el redeploy sí estaba surtiendo efecto — pero el "N° -" seguía. La razón: **el dueño
prueba el contrato desde el wizard de matrícula de secretaría/admin, no desde el flujo público**.
Todas las rondas anteriores del fix del folio (RPC "peek") se habían aplicado en
`public-enrollment/index.ts` (`handleGenerateContractPreview`) — el código correcto para el flujo
público, pero **irrelevante** para secretaría, que llama a una Edge Function completamente distinta
(`generate-contract-pdf`, invocada desde `EnrollmentFacade.generateContract()` con solo
`enrollment_id`).

Confirmado por qué ahí "N° -" era el comportamiento real (no un bug de renderizado): el wizard de
secretaría genera/previsualiza el contrato en el **paso 5** (antes de la confirmación final), y
`enrollments.number` recién se asigna en la confirmación (`EnrollmentFacade.generateEnrollmentNumber()`,
que ya existía y usa la misma RPC). El draft en paso 5 nunca tuvo un número que mostrar.

**Fix:** el mismo patrón de "peek" ya usado en el flujo público, ahora también en
`generate-contract-pdf/index.ts` — si `enrollments.number` es `null`, llama a
`get_next_enrollment_number(enrollment.course_id)` (agregado `course_id` al `select()`) antes de
generar el PDF, sin persistir nada. Mismo logging de error que la ronda anterior, para diagnosticar
si vuelve a fallar.

## Ronda 8 (bis) — orden del nombre del alumno

En las dos partes donde el físico imprime el nombre del alumno (identificación de partes y firma),
el orden real es **apellido paterno, apellido materno, nombres** (ej. "VENEGAS ESPINOSA VANESSA
BELÉN", folio 3564) — al revés del orden "nombres + apellidos" que usa el resto de la UI del
sistema. `fullName` en `buildStructuredPdf` se reordenó; como ambos usos (párrafo y firma) leen la
misma variable, el fix aplica a los dos puntos con un solo cambio.

## Ronda 9 (19-08-2026) — número confirmado funcionando; "9 clases" era un bug real

El dueño confirmó que el folio ya funciona en secretaría (ronda 8). Reportó un bug nuevo: la
cláusula PRIMERO decía "9 clases prácticas" en vez de "12". Causa: confundí `practical_hours` (un
campo de **horas totales**, 9 para este curso) con la **cantidad de clases** (12, fija — cada clase
dura 45 min, normado por Decreto 39/1985, no varía por curso). El físico siempre dice 12 porque es
un valor regulatorio, no un dato de `courses`. Revertido a literal `12` en vez de leer
`data.course.practical_hours`. La cláusula SEGUNDO (clases teóricas) no se tocó — no fue reportada
como incorrecta y para este curso coincide por casualidad (`theory_hours = 12`); queda como posible
punto ciego si algún curso real tiene `theory_hours` distinto de 12, pero no se toca sin evidencia
de que sea un problema real (no inventar un segundo fix sobre una sospecha).

## Ronda 10 (19-08-2026) — QUINTA recortada de más

Al simplificar la cláusula económica en la ronda 1 (por no tener Nº de boleta), corté una oración
entera del físico que sí se podía reconstruir: *"que el Alumno paga en este acto la cantidad de
$Y, quedando un saldo de $W, que se deberá pagar en la SEXTA CLASE"*. El único dato del físico que
de verdad no existe en el sistema es el **Nº de boleta** — el monto pagado y el saldo sí están en
`enrollments.total_paid`/`pending_balance` (mantenidos por trigger sobre `payments`), simplemente no
los estaba leyendo.

- `EnrollmentData` gana `total_paid`/`pending_balance` (opcionales).
- `generate-contract-pdf/index.ts`: agregados al `select()` de `enrollments` — ya venían en la
  misma fila que `base_price`/`discount`, no hacía falta una query aparte.
- `public-enrollment/index.ts` (`generateAndSaveFinalContract`, usada por ambos callers del flujo
  público): el enrollment se acaba de crear en la misma invocación, así que no venía en ningún
  select previo — se agregó un fetch puntual por `enrollmentId` justo antes de construir
  `EnrollmentData`.
- El preview (`handleGenerateContractPreview`, sin enrollment aún) no puede tener estos datos —
  queda con el fallback ya existente (asume pagado al contado, saldo $0), razonable para una vista
  previa antes de que exista un pago real.
- Cláusula QUINTO reescrita: `El valor acordado del curso es de $X..., que el Alumno paga en este
  acto la cantidad de $Y, quedando un saldo de $Z, que se deberá pagar en la SEXTA CLASE.` seguido
  del resto del texto real (término anticipado, cobranza) sin cambios.

## Ronda 11 (19-08-2026) — "paga $0, saldo $180.000" con `payment_mode = 'partial'`

El dueño explicó la causa exacta: el paso 2 del wizard ya elige `payment_mode` ('total' | 'partial'
= 50%, `assignment.component.html:110`, "Se paga el 50% ahora"), pero el **pago real** (que
alimenta el trigger de `total_paid`) recién se registra **después** del paso 5 donde se genera el
contrato. La ronda 10 asumía que `total_paid = 0` significaba "no pagó nada, previsiblemente pagará
todo" — pero para `payment_mode = 'partial'` la previsión correcta es la mitad, no el total.

- `EnrollmentData` gana `payment_mode?: 'total' | 'partial' | null`.
- Conectado en `generate-contract-pdf/index.ts` (mismo `select`) y en
  `public-enrollment/index.ts` (mismo fetch puntual de la ronda 10, se le agregó la columna).
- Cláusula QUINTO: si ya hay un pago real (`total_paid > 0`), se usa ese valor tal cual (fuente de
  verdad). Si no, se prevé: `partial` → mitad del precio neto, `total`/sin dato → precio neto
  completo. El saldo SIEMPRE se deriva del mismo `paid` que se imprimió — nunca se mezcla un saldo
  real de "nada pagado todavía" con un pago previsto de "la mitad" (habría sumado más que el precio
  del curso).
- Único dato que sigue sin poder reconstruirse: el Nº de boleta (no hay ese concepto en el sistema
  antes del paso de pago).

## Test de Regresión

- Script ad-hoc (`buildStructuredPdf` con fixtures de Clase B y Profesional A2/A4/A3/A5, ambas
  sedes, con y sin logo/foto/firma simulados **con proporciones no cuadradas** —logo 200×80,
  foto 400×600, reproduciendo el caso real que las rondas 1–3 no cubrían): las variantes generan
  exactamente 1 página (`/Count 1`) tras cada ronda de ajuste de espaciado, y ninguna línea
  envuelta supera el ancho imprimible (485pt @ tamaño 10).
- Reproducido el bug del "N° ?" con `data.number = null`: ahora imprime `N° -`, no `N° ?`.
- Verificado por inspección del content stream que el logo y la foto se dibujan con `cm` no
  cuadrado proporcional a su `width/height` real (no forzado a la caja), y que la regla horizontal
  y el título se dibujan por debajo de `Math.min()` de las 3 columnas del header — sin overlap de
  coordenadas Y con la primera línea del párrafo, incluso con la foto más alta usada en la prueba.
- Verificado que `Tw` (word-spacing) aparece en las líneas justificadas y es `0.000` en la última
  línea de cada bloque (alineada a la izquierda, no estirada).
- Ronda 5: reproducido con el aspect ratio real del logo (231×106) y una foto carnet plausible
  (480×640, 3:4) — 4/4 variantes en 1 página. Verificado por inspección del stream que el folio se
  dibuja DEBAJO del borde inferior de la foto (no arriba), que el título ya no lleva `HL` propio
  (solo la regla horizontal única persiste), y que los valores de `Tw` con `wrapToWidth` quedaron
  en el rango 0–3.6pt (antes 0–4.5pt+ con líneas dispersas sin justificar).
- Ronda 6 (final): confirmado post-redeploy que el stream **ya no contiene el operador `Tw`** en
  ningún punto (`/ Tw /.test(stream) === false`) — la justificación se resuelve 100% con `Td`
  explícito por palabra, sin depender de que el visor/rasterizador interprete word-spacing.
  4/4 variantes (Clase B ×2 sedes, Profesional A4, Profesional A3) siguen en exactamente 1 página
  con logo+foto+folio simultáneos, y el folio con `number = null` sigue mostrando `N° -` (nunca
  `N° ?`) — `deno check` y `deno lint` verdes.
- Contenido verificado línea por línea contra las fotos de los dos contratos físicos reales
  (folio 3564 Clase B, folio 4686 Profesional A4): mismo membrete (mayúsculas, subrayados, fono en
  dígitos), mismo folio en la esquina, misma identificación de partes, mismas cláusulas
  PRIMERO–QUINTO reales, más SEXTO (Ley 21.719, no existe en el físico) y SÉPTIMO condicional
  (convalidación, sin cambios).
- `deno check` y `deno lint` verdes en los 3 archivos tocados (`_shared/contract-pdf.ts`,
  `generate-contract-pdf/index.ts`, `public-enrollment/index.ts`) — sin errores nuevos más allá del
  estilo `no-explicit-any` preexistente en todo el proyecto.
- Pendiente: QA visual real en navegador/PDF renderizado (`/verify` no aplica — no es UI Angular) y
  confirmar que `tryLoadIdPhoto` efectivamente encuentra la foto en un enrollment real de la nube.
