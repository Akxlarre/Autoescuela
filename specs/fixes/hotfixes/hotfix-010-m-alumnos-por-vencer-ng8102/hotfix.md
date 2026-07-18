# hotfix-010-m — NG8102 en alumnos-por-vencer-drawer

## Problema
`item.cursos[0]?.nombre ?? '—'` dispara el diagnóstico NG8102: el tipo de
`EnrollmentCurso.nombre` es `string` no nullable, por lo que el compilador
marca el `??` como innecesario.

## Causa raíz
`AdminAlumnosFacade.mapToAlumnoTableRow` garantiza `cursos` no vacío
(fallback `[{ nombre: '—', licenseGroup: 'class_b' }]`), así que
`cursos[0]` siempre existe tanto en tipo como en runtime — el fallback
`?.`/`??` es código muerto.

## Cambio
`alumnos-por-vencer-drawer.component.ts` línea 52 — simplificar
`item.cursos[0]?.nombre ?? '—'` a `item.cursos[0].nombre`.

## Acceptance Criteria
- [x] El diagnóstico NG8102 ya no aparece en esa línea.
- [x] El texto renderizado no cambia (el fallback '—' ya viene garantizado
      por el facade).
