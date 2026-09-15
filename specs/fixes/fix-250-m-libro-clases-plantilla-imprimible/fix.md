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
<!-- Archivo tocado y descripción en una línea. Un fix = un cambio puntual. -->
- **Archivo:** `src/app/core/facades/libro-de-clases.facade.ts`
- **Qué cambia:** ...

## Test de Regresión
<!-- El test que prueba que el fix funciona. Debe quedar verde post-fix. -->
- `ruta/archivo.spec.ts > nombre del test` ✓
