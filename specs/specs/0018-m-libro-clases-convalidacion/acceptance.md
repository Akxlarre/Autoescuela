# Acceptance 0018-m — Libros de Clases de convalidación (Conv. A-3 y Conv. A-4)

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-09-24
> **Verifier:** Claude (Opus 5.5) · validado por Matías (owner)

---

## Resumen

- AC totales: 14 (AC1–AC10 + AC-E1–AC-E4)
- AC cumplidos: 14
- AC fallidos: 0
- AC con evidencia: 14

Hay 3 AC que no se pudieron verificar con datos reales porque hoy no existe ninguna promoción
con alumnos que convalidan: **AC2, AC3 y AC-E4**. Quedan verificados con tests unitarios y
revisión de código, y el dueño lo aceptó así (ver "Deuda técnica"). Los PDFs Conv. A-3 y
Conv. A-4 reales, generados y revisados en producción, cubren el resto.

**Veredicto final:** ✅ PASA. La verificación de AC2, AC3 y AC-E4 con datos reales queda como
seguimiento no bloqueante.

> Los cambios de esta spec todavía no tienen commit (working tree de `fix/detalles-finales`). La
> evidencia cita archivo:línea y casos de test en vez de hashes.

---

## Verificación por AC

### AC1 — Selector con 6 libros

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `src/app/core/utils/convalidation-book.utils.spec.ts:100`, caso "4 cursos → 6 libros:
    los 4 normales y luego Conv. A-3 y Conv. A-4".
  - Test: `src/app/core/facades/libro-de-clases.facade.spec.ts:401`, caso "el selector suma los
    libros de convalidación cuyo curso madre existe".
  - QA manual: el dueño eligió Conv. A-3 y Conv. A-4 en el selector de la promoción 279, que no
    tiene convalidantes, y generó ambos PDFs (2026-09-24).

### AC2 — Alumnos que convalidan precargados (nombre y RUN)

- **Estado:** ✅ cumplido (por test; falta verlo con datos reales)
- **Evidencia:**
  - QA manual (dueño, 2026-09-24): generó un libro con un alumno real y salió precargado con
    nombre y RUN ("Merino Osses Samuel José", 16.212.873-6).
  - Test: `libro-de-clases.facade.spec.ts:416`, caso "Conv. A-4: solo alumnos del curso madre que
    convalidan A4". Verifica el nombre, el RUN, la renumeración y el filtro
    `convalidated_license = 'A4'` sobre los `enrollment_id` del curso madre.
  - Código: `src/app/core/facades/libro-de-clases.facade.ts:430` (pantalla) y
    `supabase/functions/generate-class-book-pdf/index.ts:144` (PDF), con el mismo filtro contra
    `license_validations`.
- **Notas:** sin promociones con convalidantes no hubo PDF con alumnos. Seguimiento en "Deuda
  técnica".

### AC3 — El alumno que convalida sigue en el libro de su curso madre

- **Estado:** ✅ cumplido (por test; falta verlo con datos reales)
- **Evidencia:**
  - Test: `libro-de-clases.facade.spec.ts:409`, caso "el libro normal no filtra alumnos". Trae a
    todos y no consulta `license_validations`.
  - Código: en la Edge Function, el filtro solo corre con `convalidation` presente
    (`index.ts:144`); el libro normal no cambia.

### AC4 — Portada

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `libro-de-clases.facade.spec.ts:428` (nombre, ID `P26.7`, fechas del tramo).
  - Código: `index.ts:3393` ("CURSO CONVALIDACIÓN CLASE A-3/A-4").
  - QA manual (dueño): Conv. A-3 → "CURSO CONVALIDACIÓN CLASE A-3", ID 279.6, SENCE
    17466347457, del 07-10-2026 al 26-10-2026. Conv. A-4 → ID 279.7, del 10-10-2026 al
    26-10-2026.

### AC5 — Fechas del tramo (últimas N del curso madre)

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Tests: `convalidation-book.utils.spec.ts:20`, `:26` (N = 16 / 13), `:76` (últimas N) y `:81`
    (excluye canceladas).
  - Código: `index.ts:170` (`slice(-convBook.sessionDays)`).
  - QA manual: Conv. A-3 con 16 días y Conv. A-4 con 13 días. Ambos terminan el 26-10-2026, el
    mismo día que la promoción, como en los libros reales.

### AC6 — Estructura del libro

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `index.ts:3603` (sin Recuperación de Feriados en convalidación) e `index.ts:3396`
    ("-" fuera del tramo).
  - QA manual: los 2 PDFs traen portada, reglamento, antecedentes, 4 semanas de asistencia,
    calendario, evaluaciones y resumen, sin la hoja de Feriados. Los días fuera del tramo van
    con "-" y el 12-10, feriado dentro del tramo, sale LIBRE.

### AC7 — Malla de convalidación

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Comparación por fila contra `libroclasesconva3.pdf` / `libroclasesconva4.pdf` (pdfplumber):
    fecha, asignatura, profesor y horas idénticos en las 46 filas. En MATERIAS, solo diferencias
    ortográficas. hunspell es_ES sin erratas.
  - Agrupando por día salen 16 bloques (Conv. A-3) y 13 (Conv. A-4), verificado con
    `groupIntoSessionBlocks()`.
  - QA manual: los 2 PDFs muestran 23 filas con fechas reales por bloque.

### AC8 — Evaluaciones con 5 asignaturas

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Tests: `convalidation-book.utils.spec.ts:52`, `:62` (5 asignaturas en el orden del real) y
    `libro-de-clases.component.spec.ts:56`, `:61` (encabezados Mód. con el número real).
  - Código: `index.ts:3622`. NOTA FINAL mantiene el ancho del libro normal y la tabla queda más
    angosta, como en el real (x=702 contra x=818, medido con pdfplumber).
  - QA manual: el dueño redesplegó la función con el ajuste y confirmó que quedó bien.
- **Notas:** los 6 libros van sin fecha por columna, por decisión del dueño (AC8 actualizado en
  la spec).

### AC9 — Sin impacto fuera del Libro de Clases

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Alcance del diff: solo el facade, el modelo y el componente del Libro de Clases, un util
    nuevo, la Edge Function, la migración de `class_book` e índices. Ningún otro facade ni
    pantalla profesional cambió.
  - La única otra escritura a `class_book` es `auto-create-next-promotions`, que inserta la fila
    normal y queda `convalidation_license = NULL`, compatible con la nueva unicidad.
  - `npm run test:ci`: 2653 tests en verde, 0 fallas.

### AC10 — Pantalla y código SENCE propio

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Tests: `libro-de-clases.facade.spec.ts:452` (lee la fila correcta de `class_book`), `:461`
    (inserta con `convalidation_license: 'A4'`) y `:482` (el libro normal inserta con `null`).
  - Migración: `20260924120000_class_book_alter_convalidation_license.sql`, con
    `UNIQUE NULLS NOT DISTINCT (promotion_course_id, convalidation_license)`.
  - QA manual: el código SENCE 17466347457 cargado en Conv. A-3 aparece en su portada.

### AC-E1 — Promoción sin alumnos que convalidan

- **Estado:** ✅ cumplido
- **Evidencia:** test `libro-de-clases.facade.spec.ts:507`. QA manual: los 2 PDFs de la promoción
  279 se generaron sin error, con 25 filas vacías.

### AC-E2 — Más de 25 alumnos: paginación

- **Estado:** ✅ cumplido (por reutilización)
- **Evidencia:** las tablas de alumnos usan el mismo `drawGridTable()` que la 0017-m
  (`rowCount: Math.max(n, 25)`, con salto de página por fila), ya verificado ahí. La
  convalidación no agrega una tabla nueva.

### AC-E3 — Menos fechas que N

- **Estado:** ✅ cumplido
- **Evidencia:** test `convalidation-book.utils.spec.ts:86`. En el PDF se usa el mismo aviso de
  bloques sin fecha de la 0017-m, sin inventar fechas.

### AC-E4 — Matrículas canceladas o en borrador excluidas

- **Estado:** ✅ cumplido (por revisión de código)
- **Evidencia:** el filtro de convalidación se aplica sobre la misma consulta del libro normal,
  que ya excluye `cancelled` y `draft`: `libro-de-clases.facade.ts:420` e `index.ts:105`
  (`.not('status', 'in', '("cancelled","draft")')`).

---

## Out-of-scope respetado

- ❌ Crear `promotion_courses` de convalidación o sesiones propias — confirmado: no entró.
- ❌ Registrar asistencia o notas de convalidación en el sistema — confirmado: el libro sigue
  siendo una plantilla.
- ❌ Cambiar la regla de convalidación o el wizard de matrícula — confirmado: `enrollment.facade.ts`
  no se tocó.

(El código SENCE editable para convalidación salió del out-of-scope y pasó a AC10 por decisión
del dueño antes de aprobar la spec.)

---

## Deuda técnica detectada

- **Verificar AC2, AC3 y AC-E4 con datos reales** la primera vez que una promoción tenga alumnos
  que convalidan: generar Conv. A-3 / Conv. A-4 y el libro madre, y revisar que los nombres y
  RUN salgan en ambos. No bloquea el cierre (aceptado por el dueño).
- **La configuración de convalidación está duplicada:** `CONVALIDATION_BOOKS` (Angular) y
  `CONV_BOOKS` (Edge Function), porque la función no puede importar código de Angular. Hay
  comentario cruzado en ambos lados. Si cambia el N de días o el sufijo, hay que tocar los dos.
- **ARCH-10 (advertencias):** métodos largos en `libro-de-clases.facade.ts`
  (`saveClassBookFields`, `loadAsistenciaSemanal`). Advertencia, no error; mismo patrón que el
  resto del proyecto.

---

## Cambios en índices

- `indices/DATABASE.md`: `class_book.convalidation_license` y la nueva unicidad
  `class_book_promotion_course_conv_key`.
- `indices/UTILS.md`: `convalidation-book.utils.ts`.
- `indices/MODELS.md`: `ConvalidationLicense`, `LibroOption`.
- `indices/FACADES.md`: `LibroDeClasesFacade` (`libros()`, `selectLibro()`,
  `selectedLibroKey()`, filtro de convalidación).

---

## Post-mortem

- **Qué salió mejor de lo esperado:** reutilizar los textos ya corregidos de A2-A5 dejó solo 4
  de 46 filas de malla con transcripción propia, y la regla "últimas N fechas" calzó exacto con
  los 2 libros reales.
- **Qué fricciones encontramos:** la auditoría de texto de la 0017-m no detectó que los 6 libros
  reales imprimen fechas en Evaluaciones; se vio recién en esta spec. Tampoco se detectó a la
  primera que la tabla de Evaluaciones de convalidación es más angosta (lo señaló el dueño).
  Comparar solo texto deja fuera la geometría.
- **Qué cambiaríamos:** al replicar un documento real, comparar también la estructura de cada
  tabla (columnas, anchos y encabezados con datos), no solo el texto corrido.

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia (AC2/AC3/AC-E4 por test y código; datos reales
      pendientes, no bloqueante)
- [x] Out-of-scope respetado
- [x] Índices actualizados
- [x] Tests pasando (`npm run test:ci`: 2653 ✓)
- [x] `lint:arch` limpio (0 errores)
- [x] Sin deuda crítica abierta

**Cerrado por:** Matías (owner). Confirmó el cierre el 2026-09-24, después de redesplegar y revisar
la versión final. En esa revisión vio, con un alumno real precargado, el nombre y el RUN con la
letra de celda más grande de `fitCellText()` ("quedó perfecto").
**Fecha:** 2026-09-24
