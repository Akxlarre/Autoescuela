# Acceptance 0017-m — Libro de Clases PDF: réplica exacta del libro físico real

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-09-24
> **Verifier:** Claude (Opus 5.5) · validado por Matías (owner)

---

## Resumen

- AC totales: 13 (AC1–AC10 + AC-E1–AC-E3)
- AC cumplidos: 13
- AC fallidos: 0
- AC con evidencia: 13

Cinco AC se cumplen con un ajuste que decidió el dueño durante la implementación (AC2, AC3,
AC4, AC7, AC8). Cada uno está indicado abajo; ninguno queda abierto.

**Veredicto final:** ✅ PASA

> Código en el commit `8ab2dffc feat(0017-m)`. Los ajustes posteriores a la Edge Function (erratas
> en las mallas y letra de las celdas de alumnos) entraron con la 0018-m, en `ccffe3a6`.

---

## Verificación por AC

### AC1 — Tamaño de página 1008×612

- **Estado:** ✅ cumplido
- **Evidencia:** `generate-class-book-pdf/index.ts` (`W = 1008, H = 612`, medido del `/MediaBox`
  del real). QA manual: PDFs generados en producción y revisados por el dueño (2026-09-24).

### AC2 — Portada

- **Estado:** ✅ cumplido (con ajuste)
- **Evidencia:** la portada es un formulario con logo y título, con las medidas tomadas del Excel
  fuente (`LIBROS CURSO PROFESIONAL 2020.xlsx`, hoja `LIBRO_A2`). Revisada por el dueño.
- **Ajuste:** el AC hablaba de "tabla de 8 filas". El real, medido en el Excel, tiene 7 campos
  ("Nombre" e "ID" van en una sola línea) y no es una grilla. Se replicó el real (tasks.md,
  Fase 1).

### AC3 — Antecedentes de los alumnos

- **Estado:** ✅ cumplido (con ajuste)
- **Evidencia:** la página "ANTECEDENTES DE LOS ALUMNOS" tiene 25 filas mínimo y pagina si hay
  más. Nombre y RUN van precargados; el dueño lo verificó con un alumno real
  ("Merino Osses Samuel José", 16.212.873-6).
- **Ajustes:**
  - Teléfono en blanco: el dueño pidió precargar solo el nombre (y el RUN, ya incluido en el AC).
  - "Nivel de escolaridad" en blanco: el dato no existe en la BD (confirmado 2026-09-24).

### AC4 — Reglamento interno completo

- **Estado:** ✅ cumplido (con ajuste)
- **Evidencia:** son los 30 artículos, Títulos I a IX. Se comparó palabra por palabra contra
  `libroclases.pdf` y los otros 5 libros reales, que tienen el mismo reglamento. Se corrigió el
  párrafo de formas de pago, que estaba desplazado al Art. 23 y va en el Art. 24.
- **Ajuste:** la ortografía va corregida, no verbatim con erratas. Decisión del dueño del
  2026-09-24, registrada en el AC4 de la spec.

### AC5 — Asistencia semanal de 7 días

- **Estado:** ✅ cumplido
- **Evidencia:** grilla de lunes a domingo, con "DOMINGO" fijo y "LIBRE" en los días sin sesión
  (el 12-10, feriado, sale LIBRE en los PDFs de producción). Revisado por el dueño.

### AC6 — Recuperación de feriados

- **Estado:** ✅ cumplido
- **Evidencia:** alumnos precargados, columnas de fecha en blanco, "FIRMA CONFORMIDAD ALUMNO" y
  las 3 notas al pie en la misma hoja que la tabla (fix de `rowH: 14`). Revisado por el dueño.

### AC7 — Calendario de clases

- **Estado:** ✅ cumplido (con ajuste)
- **Evidencia:**
  - Mallas A2, A3, A4 y A5 transcritas de los 4 libros reales. Se compararon por columna con
    `pdftotext -tsv`: asignatura, profesor, fechas de agrupación y horas coinciden; en materias,
    las únicas diferencias son ortográficas.
  - hunspell es_ES sin erratas.
  - Varias rondas de ajuste visual con el dueño: alto de filas, centrado, bordes del header,
    densidad y ajuste de línea del nombre del profesor.
- **Ajustes:**
  - Las fechas salen de las sesiones activas del curso (nota de la spec, 2026-09-23), no de
    días LIBRE inventados.
  - A3, A4 y A5 necesitan 32 días de clase contra 30 de la promoción, así que siempre muestran
    el aviso de "bloques sin fecha". El dueño aceptó esta limitación el 2026-09-23.

### AC8 — Evaluaciones

- **Estado:** ✅ cumplido (con ajuste)
- **Evidencia:** columnas con el nombre real de cada asignatura, no "Mód. N"; alumnos precargados
  y notas en blanco.
- **Ajuste:** el AC pedía "cabecera de fecha por módulo". Los libros reales imprimen la fecha de
  la prueba de la cohorte 2022, pero el sistema no conoce esas fechas para los cursos actuales.
  El dueño decidió el 2026-09-24 dejar los 6 libros sin fecha.

### AC9 — Resumen de asistencia

- **Estado:** ✅ cumplido
- **Evidencia:** columnas "% ASISTENCIA CLASE PRÁCTICA", "% ASISTENCIA CLASE TEÓRICA" y "FIRMA
  CONFORMIDAD ALUMNO (NOTAS Y ASISTENCIA)" (texto pedido por el dueño). Revisado por el dueño.

### AC10 — Estilo visual

- **Estado:** ✅ cumplido
- **Evidencia:** encabezados con fondo gris y bordes completos, títulos centrados en negrita, la
  misma tipografía de `pdf-utils.ts` y grilla completa en todas las tablas. Revisado por el
  dueño.

### AC-E1 — Curso sin alumnos

- **Estado:** ✅ cumplido
- **Evidencia:** PDFs de la promoción 279, sin alumnos, generados sin error y con 25 filas vacías
  (2026-09-24).

### AC-E2 — Más de 25 alumnos

- **Estado:** ✅ cumplido (por código)
- **Evidencia:** `drawGridTable()` usa `rowCount: Math.max(n, 25)` y salta de página por fila,
  repitiendo el encabezado "(cont.)" sin cortar filas. No se probó con más de 25 alumnos reales.

### AC-E3 — Curso sin sesiones teóricas

- **Estado:** ✅ cumplido (por código)
- **Evidencia:** la asistencia semanal solo se dibuja si hay sesiones activas
  (`if (sessions.some(...))`). Sin sesiones, el calendario muestra la malla con fechas "—" y el
  aviso de bloques sin fecha, y la portada, el reglamento y los antecedentes se generan igual.

---

## Out-of-scope respetado

- ❌ Editar el reglamento desde la UI — confirmado: sigue fijo en código.
- ❌ Cambiar las materias por curso desde la UI — confirmado: la malla es estática por clase.
- ❌ Registrar asistencia o notas reales en el PDF — confirmado: sigue siendo plantilla
  (fix-250-m).
- ❌ Tocar el editor del código SENCE o el horario — confirmado: el horario sigue fijo
  (fix-258-m).
- ❌ Libros de convalidación — movidos a la spec 0018-m, ya cerrada.

---

## Deuda técnica detectada

- **La Edge Function no tiene tests unitarios.** La verificación fue con scripts de comparación
  contra los PDFs reales y revisión visual del dueño.
- **Aviso estructural en A3, A4 y A5:** las mallas necesitan 32 días y la promoción dura 30.
  Aceptado por el dueño; si se quiere cambiar, es otra spec (duración de la promoción o malla
  recortada).
- **No se probó con más de 25 alumnos reales** (AC-E2 verificado solo por código).

---

## Cambios en índices

- `indices/DATABASE.md`: ajustado en el commit `8ab2dffc`.

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia
- [x] Out-of-scope respetado
- [x] Índices actualizados
- [x] Tests pasando (`npm run test:ci`: 2653 ✓, medido al cerrar la 0018-m sobre el mismo código)
- [x] `lint:arch` limpio (0 errores)
- [x] Sin deuda crítica abierta

**Cerrado por:** Matías (owner). Confirmó el cierre de los pendientes el 2026-09-24.
**Fecha:** 2026-09-24
