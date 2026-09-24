# Plan 0018-m — Libros de Clases de convalidación (Conv. A-3 y Conv. A-4)

> **Spec:** [spec.md](./spec.md)
> **Status:** approved
> **Created:** 2026-09-24
> **Talla:** M (confirmada por el dueño 2026-09-24)

---

## 1. Resumen ejecutivo

Los 2 libros de convalidación son **entradas virtuales** del selector del Libro de Clases: se
identifican por `(promotion_course_id del curso madre, convalidation: 'A3' | 'A4')` y se arman con
datos existentes, sin crear `promotion_courses`. Se hace en este orden:

1. Reglas puras de convalidación en un util testeado.
2. Migración aditiva en `class_book` para guardar el código SENCE de cada libro de convalidación.
3. Facade y pantalla con el selector de 6 libros.
4. Edge Function: 2 mallas transcritas, portada, estructura sin Feriados y evaluaciones de 5
   columnas.

> ⚠️ **Prerrequisito:** hacer commit de los cambios pendientes de la spec 0017-m y de los
> fix-258/259 (facade, componente, modelo y Edge Function del Libro de Clases) **antes** de
> empezar, para no mezclar el diff de dos specs en los mismos archivos.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/app/core/utils/convalidation-book.utils.ts` | Util puro | Mapeo Conv. A-3 → madre A5, sufijo `.6`; Conv. A-4 → madre A2, sufijo `.7`. `CONV_SESSION_DAYS` (16 / 13). `selectConvalidationDates(activeDates, n)` (últimas N). Nombres de las 5 asignaturas de evaluación por libro. `buildBookOptions(cursos)`: los 4 cursos más 2 entradas virtuales. |
| `src/app/core/utils/convalidation-book.utils.spec.ts` | Test | TDD de todo lo anterior (ver §7). |
| `supabase/migrations/20260924120000_class_book_convalidation_license.sql` | Migration | Columna `convalidation_license` y nueva unicidad (ver §4). |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/models/ui/libro-de-clases.model.ts` | Nuevo `LibroOption` (`key`, `promotionCourseId`, `convalidation: 'A3' \| 'A4' \| null`, `label`). `LibroCabecera` suma `convalidation` y `moduleNames`. | AC1 y AC10: el selector ya no se identifica solo por `promotion_course_id`. |
| `src/app/core/facades/libro-de-clases.facade.ts` | `_cursos` pasa a opciones de libro (4 más 2 virtuales). `selectCurso(key)`. En convalidación, `loadCabecera`, `loadAlumnos`, `loadAsistenciaSemanal`, `loadCalendario`, `loadEvaluaciones`, `saveClassBookFields` y `exportPdf` usan el curso madre más el filtro. | AC1 a AC5, AC8 y AC10 |
| `src/app/core/facades/libro-de-clases.facade.spec.ts` | Casos nuevos (ver §7). | testing-tdd |
| `src/app/features/libro-de-clases/libro-de-clases.component.ts` | El selector usa `key` como `optionValue`. `moduleHeaders` sale de `cabecera().moduleNames` (5 en convalidación). | AC1, AC8 y AC10 |
| `src/app/features/libro-de-clases/libro-de-clases.component.spec.ts` | Ajustar a las opciones con `key`, con un caso de convalidación. | testing-tdd |
| `supabase/functions/generate-class-book-pdf/index.ts` | Body con `convalidation?: 'A3' \| 'A4'`. Alumnos filtrados por `license_validations`, últimas N fechas, `getConvA3Curriculum()` / `getConvA4Curriculum()` transcritas, portada "CURSO CONVALIDACIÓN CLASE A-3/A-4", ID con sufijo, código SENCE de la fila de convalidación, sin página de Recuperación de Feriados, evaluaciones de 5 asignaturas, días previos al inicio con "-", y upsert de `class_book` con `convalidation_license`. | AC2 y AC4 a AC8 |
| `indices/DATABASE.md` | Documentar la columna nueva y la nueva unicidad de `class_book`. | Sincronización obligatoria |
| `indices/FACADES.md`, `indices/UTILS.md`, `indices/MODELS.md` | Nuevo util, `LibroOption` y los cambios del facade. | Sincronización |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- La pantalla completa `libro-de-clases.component.ts` (secciones, subnav y editor del código
  SENCE) sin cambios de layout: un libro de convalidación se ve igual que un curso (AC10).
- `p-select` del selector de curso: solo cambia el `optionValue`.

### Facades/Services existentes que extendemos
- `LibroDeClasesFacade`: mismo flujo SWR y mismas secciones. Los métodos `load*` reciben el
  contexto `{ promotionCourseId, convalidation }` en vez de solo el ID.
- `LibroDeClasesFacade.saveClassBookFields()`: mismo INSERT/UPDATE con auditoría RF-103, más
  `convalidation_license`.
- La Edge Function `generate-class-book-pdf` (spec 0017-m): se reutilizan el reglamento,
  `drawStudentGridPages()`, `drawGridTable()`, el Calendario y `groupIntoSessionBlocks()`, el
  aviso de bloques sin fecha, `wrapToWidth()` y la portada. No se duplica ningún helper.
- `convalidation.utils.ts` (`fetchConvalidationMap()`, fix-195-m): se evalúa reutilizarlo para
  el filtro de alumnos. Si trae más de lo necesario, se usa un join directo
  `license_validations!inner` en el SELECT de `enrollments`.

### Componentes/Facades que NO existen y debemos crear
- Solo `convalidation-book.utils.ts`. La lógica de convalidación (mapeo, sufijos, últimas N
  fechas y opciones del selector) son funciones puras (Functional Core, `architecture.md`); no
  van dentro del facade. No se crea ningún facade ni componente nuevo.

---

## 4. Modelo de datos

### Migración requerida

```sql
-- supabase/migrations/20260924120000_class_book_convalidation_license.sql (pseudo-SQL)
ALTER TABLE class_book
  ADD COLUMN IF NOT EXISTS convalidation_license TEXT
  CHECK (convalidation_license IN ('A3', 'A4'));      -- NULL = libro normal

-- Hoy: UNIQUE (promotion_course_id)  [20260405110000_class_book_unique_promotion_course.sql]
ALTER TABLE class_book DROP CONSTRAINT IF EXISTS class_book_promotion_course_id_key;
ALTER TABLE class_book
  ADD CONSTRAINT class_book_promotion_course_conv_key
  UNIQUE NULLS NOT DISTINCT (promotion_course_id, convalidation_license);
-- NULLS NOT DISTINCT (PG15+): sigue habiendo a lo sumo 1 fila "normal" por curso.
```

- Las filas existentes quedan con `convalidation_license = NULL` y siguen iguales.
- Es idempotente (`IF NOT EXISTS` / `DROP ... IF EXISTS`). Antes de fijarlo, verificar que la
  versión de Postgres del proyecto soporte `NULLS NOT DISTINCT`. Si no lo soporta, usar un
  índice único sobre `(promotion_course_id, COALESCE(convalidation_license, ''))`.

### RLS

Sin cambios: las policies de `class_book` (admin/secretaria) cubren las filas nuevas. No se crea
ninguna tabla.

### Modelos UI/DTO

- `core/models/ui/libro-de-clases.model.ts`: `LibroOption` nuevo; `LibroCabecera` suma
  `convalidation` y `moduleNames`.
- DTO de `class_book`: agregar `convalidation_license` si existe un DTO (verificar en
  `MODELS.md`).

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
Admin → LibroDeClasesComponent (Smart, features/)
          ├─ selector: facade.cursos()  → [A2, A3, A4, A5, Conv. A-3, Conv. A-4]
          │              (buildBookOptions(), util puro)
          ├─ onCursoChange(key) → facade.selectCurso(key)
          └─ exportar PDF → facade.exportPdf()

LibroDeClasesFacade (core/facades)
  selectCurso(key) → { promotionCourseId, convalidation }
    convalidation = null  → flujo actual (sin cambios)
    convalidation = 'A3'  → madre = curso A5 de la promoción
    convalidation = 'A4'  → madre = curso A2 de la promoción
      ├─ cabecera: promotion_courses (madre) + class_book (madre, convalidation_license)
      ├─ alumnos: enrollments del curso madre ⋈ license_validations(convalidated_license)
      ├─ fechas: professional_theory_sessions activas del madre
      │          → selectConvalidationDates(fechas, CONV_SESSION_DAYS[conv])
      └─ exportPdf → invoke('generate-class-book-pdf',
                           { promotion_course_id: madre, convalidation })

generate-class-book-pdf (Edge Function)
  convalidation ? libro de convalidación (17 páginas del real) : libro normal (0017-m)
```

### Capas tocadas

- **Smart**: `features/libro-de-clases/libro-de-clases.component.ts`
- **Dumb**: ninguno
- **Facade**: `core/facades/libro-de-clases.facade.ts`
- **Util**: `core/utils/convalidation-book.utils.ts` (nuevo)
- **Edge Function**: `supabase/functions/generate-class-book-pdf/index.ts`
- **Migration**: `supabase/migrations/20260924120000_class_book_convalidation_license.sql`

---

## 6. Restricciones aplicables

- [x] `architecture.md` — Facade, OnPush y lógica en funciones puras (`convalidation-book.utils.ts`)
- [x] `facades.md` — el facade ya es branch-scoped vía `resolveBranchScope()`; los libros de
      convalidación heredan el mismo filtro de promociones
- [x] `models.md` — `LibroOption` en `core/models/ui/`, sin interfaces locales en el componente
- [ ] `visual-system.md` — no cambia el layout ni los tokens
- [x] `swr-pattern.md` — `refreshSilently()` debe recargar el libro seleccionado por `key`,
      incluido uno de convalidación
- [x] `notifications.md` — reutiliza `ToastService` (guardado del código SENCE y exportación)
- [x] `testing-tdd.md` — spec del util primero; facade y componente con casos nuevos
- [ ] `ai-readability.md` — sin botones nuevos; el selector ya tiene `data-llm-description`

---

## 7. Plan de testing

**Tests unitarios, `convalidation-book.utils.spec.ts` (escrito primero):**
- Mapeo: A3 → madre A5, sufijo `.6`; A4 → madre A2, sufijo `.7`.
- `selectConvalidationDates()`: devuelve las últimas N ordenadas, excluye `cancelled`. Si hay
  menos de N, devuelve todas (AC-E3).
- `buildBookOptions()`: 4 cursos → 6 opciones en orden. Si falta el curso madre en la promoción,
  no se genera la entrada de convalidación correspondiente.
- Nombres de las 5 asignaturas por libro (AC8).

**Tests unitarios, `libro-de-clases.facade.spec.ts`:**
- El selector expone 6 libros, aunque ningún alumno convalide (AC1 y AC-E1).
- Conv. A-3: solo alumnos del curso A5 con `convalidated_license = 'A3'`; excluye matrículas
  cancelled/draft (AC2 y AC-E4).
- Un libro normal sigue trayendo a todos los alumnos del curso, incluidos los que convalidan
  (AC3).
- Cabecera: ID con sufijo y fechas del tramo (AC4 y AC5).
- `saveClassBookFields` en convalidación inserta/actualiza la fila con `convalidation_license`
  y no toca la fila del curso madre (AC10).
- `exportPdf` envía `{ promotion_course_id: madre, convalidation }`.

**Edge Function:**
- Comparación palabra por palabra, por columna, de las mallas transcritas contra
  `libroclasesconva3.pdf` / `libroclasesconva4.pdf` (mismo script de la 0017-m, con
  `pdftotext -tsv`), aceptando solo las diferencias de ortografía corregida.
- Revisión ortográfica con hunspell es_ES.
- Conteo de bloques de día de cada malla = 16 / 13. Si no coincide con N, se detiene la
  implementación y se consulta al dueño antes de seguir.
- `deno check --no-config` sin errores.

**QA manual:**
- `npm run test:ci`, `npm run lint:arch` y `/verify` en `/app/admin/libro-de-clases`
  (selector de 6 libros, cambio entre libros, guardado del código SENCE en un libro de
  convalidación sin afectar al curso madre).
- Generar los 2 PDFs de convalidación y compararlos visualmente con los reales (lo valida el
  dueño).
- AC9: abrir Matrícula, Asistencia, Evaluaciones, Certificación y Archivo, y confirmar que no
  cambió nada.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| El upsert de `class_book` en la Edge Function usa `onConflict: 'promotion_course_id'`. Al cambiar la unicidad, esa línea falla con error y el PDF normal deja de guardar su URL. | Alta si se olvida | Actualizar ese upsert a `onConflict: 'promotion_course_id,convalidation_license'` en la misma tarea que la migración, y probar la exportación de un libro normal. |
| Postgres del proyecto sin `NULLS NOT DISTINCT` (< PG15). | Baja | Verificar la versión antes de escribir la migración; alternativa: índice con `COALESCE`. |
| El `loadCabecera` del facade usa `.maybeSingle()` sobre `class_book` por `promotion_course_id`. Con 2 filas (normal y convalidación) daría error. | Alta | Filtrar siempre con `.is('convalidation_license', null)` o `.eq('convalidation_license', conv)`. Cubierto con un test. |
| Cambiar `selectedCursoId: number` a `key: string` rompe el componente o sus tests. | Media | El `key` de un curso normal es su ID en texto; ajustar el spec del componente. Mismo PR. |
| La malla transcrita no suma 16 / 13 bloques de día. | Media | Contar al transcribir. Si difiere, consultar al dueño y no forzar N. |
| En la Asistencia semanal, los días de la primera semana previos al inicio deben ir con "-" y no con "LIBRE". | Media | Regla explícita en la Edge Function: día < fecha de inicio → "-"; día sin sesión dentro del tramo → "LIBRE". Verificar contra la página 7 del real. |
| Diff mezclado con los cambios sin commit de la 0017-m. | Alta | Prerrequisito del §1: commit previo. |

---

## 9. Orden de implementación

1. **Prerrequisito:** commit de lo pendiente de la 0017-m / fix-258 / fix-259.
2. `convalidation-book.utils.spec.ts` y luego `convalidation-book.utils.ts` (TDD).
3. Migración de `class_book` y `DATABASE.md`.
4. Modelo UI (`LibroOption`, `LibroCabecera`).
5. Facade y sus tests (selector, alumnos, fechas, cabecera, código SENCE y exportación).
6. Componente y su spec (selector por `key`, `moduleHeaders`).
7. Edge Function: parámetro `convalidation` y upsert corregido. Después la transcripción de las
   2 mallas, verificada con los scripts. Por último la portada, la estructura y las evaluaciones.
8. `npm run test:ci`, `npm run lint:arch`, `/verify` y la verificación visual del dueño.
9. Sincronizar los índices (`/sync-indices`).

---

## 10. Estimación

M: 1 a 3 días. La transcripción verbatim de las 2 mallas (23 filas cada una) y su verificación
es la parte más larga.

---

## Changelog

- 2026-09-24 — plan inicial
- 2026-09-24 — aprobado por Matías (owner)
