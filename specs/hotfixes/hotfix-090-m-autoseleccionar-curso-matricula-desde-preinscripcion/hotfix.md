# Hotfix: Autoseleccionar curso al elegir promoción en matrícula desde pre-inscripción
> id: hotfix-090-m-autoseleccionar-curso-matricula-desde-preinscripcion
> refs: —
> status: done
> created: 2026-08-25
> closed: 2026-08-25

## Problema
En el drawer de pre-inscripción profesional, al matricular, tras elegir la promoción el
operador debe además elegir manualmente el "curso" dentro de esa promoción. Pero
`AdminPreInscritosFacade.mapToPromocionOption()` (admin-pre-inscritos.facade.ts:733) ya
filtra `promotion_courses` por la `licencia` que el alumno eligió en su pre-inscripción,
así que `selectedCourses()` para ese pre-inscrito siempre trae un único curso (el que
corresponde a su clase, no a los 4 A2/A3/A4/A5 de la promoción completa). Obligar al
clic manual es fricción redundante sobre un dato que el sistema ya conoce.

## Cambios
- **Archivo:** `src/app/features/admin/alumnos/pre-inscritos/admin-pre-inscrito-drawer.component.ts` — en `onPromoChange()`, si la promoción elegida resuelve a un único curso (`courses.length === 1`), autoseleccionar `selectedPromoCourseId`/`selectedCourseId` con ese curso en vez de dejarlos en `null`. Si hay más de uno, mantener el flujo manual actual (no debería ocurrir para un pre-inscrito con licencia definida, pero se preserva como fallback).
