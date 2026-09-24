# Tasks 0017-m — Libro de Clases PDF

## Fase 1 — Fundacional
- [x] Tamaño de página → `1008x612` (Legal horizontal), medido del PDF real.
- [x] Quitar "Profesores por módulo" y "Lista de Clase" de la portada (no existen en el real).
- [x] Portada reescrita como formulario (no grid), con medidas exactas extraídas del Excel
      fuente real (`LIBROS CURSO PROFESIONAL 2020.xlsx`, hoja `LIBRO_A2`): caja angosta
      (700pt, no todo el ancho), 7 campos (fusionando Actividad+ID en uno solo como el real),
      subrayado por campo en vez de grilla completa. Verificado con captura del usuario que
      el diseño anterior (grid de 8 filas a ancho completo) no calzaba.
- [x] Página "ANTECEDENTES DE LOS ALUMNOS" (N°/Apellidos,Nombre/RUN/Nivel Escolaridad/Teléfono/Firma,
      25 filas mínimo, paginado si hay más alumnos) vía helper `drawStudentGridPages()`.
- [x] Asistencia semanal: grilla de 7 días (Lun-Dom), "DOMINGO" fijo en la col. 7, "LIBRE" en
      cualquier día sin sesión (no solo cancelada).
- [x] Página "CONTROL DE ASISTENCIA DE ALUMNOS (Recuperación de Feriados)" con alumnos reales,
      columnas de fecha en blanco, y las 3 notas al pie.

## Fase 2 — Reglamento completo
- [x] `getReglamentoText()` reescrito verbatim con los 30 artículos (Título I a IX).

## Fase 3 — Parcial

### Hallazgos del dueño (PDFs reales aportados: `libroclasesa3.pdf`, `libroclasesa4.pdf`,
`libroclasesa5.pdf` en Downloads, mismo layout de 28 páginas que `libroclases.pdf`/A2)

- **A3** (id 156.3): curriculum prácticamente idéntico a A2 ("Transporte de Pasajeros"),
  **160 horas** totales, 72 filas en el calendario.
- **A4** (id 156.4): cambia a **"Transporte de Carga"** con texto de materias totalmente
  distinto (Decreto 75/87, Decreto 298/95 carga peligrosa, gas licuado, ganado, productos
  forestales) — **no es solo cambiar el nombre**. Totaliza **180 horas** (no 160).
- **A5** (id 156.5): además de "Transporte de Carga", agrega una asignatura que A3/A4 NO
  tienen: **"Manipulación de Cargas y Sust. Peligrosas"** (SAG/SII/Aduana, Ley 18.290 Art.
  62-81). Ojo: la página de Evaluaciones del libro real sigue teniendo solo 7 columnas ahí —
  esa asignatura extra no tiene columna propia en el original (inconsistencia del libro real,
  no la inventemos al replicar). 160 horas totales.
- Los módulos "Ley del Tránsito", "Prevención de Riesgos", "Mecánica", "Conducción" y
  "Aspectos Psicológicos" sí son texto idéntico en las 4 clases — ya cubiertos por
  `getModuleNames()`.
- **Dato sucio detectado en el A5 real** (filas de Mecánica/Prevención de Riesgos): el texto
  de materias dice "vehículos de transporte de pasajeros" por copy-paste del A2/A3, sin
  actualizar para un libro de carga. Al transcribir, corregir la redacción en silencio (no
  propagar el error) o dejarlo anotado si se transcribe verbatim.
- **No hay forma de armar un solo template con find/replace** — cada clase necesita su propio
  texto de materias para el módulo de transporte (y A5 su módulo extra). Confirmado por el
  dueño: "hazlo todo en esta misma spec" (no dividir en specs nuevas), pero **no alcanzó el
  tiempo de esta sesión para transcribir verbatim las ~288 filas** (72 filas × 4 clases) de
  materias — se transcribe sin resumir ni inventar contenido, por ser un documento fiscalizable.

### Hecho en esta sesión
- [x] Evaluaciones: cabecera cambiada de "Mód. N" a nombre real de asignatura, usando
      `d.moduleNames` (mismo orden/fuente que ya usa `getModuleNames()` — confirmado que
      coincide con los 4 libros reales).
- [x] `drawGridTable()`: los headers ahora envuelven por ancho real (`wrapToWidth`) dentro de
      su columna en vez de una sola línea — necesario porque los nombres de asignatura no caben
      en 66pt de ancho a una sola línea (igual que el real, que también los envuelve).

### Corrección del dueño (2026-09-23) — reemplaza el punto de "distribución de horas"
El Libro de Clases es una plantilla imprimible: lo único que se precarga desde la BD son
alumnos (nombre/RUN) y feriados. El Calendario de Clases **NO** debe reflejar
`professional_theory_sessions` fila a fila — imprime la malla curricular FIJA (verbatim del
libro real), igual para cualquier curso de esa clase. `professional_theory_sessions` no tiene
ninguna relación con el Calendario; su único uso legítimo en todo el documento sigue siendo
marcar días LIBRE en la grilla de Asistencia Semanal. Esto **elimina** la necesidad de decidir
un schema de horas-por-sesión (el punto que estaba bloqueando esta fase) — ya no aplica.

**Fecha de cada fila — intento 1 (2026-09-23, descartado):** anclar la fila 1 a
`promo.startDate` y sumar un `offsetDays` fijo (mismo patrón de días del libro real 2022).
**Bug encontrado por el dueño en un caso real:** una clase cayó el 12 de octubre (feriado real
del curso actual, que el libro 2022 no conocía) y el calendario se extendió hasta el 31/10 con
la promoción terminando el 26/10 — el offset fijo no sabe nada de los feriados ni del
`end_date` reales de ESTE curso.

**Fecha de cada fila — intento 2 (2026-09-23, segunda ronda, incompleto):** las fechas SÍ salen
de `professional_theory_sessions` (solo `fecha`+`status`, nunca contenido) — esa tabla ya se
genera acotada al rango real start/end de la promoción con los feriados reales marcados
`cancelled` (`promociones.facade.ts crearPromocion()`). Cada bloque de la malla
(`groupIntoSessionBlocks()`, agrupado por día del libro real) se asignaba, en orden, a la
siguiente fecha activa real, y las 6 filas LIBRE del libro 2022 se descartaban del todo.

**Corrección del dueño sobre el intento 2:** al descartar las LIBRE sin criterio, se pasó de 71
filas (libro real) a 65 (malla sin días libres) sin que el dueño lo pidiera. El dueño notó que 5
de las 6 LIBRE del libro real (filas 20, 34, 45, 58, 71) caen en **sábado** — en la práctica casi
nunca se hace clase ese día aunque el horario en teoría lo permita (la fila 15, miércoles, es
ruido sin explicación de esa cohorte puntual, no un patrón). Pidió usar esto directamente:
**generar siempre una fila LIBRE en cada sábado del rango**, mostrando su celda, en vez de
descartar las LIBRE o depender de si `professional_theory_sessions` generó/canceló ese sábado.

**Intento 3 (2026-09-23, tercera ronda, descartado):** recorrer día por día desde la primera
hasta la última fecha activa real, marcando cada sábado como fila LIBRE automática.

**Investigación del Excel fuente que descartó el intento 3:** el dueño encontró la fórmula real
detrás del PDF (`LIBROS CURSO PROFESIONAL 2020.xlsx`) y se rastreó celda por celda con Python
(`openpyxl`): `LIBRO_A2` → `BUSCARV` a `A2_2` → `VLOOKUP` a `A2_1` → columna "Código Asignatura"
(`A2_1!I7:I77`). Esa columna es un **entero literal tecleado a mano en las 71 filas, sin
excepción** (verificado que ninguna es fórmula) — el código `0` (mapeado a texto "LIBRE" en una
tablita fija de `CALENDARIO!G35`) lo eligió a mano quien armó ESA cohorte 2022. El chequeo de
feriado real de la hoja `CALENDARIO` (contra la lista de feriados oficiales chilenos de
`PLANILLA`) dio **vacío para este curso** — ningún feriado real cae en su ventana. Conclusión:
no existe ninguna fórmula ni regla que derive qué día es LIBRE a partir de fecha/día de
semana/feriado — es 100% una decisión manual de planificación, no replicable ni derivable.

**Por qué el intento 3 quedaba mal igual sabiendo esto:** el dueño confirmó que el horario real
del negocio (validado por don Jorge) es **5 semanas × 6 clases por semana, lunes a sábado** —
el sábado SÍ es un día de clase real en nuestro sistema, a diferencia del libro 2022 donde
casi siempre terminó eligiéndose como descanso. Forzar "sábado = LIBRE" habría tapado con la
palabra LIBRE una clase real que sí existe en nuestros cursos.

**Fix final (2026-09-23, cuarta ronda):** sin inventar ningún día LIBRE. Cada bloque de la malla
(`groupIntoSessionBlocks()`) se asigna, en orden, a la siguiente fecha activa real de
`professional_theory_sessions` (mismo mecanismo del intento 2, sin la caminata día-por-día ni
`isSaturday()`/`isoAddDays()` — se eliminaron por no usarse). Si sobran bloques de malla sin
fecha real disponible, se imprime un aviso al pie en vez de inventar fechas. Nuestro sistema no
tiene el concepto de "día de descanso programático" — solo feriados reales pausan una fecha, y
esos ya vienen resueltos por `professional_theory_sessions`.

### Pendiente (bloqueado por volumen de transcripción, no por decisión de producto)
- [x] Transcribir verbatim el calendario de clases de A2 (71 filas reales — la estimación de
      "72 filas" era incorrecta: la página 26 del PDF real es una tabla vacía sin datos, no una
      fila 72 — fecha/asignatura/materias/horas/profesor) desde `libroclases.pdf` páginas 14-27.
      Vive como `getA2Curriculum()` en `supabase/functions/generate-class-book-pdf/index.ts`.
- [x] Conectar la malla curricular al Calendario de Clases: `getCurriculum(licenseClass)`
      dispatchea a `getA2Curriculum()` para A2; A3/A4/A5 muestran "Pendiente de transcripción
      verbatim" hasta que se transcriban (punto de abajo). Columnas N°/FECHA (real, vía
      `groupIntoSessionBlocks()` + sesiones activas — ver arriba)/ASIGNATURA/MATERIAS/HORAS/
      PROFESOR, envueltas por ancho real y paginadas. `npx tsc --noEmit` sin errores.
- [x] A3 (`libroclasesa3.pdf`) transcrito verbatim: 72 filas reales (68 con contenido + 4
      LIBRE en filas 6/14/15/16 — patrón distinto a A2, que tenía 6 LIBRE sueltas). Curriculum
      casi idéntico a A2 en Ley del Tránsito/Prevención de Riesgos/Mecánica/Conducción/Aspectos
      Psicológicos (texto verbatim reutilizado tal cual, verificado idéntico), pero Transporte
      de Pasajeros usa una selección de tópicos distinta (incluye "III. Servicio de Taxis" y "V.
      Transporte Remunerado de Escolares Decreto 38/92", que A2 no tiene). Vive como
      `getA3Curriculum()` + conectado en `getCurriculum()`. **De paso, se corrigió un error de
      transcripción real en A2**: a `TRANSPORTE_I` se le había escapado la palabra "especiales"
      ("servicios de transporte de pasajeros" en vez de "servicios especiales de transporte de
      pasajeros") — detectado al comparar contra A3, que tiene el mismo párrafo. `npx tsc
      --noEmit` sin errores; conteo de filas verificado con Node (68 contenido + 4 LIBRE = 72).
      Pendiente de verificación visual del dueño.
- [x] A4 (`libroclasesa4.pdf`) transcrito verbatim: 72 filas reales (68 con contenido + 4 LIBRE
      en filas 12/17/18/71). Transporte cambia por completo a "Transporte de Carga" (Decreto
      75/87, Decreto 298/95 carga peligrosa, gas licuado, ganado, productos forestales) —
      confirmado que no era solo cambiar el nombre. Los demás módulos comparten texto con
      A2/A3 salvo notas puntuales: "COMBATE Y PREVENCIÓN DE INCENDIOS" termina en "...de
      transporte de carga." en vez de "...de pasajeros."; aparece un tema nuevo "LAS
      CONDICIONES FÍSICAS ÓPTIMAS PARA CONDUCIR" que A2/A3 no tienen. Erratas del original
      preservadas verbatim ("as drogas", "sustancas", "caracteristicas", "as personas"). Vive
      como `getA4Curriculum()` + conectado en `getCurriculum()`. `npx tsc --noEmit` sin
      errores; conteo de filas verificado con Node (68 contenido + 4 LIBRE = 72). Pendiente de
      verificación visual del dueño.
- [x] A5 (`libroclasesa5.pdf`) transcrito verbatim: 72 filas reales (68 con contenido + 4 LIBRE
      al inicio, filas 1-4 — patrón distinto a A2/A3/A4). Agrega la asignatura extra
      "Manipulación de Cargas y Sust. Peligrosas" (SAG/SII/Aduana, Ley 18.290 Art. 62-81) que
      A3/A4 no tienen; confirmado que la página de Evaluaciones del libro real sigue teniendo
      solo 7 columnas ahí (esa asignatura extra no tiene columna propia — inconsistencia del
      original, no se inventó una columna al replicar). **Dato sucio del original preservado a
      propósito**: 3 filas (Prevención de Riesgos ×2, Mecánica) dicen "vehículos de transporte
      de pasajeros" por copy-paste de A2/A3 sin actualizar para un libro de carga — se
      transcribió tal cual, sin corregir, documentado en comentario de código (documento
      fiscalizable). Vive como `getA5Curriculum()` + conectado en `getCurriculum()`. `npx tsc
      --noEmit` sin errores; conteo de filas verificado con Node (68 contenido + 4 LIBRE = 72).
      Pendiente de verificación visual del dueño.

**Las 4 clases de licencia (A2/A3/A4/A5) quedan transcritas y conectadas en `getCurriculum()`.**
El Calendario de Clases ya no muestra "Pendiente de transcripción verbatim" para ninguna.

### Limitación conocida y aceptada (2026-09-23): A3/A4/A5 siempre muestran el aviso de bloques sin fecha
Contando los bloques de sesión de cada malla (`groupIntoSessionBlocks()`, agrupando por día real
del libro, excluyendo LIBRE): A2 necesita **30** días reales, A3/A4/A5 necesitan **32** cada una.
`computePromotionEndDate()` (`src/app/core/utils/promotion-end-date.utils.ts`) genera la duración
de la promoción con un tope **fijo de 30 días hábiles** (`validDays < 30`), igual para las 4
clases -- la duración no depende de la licencia, depende solo de `professional_promotions.
start_date`/`end_date`, compartida por todos los cursos de esa promoción. Consecuencia: en A3/A4/
A5 el aviso "faltan bloques sin fecha asignada" del Calendario de Clases va a aparecer **siempre**
(2 bloques), no solo cuando hay feriados de por medio como en A2 -- es un déficit estructural, no
un caso raro. **Decisión del dueño (2026-09-23): dejarlo así.** No se cambia
`computePromotionEndDate()` ni el trigger `generate_sessions_from_promotion()` -- el aviso ya
comunica la situación con honestidad, sin inventar fechas. Si en el futuro se quiere que la
promoción dure 32 días para A3/A4/A5 (o se recorte la malla a 30 bloques), es un cambio de
producto aparte, no de esta spec.
- [x] Resumen de asistencia: columnas renombradas a "% Asistencia Clase Práctica" / "%
      Asistencia Clase Teórica" / "Firma Conformidad Alumno" (agregada, no existía antes).
- [ ] Confirmar si existe columna "nivel de escolaridad" en `students`/`users` (si no, la
      columna de Antecedentes queda en blanco a propósito, ya implementado así).
- [x] Bug visual detectado por el dueño en el PDF real generado (curso de prueba 21-09-2026):
      el header gris del Calendario de Clases quedaba separado de la primera fila por un hueco
      de 16pt (Rect de 18pt de alto pero `y` bajaba 18pt completos desde la base del texto, que
      ya estaba 2pt arriba del rect). Corregido en `drawCalendarHeader()` — mismo patrón que
      `drawTableHeader()` de `drawGridTable()`: el cursor termina exactamente en el borde
      inferior del rect. `npx tsc --noEmit` sin errores.
- [x] Segundo bug visual, mismo PDF de prueba: el texto de N°/FECHA/HORAS/PROFESOR quedaba
      pegado arriba de la celda en vez de centrado, notorio en filas altas (hasta 56pt cuando
      MATERIAS necesita 5 líneas) — porque todo el texto de una línea se anclaba siempre a
      `rowTop - 11` sin importar el alto real de la fila (a diferencia de `drawGridTable()`,
      que usa filas de alto fijo). Corregido con `centeredBaseline(rowTop, rowH, lineCount)`:
      centra el bloque de texto de cada columna (según su propio número de líneas) dentro del
      alto real de la fila — con 1 línea en una fila mínima de 16pt da exactamente lo mismo que
      antes (`rowTop - 11`), no rompe el caso ya correcto. `npx tsc --noEmit` sin errores.
      **Verificado visualmente por el dueño con PDF real regenerado (curso 21-09-2026)** — la
      fila 1 (4 líneas de materias) quedó con N°/FECHA/HORAS/PROFESOR centrados, confirma el fix.
- [x] Tercer bug visual, mismo PDF: el texto del header (N°/FECHA/.../PROFESOR) quedaba a solo
      2pt del borde superior del rect gris (casi pegado arriba) en vez de centrado en las 18pt
      de alto -- porque el rect se dibujaba con `hTop = y + 2` pero el texto seguía usando la
      `y` original, sin relación con `hTop`. Corregido: todo el header (rect + texto) ahora usa
      coordenadas relativas a `hTop` (`textY = hTop - 12`). `npx tsc --noEmit` sin errores.
      **Verificado visualmente por el dueño.**
- [x] Cuarto bug visual, mismo PDF: el header del Calendario no tenía ningún borde (solo el
      fondo gris), por lo que se veía "pegado" arriba de la tabla en vez de fusionado con ella
      -- a diferencia de `drawTableHeader()` de `drawGridTable()`, que sí dibuja bordes
      verticales entre columnas + horizontal arriba/abajo del header. Agregados los mismos
      bordes (`VL`/`HL`) al header del Calendario. `npx tsc --noEmit` sin errores.
      **Verificado visualmente por el dueño** (junto con el fix anterior, mismo PDF de prueba).
- [x] Ajuste de densidad (feedback del dueño, mismo PDF): con `rowFont=8`/`rowLH=10` entraban
      14 filas por hoja -- en el real entran ~6, se ve chico y apretado en papel real. Subido a
      `rowFont=10`/`rowLH=16` y el padding/mínimo de `rowH` de `Math.max(16, lineCount*10+6)` a
      `Math.max(26, lineCount*16+10)`. Estimado con Deno contra el texto real de materias:
      ~6-7 filas por hoja con estos valores (antes ~13). Sin tocar anchos de columna -- el wrap
      se recalcula solo al cambiar `rowFont`. `npx tsc --noEmit` sin errores.
      **Verificado visualmente por el dueño** (6 filas por hoja en el PDF real regenerado).
- [x] Quinto bug visual, mismo PDF (post ajuste de densidad): nombres de profesor largos
      ("ALBERTO ORMEÑO" 94.5pt, "HORACIO LABBE" 81.7pt @10pt) se salían de la columna PROFESOR
      (85pt) -- verificado con Deno contra `textWidth()` real. Corregido envolviendo PROFESOR
      igual que ASIGNATURA/MATERIAS (`wrapToWidth` + baseline centrado propio, incluido en el
      cálculo de `lineCount`/`rowH` de la fila) en vez de agrandar la columna a costa de
      MATERIAS. `npx tsc --noEmit` sin errores. **Verificado visualmente por el dueño** (6 filas
      por hoja, nombres de profesor ya no se salen de la celda).
- [x] Edge case preguntado por el dueño: ¿qué pasa con un apellido hipotético sin espacios más
      ancho que la columna (ej. "Błaszczykowski")? Confirmado con Deno que `wrapToWidth()` NO
      lo cubría -- una palabra sola más ancha que `maxWidth` quedaba en su propia línea y se
      salía del borde derecho de la celda (el wrap normal solo corta entre palabras). Agregado
      un fallback de corte por carácter en `wrapToWidth()` (función compartida por toda la
      página, no solo PROFESOR) para ese caso -- verificado con Deno que ninguna línea excede
      `maxWidth` con nombres largos simulados, y que el caso normal (nombres reales) no cambia.
      `npx tsc --noEmit` sin errores.
      **Feedback del dueño:** pidió agregar guion al cortar (ej. "BLASZCZYKO-" / "WSKI") en vez
      de dejarlo en crudo, para que se lea como un corte de palabra y no como dos palabras
      distintas. Agregado -- el ancho del guion se reserva en la medición de cada trozo (nunca
      se pasa de `maxWidth` con el guion incluido), y el último trozo de la palabra no lleva
      guion (es el final real, no un corte). Verificado con Deno: ninguna línea excede
      `maxWidth` con o sin guion, nombres reales sin cambios. `npx tsc --noEmit` sin errores.
      Pendiente de verificación visual del dueño (caso hipotético, no hay un profesor real así
      para probar).
- [x] Ajustes de texto pedidos por el dueño (mismo PDF de prueba): columna "FINAL" de
      EVALUACIONES CLASE PROFESIONAL → "NOTA FINAL"; columna "FIRMA CONFORMIDAD ALUMNO" de
      ASISTENCIA CLASE PROFESIONAL (resumen, no Recuperación de Feriados) → "FIRMA CONFORMIDAD
      ALUMNO (NOTAS Y ASISTENCIA)". El header de `drawGridTable()` ya envuelve por ancho real,
      así que el texto más largo se acomoda solo sin tocar el helper. `npx tsc --noEmit` sin
      errores. **Verificado visualmente por el dueño** (mismo PDF: "NOTA FINAL" y "FIRMA
      CONFORMIDAD ALUMNO (NOTAS Y ASISTENCIA)" quedaron bien).
- [x] Bug detectado por el dueño en la misma verificación: el recuadro de notas al pie de
      "CONTROL DE ASISTENCIA DE ALUMNOS (Recuperación de Feriados)" quedaba en una hoja aparte
      en vez de debajo de la tabla en la misma hoja, como el libro real. Causa: la tabla de 25
      filas a `rowH=16` (default) + header casi agotaba el alto de página (612pt), dejando solo
      ~80pt libres donde el recuadro de notas necesita ~90-100pt -- `need(50)` forzaba el salto
      de página. Corregido pasando `rowH: 14` a ese `drawGridTable()` (verificado con cálculo
      exacto del espacio disponible: con 16pt faltaban ~16pt para que cupiera, con 14pt sobran
      ~25pt). `npx tsc --noEmit` sin errores. Pendiente de verificación visual del dueño.

### Auditoría de texto contra los 4 PDFs reales (2026-09-24)
Comparación palabra por palabra (pdftotext -tsv por columna vs. `getA2..A5Curriculum()` /
`getReglamentoText()` evaluados tal cual). Estructura del calendario (filas, LIBRE, ASIGNATURA,
PROFESOR, FECHA) idéntica en A2/A3/A4/A5. Reglamento idéntico entre los 4 libros reales.
- [x] Reglamento: el párrafo "Empresas y personas que requieran otra forma de pago… en cualquier
      momento" estaba en el Art. 23; en el real va en el Art. 24 (tras a/b/c). Movido.
- [x] **Decisión del dueño (2026-09-24): todo el texto va con la ortografía corregida** (no
      verbatim con erratas), y HORAS siempre en minúscula ("horas", o "hora" si es 1). Se
      corrigieron las erratas que el código conservaba a propósito, detectadas con hunspell es_ES
      más una revisión de puntuación: compisiciones, auxilidos, Calidicación, Calisficación
      (→Clasificación), caracteristicas, Catigo, combustibes, estacionamieto, opinion, POLICIA,
      (p)reocedimientos/PREOCEDIMIENTOS, procedimietnos, Refigeración/REFIGERACIÓN, sustancas,
      semiremolque, Diesel→diésel, infanto juvenil, publico, trafico, "as personas", "as drogas",
      "178,,,", espacios faltantes (".EL", ".Contenedores", ".Tipos", ".Miedo", "162.Los", "25bis",
      "75Ds", "Art.N"/"Art N"→"Art. N"), palabras duplicadas ("DE LOS SERVICIOS DE LOS SERVICIOS",
      "para la revisión para la revisión"), "punto del conductor"→"punto de vista del conductor", y
      "CONDUCTORES CHILLAN"→"CHILLÁN" en el reglamento. HORAS: '1 horas'→'1 hora', '4 hora'→
      '4 horas', '5 HORA'→'5 horas'. Se mantienen las correcciones previas del reglamento.
      Reverificado: hunspell sin erratas (solo nombres propios, siglas y formas RAE); estructura
      del calendario idéntica al real en A2/A3/A4/A5 (ASIGNATURA, PROFESOR, FECHA y valores de
      HORAS); `deno check --no-config` sin errores.
- [x] Contenido (no ortografía): en A5, 3 filas dicen "vehículos de transporte de pasajeros"
      en un libro de carga (dato sucio del original). **Decisión del dueño (2026-09-24): se deja
      como en el original por ahora.**
- [x] Verificación visual: el dueño descargó los PDFs generados y confirmó que se ven bien
      (2026-09-24).

### Libros de convalidación (abierto 2026-09-24, bloquea el cierre de la spec)
Estado actual verificado en código: el alumno convalidante queda matriculado en el curso madre
(A2 o A5), y la convalidación solo vive en `license_validations`
(`convalidation_promotion_course_id` siempre `null`). Los cursos `conv_a4`/`conv_a3` nunca se crean
como `promotion_courses` (`promociones.facade.ts` filtra `is_convalidation = false`). Por eso los
convalidantes aparecen SOLO en el libro del curso madre, sin marca, y no existe libro de
convalidación propio. El dueño tiene los libros reales `libroclasesconva3.pdf` y
`libroclasesconva4.pdf` (17 páginas cada uno; mismo reglamento que los normales).
- [x] **Decisión del dueño (2026-09-24):** el convalidante aparece en **ambos** libros (curso
      madre y convalidación).
- [x] **Movido a la spec 0018-m** (`specs/specs/0018-m-libro-clases-convalidacion/`), aprobado
      por el dueño 2026-09-24. Opción B: libros armados al vuelo en el Libro de Clases, sin
      `promotion_courses` nuevos; siempre 6 libros visibles; alumnos que convalidan precargados;
      fechas según los libros reales. Queda fuera del alcance de la 0017-m.

## Verificación pendiente (no ejecutable en esta sesión)
- [ ] Generar el PDF real (requiere Supabase local corriendo + `supabase functions serve`) para
      un curso de prueba y comparar visualmente contra `libroclases.pdf`, página por página.
- [x] `npx tsc --noEmit` sobre el archivo — sin errores de sintaxis.
