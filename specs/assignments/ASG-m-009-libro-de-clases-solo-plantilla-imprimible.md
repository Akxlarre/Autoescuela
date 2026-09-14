# Asignación ASG-m-009 — Libro de Clases debe ser una plantilla imprimible, no un reflejo de datos digitales

> **status:** pendiente
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-09-14
> **created_by:** m
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Hoy el Libro de Clases (`libro-de-clases.facade.ts`) se comporta como un reporte en vivo:
lee las mismas tablas que pueblan las vistas de Evaluaciones y Asistencia
(profesional/teórica) y muestra ahí las notas y marcas de asistencia ya ingresadas en esas
vistas. Esto es incorrecto respecto a cómo se usa en la práctica: el Libro de Clases físico
siempre se llena a mano y lápiz, y la única utilidad de la vista digital es poder
**imprimirlo en blanco** para llenarlo físicamente.

Por lo tanto, el Libro de Clases debe dejar de precargar resultados (notas, asistencia,
etc.) desde las tablas transaccionales. Lo único que debe seguir poblándose
automáticamente es el **nombre de los alumnos** que son parte del curso/promoción — todo lo
demás (evaluaciones, asistencia, cualquier otra sección de resultados) debe aparecer vacío
en todas las secciones, listo para llenarse a mano tras imprimir.

Las vistas de Evaluaciones y Asistencia (donde sí se ingresan datos) **no cambian** — siguen
funcionando igual, y le sirven a admin/secretaria como respaldo virtual del libro físico. Lo
que importa en la práctica es lo que quede escrito en el libro físico, no lo cargado en esas
vistas digitales.

## Alcance sugerido

- En `libro-de-clases.facade.ts` / el componente `libro-de-clases`, dejar de leer/mapear
  `professional_module_grades`, `professional_theory_attendance`,
  `professional_practice_attendance`, `professional_weekly_signatures` (y cualquier otra
  tabla de resultados) hacia la vista de Libro de Clases.
- Mantener la carga automática de los nombres de alumnos matriculados en el curso/promoción
  (vía `enrollments`/`students`/`users`), en todas las secciones donde corresponda.
- Mantener el dato propio del Libro de Clases que no depende de otra vista: código SENCE y
  horario (tabla `class_book`, `saveClassBookFields()`) — eso no cambia.
- Confirmar que el layout impreso siga teniendo el espacio/formato correcto para llenar a
  mano cada sección (notas, asistencia por sesión, etc.) aunque ahora esté vacía.
- No tocar `evaluaciones-profesional.facade.ts` ni `asistencia-profesional.facade.ts` — esas
  vistas siguen funcionando exactamente igual, son independientes de este cambio.

## Referencias

- Ninguna.

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/libro-de-clases.facade.ts`
- `src/app/features/libro-de-clases/libro-de-clases.component.ts`
- `src/app/shared/components/libro-de-clases-subnav/`

## Notas para quien la reclame

- Verificar con `/verify` que la impresión del Libro de Clases siga viéndose correctamente
  (espaciado, tablas) con las secciones de resultados vacías en vez de precargadas.
- Ojo con no romper el guardado del código SENCE/horario (`class_book`), que sí debe seguir
  funcionando igual — es el único dato propio de esta vista.
