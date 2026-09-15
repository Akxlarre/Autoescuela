# Fix: Libro de Clases debe ser una plantilla imprimible, no un reflejo de datos digitales
> id: fix-250-m-libro-clases-plantilla-imprimible
> refs: ASG-m-009 (specs/assignments/ASG-m-009-libro-de-clases-solo-plantilla-imprimible.md)
> status: in_progress
> created: 2026-09-15

## Root Cause

[Heredado de ASG-m-009, a confirmar]: hoy el Libro de Clases (`libro-de-clases.facade.ts`) se
comporta como un reporte en vivo — lee las mismas tablas que pueblan las vistas de Evaluaciones
y Asistencia (profesional/teórica) y muestra ahí las notas y marcas de asistencia ya ingresadas
en esas vistas. Esto es incorrecto respecto a cómo se usa en la práctica: el Libro de Clases
físico siempre se llena a mano y lápiz, y la única utilidad de la vista digital es poder
**imprimirlo en blanco** para llenarlo físicamente.

Por lo tanto, el Libro de Clases debe dejar de precargar resultados (notas, asistencia, etc.)
desde las tablas transaccionales. Lo único que debe seguir poblándose automáticamente es el
**nombre de los alumnos** que son parte del curso/promoción — todo lo demás (evaluaciones,
asistencia, cualquier otra sección de resultados) debe aparecer vacío en todas las secciones,
listo para llenarse a mano tras imprimir. La sección se renderiza con la misma estructura de
tabla/espacio de impresión, sin datos de BD — no se elimina la sección.

Las vistas de Evaluaciones y Asistencia (donde sí se ingresan datos) **no cambian** — siguen
funcionando igual, y le sirven a admin/secretaria como respaldo virtual del libro físico.

## ACs Afectados

Ninguna spec declaró ACs para esta vista. ACs que este fix establece:

- **AC-1:** el Libro de Clases deja de leer/mapear `professional_module_grades`,
  `professional_theory_attendance`, `professional_practice_attendance`,
  `professional_weekly_signatures` (y cualquier otra tabla de resultados transaccionales) hacia
  la vista.
- **AC-2:** la carga automática de nombres de alumnos matriculados (vía
  `enrollments`/`students`/`users`) se mantiene igual en todas las secciones donde corresponda.
- **AC-3:** el dato propio del Libro de Clases que no depende de otra vista (código SENCE y
  horario — tabla `class_book`, `saveClassBookFields()`) sigue funcionando igual.
- **AC-4:** el layout impreso mantiene el espacio/formato correcto para llenar a mano cada
  sección (notas, asistencia por sesión, etc.) ahora vacía — sin regresión visual de impresión.
- **AC-5:** `evaluaciones-profesional.facade.ts` y `asistencia-profesional.facade.ts` no se
  tocan — esas vistas siguen funcionando exactamente igual.

## Cambio

- **Archivo:** `src/app/core/facades/libro-de-clases.facade.ts`
  - `loadAsistenciaSemanal()`: deja de consultar `professional_theory_attendance` y
    `professional_weekly_signatures`. Sigue consultando `professional_theory_sessions` (solo
    para armar la grilla de semanas/días del layout imprimible). Cada celda de asistencia queda
    `null` y `firmaSemanal` queda `false` para todos los alumnos.
  - `loadEvaluaciones()`: deja de consultar `professional_module_grades`. Pasa a ser síncrono
    (ya no hace `await`): mapea los alumnos ya cargados a `notas` (array de `null`),
    `notaFinal: null`, `aprobado: false`.
  - `loadResumenAsistencia()`: deja de consultar `professional_theory_sessions` (contadas
    completadas), `professional_practice_sessions`, `professional_theory_attendance` y
    `professional_practice_attendance`. Pasa a ser síncrono: mapea los alumnos a
    `{ nombre, pctPractica: null, pctTeorica: null }`.
  - `loadAllSections()`: `loadEvaluaciones()`/`loadResumenAsistencia()` se llaman sin `await`
    (ya no son async) antes del `Promise.all` de las secciones restantes.
- **Archivo:** `src/app/core/models/ui/libro-de-clases.model.ts`
  - `ResumenAsistenciaLibro.pctPractica` / `.pctTeorica` pasan de `number` a `number | null`
    (`null` = plantilla vacía, sin dato precargado).
- **Archivo:** `src/app/features/libro-de-clases/libro-de-clases.component.ts`
  - Sección "resumen" (Asistencia Clase Profesional): renderiza `—` en vez de `0%` cuando
    `pctPractica`/`pctTeorica` son `null`, sin las clases de color de estado.
  - `alumnos`, `profesores`, `calendario` y `cabecera`/`class_book` (código SENCE + horario) no
    se tocaron — siguen precargándose igual, fuera del alcance de este fix.
- **Archivo:** `supabase/functions/generate-class-book-pdf/index.ts`
  - El generador del PDF real (invocado por el botón "Exportar PDF") consultaba estas mismas 4
    tablas de forma **independiente** al facade de Angular — el fix del facade por sí solo NO
    corregía el PDF exportado. Se le aplicó el mismo cambio: deja de consultar
    `professional_module_grades`, `professional_theory_attendance`,
    `professional_practice_attendance` y `professional_practice_sessions` (ya no se usa nada de
    asistencia práctica). Sigue consultando `professional_theory_sessions` (grilla de
    semanas/días + calendario), `enrollments` (alumnos), `promotion_course_lecturers`
    (profesores) y `class_book` (SENCE/horario).
  - Las secciones "CONTROL DE ASISTENCIA (FIRMA DIARIA)", "EVALUACIONES CLASE PROFESIONAL" y
    "ASISTENCIA CLASE PROFESIONAL" del PDF dibujan `—` en cada celda de resultado en vez de
    calcularlas — mismo criterio que el facade.
  - Desplegada por el usuario a Supabase (`skvekggejikzxhzsjmkz`) durante esta sesión; verificada
    exportando un PDF real (ver Test de Regresión).

## Test de Regresión

- `src/app/core/facades/libro-de-clases.facade.spec.ts`:
  - `evaluaciones: plantilla imprimible — nombres precargados, notas y nota final vacías (fix-250-m)` ✓
  - `asistencia semanal: plantilla imprimible — grilla de semana/días armada, marcas y firma vacías (fix-250-m)` ✓
  - `resumen asistencia: plantilla imprimible — nombres precargados, porcentajes vacíos (fix-250-m)` ✓
  - Resto de la suite del facade (20/20) ✓ — sin regresión en cabecera, alumnos, profesores,
    calendario, `saveClassBookFields`, `exportPdf`, `reset`.
- `src/app/features/libro-de-clases/libro-de-clases.component.spec.ts` — 20/20 (2 archivos, 20
  tests) sin regresión.
- `npm run test:ci` — 191 archivos / 2455 tests, sin regresiones en el resto del proyecto.
- `npx tsc --noEmit` — 0 errores.
- `npm run lint:arch` — 0 errores, 174 advertencias (baseline preexistente, sin regresión).
- `/verify` (Playwright, admin@test.com) sobre `/app/admin/libro-de-clases`: login OK, navegación
  sin errores de consola. Con Promoción 277 / Curso A2 (1 alumno real, "Merino Osses Samuel
  José"): pestañas "Firma", "Eval." y "Res." muestran el nombre precargado con celdas de
  resultado en `—`. Exportado el PDF real (botón "Exportar PDF", tras despliegue de la Edge
  Function por el usuario) y verificado archivo descargado — portada/lista de clase con el
  alumno, profesores y calendario con datos propios, y las 3 secciones de resultados
  (asistencia semanal, evaluaciones, resumen de asistencia) con el nombre precargado y todas
  las celdas en `—`, sin notas/asistencia/firmas horneadas en el PDF.
