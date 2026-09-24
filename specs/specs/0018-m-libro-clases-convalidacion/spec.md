# Spec 0018-m — Libros de Clases de convalidación (Conv. A-3 y Conv. A-4)

> **Status:** approved
> **Created:** 2026-09-24
> **Owner:** Matías
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** Conversación con el dueño (2026-09-24), durante el cierre de la spec 0017-m. El dueño
aportó los libros reales `libroclasesconva3.pdf` y `libroclasesconva4.pdf` (en `Downloads`, 17
páginas cada uno).

**Persona afectada:** Admin/Secretaria (imprime los libros desde `/app/admin/libro-de-clases`) y
el fiscalizador SENCE/MTT que revisa el libro de un curso de convalidación.

**Problema que resuelve:** Cada promoción profesional tiene 6 libros de clases reales: los 4
cursos (A2, A3, A4 y A5) más 2 cursos de convalidación (Conv. A-3 para alumnos A5 y Conv. A-4
para alumnos A2). Hoy la app solo genera los 4 primeros. El alumno que convalida queda matriculado
en el curso madre (A2/A5) y la convalidación vive solo en `license_validations`. Los cursos de
convalidación nunca se crean dentro de una promoción, así que sus libros no se pueden ver ni
imprimir.

**Hipótesis de valor:** Con los 6 libros disponibles en la app, se deja de armar a mano el libro
de convalidación en Excel.

**Decisión de diseño (dueño, 2026-09-24): "opción B".** Los libros de convalidación se arman al
momento de ver o imprimir, solo dentro del módulo Libro de Clases, con datos que ya existen. **No
se crean `promotion_courses` de convalidación.** Se descartó la opción A (crear los cursos
`conv_a3`/`conv_a4` en cada promoción) porque el trigger `generate_sessions_from_promotion()`
generaría sesiones para toda la promoción. Además, 7 pantallas que listan los cursos de la
promoción (matrícula, asistencia, evaluaciones, certificación, archivo, promociones y libro de
clases) mostrarían cursos vacíos, y habría que agregarlos retroactivamente a las promociones
existentes. Si en el futuro se quiere registrar en el sistema la asistencia o las notas de la
convalidación, se deberá migrar a la opción A en una spec aparte.

---

## 2. User Stories

- **US1**: Como Admin/Secretaria, quiero ver siempre los 6 libros de una promoción en el
  selector del Libro de Clases, para imprimir también los de convalidación.
- **US2**: Como Admin/Secretaria, quiero que el libro de convalidación traiga precargados el
  nombre y el RUN de los alumnos que convalidan esa licencia, para no transcribirlos a mano.
- **US3**: Como fiscalizador, quiero que el libro de convalidación sea igual al libro físico
  real (portada, reglamento, malla propia, fechas del tramo de convalidación), para verificar el
  programa dictado.

---

## 3. Acceptance Criteria (Gherkin)

> Referencia de todos los AC: `libroclasesconva3.pdf` / `libroclasesconva4.pdf` (Downloads de
> Matías). Mismo tamaño de página y estilo visual que los libros de la spec 0017-m. El texto va
> con la ortografía corregida y HORAS en minúscula (misma decisión que en la 0017-m).

- **AC1 (selector con 6 libros)**: Given cualquier promoción profesional, When se abre en el
  Libro de Clases, Then el selector de curso muestra los 4 cursos más "Conv. A-3" y
  "Conv. A-4", aunque ningún alumno de la promoción convalide.
- **AC2 (alumnos precargados)**: Given alumnos matriculados en el curso A5 de la promoción (no
  cancelados ni en borrador) con `license_validations.convalidated_license = 'A3'`, When se
  genera el libro Conv. A-3, Then esos alumnos aparecen con **nombre y RUN** precargados en
  Antecedentes (y teléfono si existe, igual que en el libro madre), Asistencia semanal,
  Evaluaciones y Asistencia Clase Profesional. Lo mismo aplica al libro Conv. A-4 con los alumnos
  del curso A2 que tienen `convalidated_license = 'A4'`.
- **AC3 (siguen en el libro madre)**: Given un alumno que convalida, When se genera el libro de
  su curso madre (A2/A5), Then sigue apareciendo ahí igual que hoy (aparece en ambos libros).
- **AC4 (portada)**: Given el libro Conv. A-3 o Conv. A-4, Then la portada muestra "CURSO
  CONVALIDACIÓN CLASE A-3" (o A-4), el ID con el código de la promoción más el sufijo `.6`
  (Conv. A-3) o `.7` (Conv. A-4), igual que el real (ej. `156.6` / `156.7`), la fecha de inicio y
  de término del tramo de convalidación (AC5), el lugar de ejecución y el horario fijo de la
  cabecera.
- **AC5 (fechas del tramo)**: Given las sesiones teóricas activas (no `cancelled`) del curso
  madre, Then las fechas del libro de convalidación son las **últimas N** de esas fechas, donde N
  es la cantidad de días de clase de la malla de convalidación (según los libros reales: 16 para
  Conv. A-3 y 13 para Conv. A-4). La fecha de término coincide con la última clase del curso
  madre, igual que en los libros reales.
- **AC6 (estructura del libro)**: Given el libro de convalidación, Then contiene en orden:
  portada, reglamento interno (el mismo texto de la spec 0017-m), Antecedentes de los Alumnos,
  Control de Asistencia semanal (grilla de 7 días; los días de esa semana previos al inicio van
  con "-" y el domingo con "DOMINGO", como en el real), Calendario de Clases, Evaluaciones y
  Asistencia Clase Profesional. **No incluye** la hoja "Recuperación de Feriados" (el libro real
  no la tiene).
- **AC7 (malla de convalidación)**: Given el Calendario de Clases del libro de convalidación,
  Then reproduce las 23 filas de la malla real correspondiente (asignatura, materias, horas,
  profesor), transcritas desde el PDF real, y las fechas salen del AC5 asignadas por bloque de
  día, con el mismo mecanismo de la 0017-m.
- **AC8 (evaluaciones)**: Given la página de Evaluaciones, Then tiene las 5 columnas de
  asignatura del real, más NOTA FINAL:
  - Conv. A-3: Infraestructura y Ed. Vial, Transporte de Pasajeros, Conducción, Aspectos
    Psicológicos y de Comunicación, Mecánica.
  - Conv. A-4: Prevención de Riesgos, Transporte de Carga, Conducción, Aspectos Psicológicos y
    de Comunicación, Mecánica.

  Cada columna lleva su fecha de evaluación, como en el real.
- **AC10 (pantalla y código SENCE)**: Given un libro de convalidación elegido en el selector,
  When se ve en pantalla, Then muestra las mismas secciones que un curso normal, incluido el
  código SENCE **editable**: vacío por defecto (igual que los demás cursos) y, si el
  Admin/Secretaria lo ingresa, se guarda para ese libro de convalidación y se imprime en su
  portada. El código SENCE de un libro de convalidación es independiente del de su curso madre.
- **AC9 (sin impacto fuera del Libro de Clases)**: Given cualquier otra pantalla profesional
  (matrícula, asistencia, evaluaciones, certificación, archivo, promociones), Then no cambia
  nada: no aparecen cursos de convalidación ni cambian los conteos.

### Edge cases obligatorios

- **AC-E1**: Given una promoción sin alumnos que convalidan, When se genera un libro de
  convalidación, Then se genera igual, con las filas de alumnos vacías (25) y sin error.
- **AC-E2**: Given más de 25 alumnos que convalidan, Then las tablas de alumnos se paginan sin
  cortar filas, igual que en la 0017-m.
- **AC-E3**: Given un curso madre con menos fechas activas que N (feriados, promoción corta),
  Then se usan todas las disponibles y se imprime el mismo aviso de "bloques sin fecha" de la
  0017-m, sin inventar fechas.
- **AC-E4**: Given un alumno que convalida con la matrícula cancelada o en borrador, Then no
  aparece en el libro de convalidación (mismo filtro que el libro madre).

---

## 4. Out of scope

- ❌ Crear `promotion_courses` de convalidación o sesiones propias en la BD (opción A, descartada
  por ahora).
- ❌ Registrar asistencia o notas del curso de convalidación en el sistema (el libro sigue siendo
  una plantilla imprimible).
- ❌ Cambiar la regla de la convalidación (A2 convalida A4, A5 convalida A3) o el wizard de
  matrícula.

---

## 5. Dependencias

### Specs previas
- 0017-m (generador del libro: tamaño de página, reglamento, helpers de grillas, calendario,
  ortografía corregida). Se reutiliza, no se duplica.

### Capacidades del proyecto que se asumen existentes
- `license_validations` (`enrollment_id`, `convalidated_license`), escrita por
  `enrollment.facade.ts` al matricular.
- `professional_theory_sessions` del curso madre (fechas activas).
- `LibroDeClasesFacade` y la Edge Function `generate-class-book-pdf`.

### Capacidades nuevas requeridas
- Ninguna tabla nueva. Una migración aditiva sobre `class_book` para guardar el código SENCE
  de cada libro de convalidación (AC10).

---

## 6. Datos y modelo (preliminar)

- Sin tablas nuevas ni `promotion_courses` nuevos.
- `class_book` hoy tiene una fila por `promotion_course_id` (el upsert usa
  `onConflict: 'promotion_course_id'`). Para AC10 se agrega la columna nullable
  `convalidation_license` (`'A3' | 'A4'`, `NULL` = libro normal) y la unicidad pasa a ser
  `(promotion_course_id, convalidation_license)`, colgando del `promotion_course_id` del curso
  madre. Las filas existentes quedan con `NULL` y siguen igual. RLS sin cambios (mismas
  policies de admin/secretaria). Migración idempotente y documentada en `DATABASE.md`.
- Mapeo fijo: Conv. A-3 → curso madre A5, sufijo `.6`; Conv. A-4 → curso madre A2, sufijo `.7`.
- La Edge Function necesita saber qué libro generar. Propuesta: seguir recibiendo el
  `promotion_course_id` del curso madre más un parámetro opcional `convalidation: 'A3' | 'A4'`.
  El detalle va en `plan.md`.
- Modelo UI del selector: los 2 libros de convalidación son entradas "virtuales" (sin
  `promotion_course_id` propio). El detalle va en `plan.md`.

---

## 7. UX y flujos (preliminar)

- Pantalla afectada: `/app/admin/libro-de-clases`, solo el selector de curso y la exportación
  a PDF.
- Flujo: el Admin elige la promoción, luego "Conv. A-3" o "Conv. A-4" en el selector, y hace
  click en "Exportar PDF" para descargar el libro de convalidación.
- Estado vacío: sin alumnos que convalidan, el libro se ve y se imprime con filas vacías.

---

## 8. Métricas de éxito post-launch

- El dueño compara lado a lado el PDF generado con `libroclasesconva3.pdf` /
  `libroclasesconva4.pdf` y confirma que coinciden (salvo los alumnos precargados y la ortografía
  corregida).

---

## 9. Notas / decisiones abiertas

- [x] Pantalla al elegir un libro de convalidación: **lo mismo que un curso normal, incluido el
  código SENCE editable** (vacío por defecto). Decisión del dueño 2026-09-24 → AC10.
- [x] N = 16 (Conv. A-3) y 13 (Conv. A-4), tomado de los libros reales. Decisión del dueño
  2026-09-24: "si así es el real, entonces sí".

---

## Changelog

- 2026-09-24 — draft inicial por Matías. Opción B (libros de convalidación armados al vuelo, sin
  `promotion_courses` nuevos) aprobada por el dueño. Nombres y RUN de los alumnos precargados
  (pedido explícito).
- 2026-09-24 — AC10: pantalla igual a un curso normal, con código SENCE editable (migración
  aditiva en `class_book`); N = 16/13 según los libros reales. Decisiones del dueño.
- 2026-09-24 — aprobada por Matías (owner).
