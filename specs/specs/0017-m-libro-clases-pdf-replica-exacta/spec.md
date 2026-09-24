# Spec 0017-m — Libro de Clases PDF: réplica exacta del libro físico real

> **Status:** approved
> **Created:** 2026-09-22
> **Owner:** Matías
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** Conversación con el dueño (2026-09-22) — adjuntó `libroclases.pdf`, el Libro de
Control de Clases real que usa Conductores Chillán (formato Excel exportado a PDF), y pidió
que el PDF generado por el sistema sea idéntico a ese documento.

**Persona afectada:** Admin/Secretaria (genera el PDF desde `/app/admin/libro-de-clases`) y,
en última instancia, el fiscalizador de SENCE/MTT que recibe el libro impreso o en PDF como
evidencia legal del curso dictado.

**Problema que resuelve:** El generador actual (`generate-class-book-pdf`, PDF armado a mano
con content streams) es una versión resumida y visualmente distinta del libro real: tamaño de
página distinto (A4 horizontal 842×595 vs. el real Legal horizontal 1008×612), reglamento
interno parafraseado en vez del texto oficial de 30 artículos, falta la página de
"Antecedentes de los Alumnos", la asistencia semanal usa una grilla de 6 días (L-S) en vez de
7 (L-D, con Domingo marcado), falta la página de "Recuperación de Feriados", y el calendario de
clases no reproduce el detalle real de materias/horas/profesor por sesión. Si el libro que el
sistema genera no es reconocible como el libro oficial, no reemplaza al libro físico que hoy se
sigue llenando a mano — que es el objetivo de todo el módulo (ver `project_clase_profesional.md`
§"Visibilidad del libro de clase").

**Hipótesis de valor:** Un PDF idéntico al libro físico permite imprimirlo y usarlo
directamente en una fiscalización sin que nadie note la diferencia, habilitando el reemplazo
real del libro de papel.

---

## 2. User Stories

- **US1**: Como Admin, quiero exportar el Libro de Clases de un curso profesional y obtener un
  PDF con el mismo tamaño de página, estructura, tablas y texto que el libro físico real, para
  poder usarlo como el libro oficial del curso sin diferencias visibles.
- **US2**: Como Admin, quiero que las secciones de alumnos (antecedentes, asistencia semanal,
  evaluaciones, resumen de asistencia) vengan precargadas con los nombres reales de los
  inscritos, para no tener que transcribirlos a mano como con el libro en Excel.
- **US3**: Como fiscalizador SENCE/MTT, quiero que el libro impreso conserve el Reglamento
  Interno OTEC completo (30 artículos) y el calendario de clases con el detalle de materias por
  sesión, para verificar el cumplimiento del programa aprobado.

---

## 3. Acceptance Criteria (Gherkin)

> Referencia de todos los AC: `libroclases.pdf` (adjuntado por el dueño 2026-09-22),
> `Downloads/libroclases.pdf` en la máquina de Matías. 28 páginas.

- **AC1 (tamaño de página)**: Given cualquier PDF generado por `generate-class-book-pdf`, Then
  el `MediaBox` de cada página es exactamente `0 0 1008 612` (Legal horizontal, 14×8.5 in) —
  igual al real (verificado con `/MediaBox` del PDF real).
- **AC2 (portada)**: Given un curso con Código SENCE cargado, When se genera el PDF, Then la
  página 1 reproduce la tabla de 8 filas del real (Nombre autoescuela, Nombre e ID actividad,
  Código SENCE, Fecha inicio, Fecha término, Lugar de ejecución, Horario) con el mismo layout
  de dos columnas (etiqueta : valor) y el logo en la esquina superior izquierda junto al título
  "LIBRO DE CONTROL DE CLASES".
- **AC3 (antecedentes de los alumnos)**: Given un curso con N alumnos inscritos, When se genera
  el PDF, Then existe una página "ANTECEDENTES DE LOS ALUMNOS" (tabla N°/Apellidos,
  Nombre/RUN/Nivel de Escolaridad/Teléfono/Firma) con los N alumnos reales precargados en las
  columnas Apellidos-Nombre y RUN (Teléfono si existe), y filas vacías adicionales hasta
  completar el mismo número de filas que trae el real (25) cuando N < 25.
- **AC4 (reglamento interno completo)**: Given cualquier curso, When se genera el PDF, Then el
  "REGLAMENTO INTERNO OTEC CONDUCTORES CHILLÁN" incluye los 30 artículos completos (Título I a
  Título IX) con el texto del documento real, no una versión resumida, con la ortografía
  corregida (decisión del dueño 2026-09-24: no se replican las erratas del original).
  - Nota: el texto es estático (no depende de datos del curso) — se transcribe una sola vez
    desde `libroclases.pdf` páginas 2-5.
- **AC5 (asistencia semanal — grilla de 7 días)**: Given un curso con sesiones teóricas
  definidas, When se genera el PDF, Then cada semana de asistencia muestra los 7 días (Lunes a
  Domingo) con su fecha real, marcando "DOMINGO" en la columna del domingo y "LIBRE" en los
  días sin sesión programada (feriados/descansos), igual que el real — no solo 6 columnas L-S.
- **AC6 (recuperación de feriados)**: Given cualquier curso, When se genera el PDF, Then existe
  una página "CONTROL DE ASISTENCIA DE ALUMNOS (Recuperación de Feriados)" con los alumnos
  reales precargados en la columna Apellidos-Nombre, columnas de fecha en blanco para llenar a
  mano, columna "FIRMA CONFORMIDAD ALUMNO", y las 3 notas al pie transcritas del real.
- **AC7 (calendario de clases)**: Given las sesiones teóricas del curso, When se genera el PDF,
  Then el calendario reproduce una fila por bloque de materia (no una fila genérica por sesión),
  con columnas N°/Fecha/Asignatura/Materias (texto largo, wrap)/Horas/Profesor, igual a la
  estructura de las páginas 14-26 del real.
  - Nota: el contenido curricular (asignaturas, materias, horas, profesor asignado por bloque)
    es una plantilla estática por clase de licencia (igual que el reglamento) — no se deriva de
    `professional_theory_sessions`. El profesor impreso es el transcrito verbatim del libro real
    (ej. "ALBERTO ORMEÑO"), por decisión explícita del dueño — no el relator real asignado a
    este curso (`promotion_course_lecturers`), aunque no coincidan.
  - Nota (corrección 2026-09-23): las FECHAS sí salen de las fechas activas
    (no `cancelled`) de `professional_theory_sessions` de este curso, asignadas en orden a cada
    bloque de la malla. No se inventan días "LIBRE": no existe ninguna fórmula ni regla real que
    determine qué día es descanso (confirmado contra el Excel fuente — es una elección manual de
    quien armó cada cohorte, sin patrón derivable), y el horario real del negocio (lunes a
    sábado, 6 clases/semana) no tiene el concepto de "día de descanso programático".
- **AC8 (evaluaciones)**: Given los alumnos inscritos, When se genera el PDF, Then la página
  "EVALUACIONES CLASE PROFESIONAL" reproduce la cabecera de fecha por módulo y columnas por
  asignatura (no por "Mód. N") igual al real, con los alumnos reales precargados y las celdas de
  nota vacías.
- **AC9 (resumen de asistencia)**: Given los alumnos inscritos, When se genera el PDF, Then la
  página "ASISTENCIA CLASE PROFESIONAL" tiene columnas N°/Apellidos, Nombre/% Asistencia Clase
  Práctica/% Asistencia Clase Teórica/Firma Conformidad Alumno, con alumnos reales precargados
  y columnas de porcentaje/firma en blanco.
- **AC10 (fuente y estilo visual)**: Given cualquier página, Then los encabezados de tabla usan
  fondo gris claro igual al real y el título de cada sección centrado en negrita, replicando el
  estilo tipográfico Calibri-like ya usado por `pdf-utils.ts` (no se requiere embeber una fuente
  nueva si el resultado visual es equivalente).

### Edge cases obligatorios

- **AC-E1**: Given un curso sin alumnos inscritos, When se genera el PDF, Then las páginas de
  antecedentes/asistencia/evaluaciones/resumen muestran filas vacías (mismo número que el real)
  sin error.
- **AC-E2**: Given un curso con más de 25 alumnos, When se genera el PDF, Then la tabla de
  antecedentes/evaluaciones/resumen pagina correctamente (páginas adicionales) sin cortar filas
  a la mitad.
- **AC-E3**: Given un curso sin sesiones teóricas cargadas todavía, When se genera el PDF, Then
  no se generan páginas de asistencia semanal ni de calendario con datos, pero el resto del
  libro (portada, reglamento, antecedentes) se genera igual.

---

## 4. Out of scope

- ❌ Editar el Reglamento Interno OTEC desde la UI (queda hardcodeado, igual que hoy — es un
  documento legal fijo de la empresa).
- ❌ Cambiar el curriculum/materias por curso desde la UI — la plantilla de materias del
  calendario es estática por clase de licencia, igual que hoy con `getModuleNames()`.
- ❌ Registrar asistencia/notas reales en el PDF (el libro sigue siendo una plantilla
  imprimible para llenar a mano — decisión ya tomada en fix-250-m, no se revisita acá).
- ❌ Tocar el editor de código SENCE / horario fijo de la cabecera (fix-098-m / fix-258-m ya
  resueltos, se mantienen).
- ❌ Volver a exponer `horario` como campo editable — el horario sigue fijo (fix-258-m).
- ❌ Libros de convalidación (Conv. A-3 / Conv. A-4): movidos a la spec 0018-m por decisión del
  dueño (2026-09-24).

---

## 5. Dependencias

### Specs previas
- fix-250-m (libro como plantilla imprimible sin resultados precargados) — se mantiene.
- fix-258-m / fix-259-m (horario fijo en cabecera) — se mantiene, no se revierte.

### Capacidades del proyecto que se asumen existentes
- `supabase/functions/_shared/pdf-utils.ts` (helpers de bajo nivel para armar el PDF a mano:
  `assemblePdf`, `wrapLines`, `escapePdfWinAnsi`, `loadPngForPdf`).
- `LibroDeClasesFacade.exportPdf()` (sin cambios de contrato — sigue invocando la misma Edge
  Function).

### Capacidades nuevas requeridas
- Ninguna tabla nueva. Cambios acotados a la Edge Function `generate-class-book-pdf` (tamaño de
  página, contenido estático del reglamento y del calendario curricular, y layout de las
  páginas de alumnos).

---

## 6. Datos y modelo (preliminar)

- No hay cambios de esquema. Se agregan/editan datos estáticos embebidos en el código de la
  Edge Function (texto del reglamento completo, plantilla curricular del calendario por clase
  de licencia).
- `enrollments`/`students`/`users` ya se leen hoy (nombre, RUT, teléfono) — falta agregar
  `nivel de escolaridad` si existe en el esquema; si no existe, esa columna queda en blanco (no
  se agrega columna nueva solo para esto — a confirmar en plan.md tras revisar `DATABASE.md`).

---

## 7. UX y flujos (preliminar)

- Pantalla afectada: `/app/admin/libro-de-clases` → botón "Exportar PDF" (sin cambios de UI,
  solo cambia el PDF resultante).
- Flujo principal: Admin selecciona promoción/curso → click "Exportar PDF" → se descarga el PDF
  con el nuevo layout.
- Sin estados nuevos de loading/error — reutiliza `facade.isExporting()` existente.

---

## 8. Métricas de éxito post-launch

- El dueño confirma visualmente (comparando lado a lado) que el PDF generado es indistinguible
  del libro real, salvo por los nombres de alumnos precargados.

---

## 9. Notas / decisiones abiertas

- [ ] Confirmar si `students`/`users` tiene columna de "nivel de escolaridad" en
  `indices/DATABASE.md`; si no existe, esa columna del PDF queda en blanco (no se crea columna
  nueva solo para el PDF sin que el dueño la pida explícitamente).
- [ ] El calendario de clases real (páginas 14-26) tiene contenido curricular específico por
  clase A-2 (Transporte de Pasajeros). Confirmar con el dueño si todas las clases (A2/A3/A4/A5)
  comparten la misma plantilla de materias o si cada una requiere su propio texto (impacta el
  tamaño de la plantilla estática a transcribir).

---

## Changelog

- 2026-09-22 — draft aprobado por Matías (owner), a partir de `libroclases.pdf` adjuntado y
  confirmación de alcance "réplica completa".
- 2026-09-24 — AC4/AC7: el texto (reglamento y materias) va con la ortografía corregida, no
  verbatim con erratas; HORAS siempre en minúscula ("horas", o "hora" si es 1). Decisión de
  Matías (owner).
