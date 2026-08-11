# Hotfix: Reconciliar rama claude/app-like-rollout-b-batch con origin/main (merge)
> id: hotfix-049-b-merge-origin-main-reconciliacion
> status: done
> closed: 2026-08-11
> created: 2026-08-10

## Verificación

- `npx tsc --noEmit`: sin errores.
- `npx ng build --configuration development`: build completo sin errores (171s).
- `npm run lint:arch`: exit 0, 0 errores.
- `npm run test:ci`: 1975/1975 tests en verde (155 archivos, 5 skipped pre-existentes).

## Problema

La rama `claude/app-like-rollout-b-batch` se creó desde un `main` local 11 commits atrás de
`origin/main`. Al mergear `origin/main`, `dms-list-content.component.ts` entra en conflicto
grande: el merge-base es la versión PRE-rollout del archivo, `origin/main` le aplicó 2 parches
puntuales sobre esa versión vieja (hotfix-038-b "class duplicado" + spec 0007-m
"viewStudentDocs ahora emite `{studentId, enrollmentId}`" porque una fila ahora es 1 matrícula,
no 1 alumno), mientras esta rama reescribió el archivo entero (fix-129/130/131-b). Git no puede
3-way-mergear una reescritura completa contra 2 parches puntuales sobre la base vieja — hay que
aplicar esos 2 cambios a mano sobre la versión reescrita.

## Cambios

- **Archivo:** `src/app/shared/components/dms-list-content/dms-list-content.component.ts`
  - `viewStudentDocs` output: `output<number>()` → `output<{ studentId: number; enrollmentId:
    number }>()`, emit actualizado a `{ studentId: row.studentId, enrollmentId:
    row.enrollmentId }` (requiere `StudentWithDocsRow.enrollmentId`, agregado en `dms.model.ts`
    por spec 0007-m, ya mergeado sin conflicto).
  - Ícono de documento institucional (tab "school"): fusiona los 2 atributos `class=`
    duplicados en uno solo (hotfix-038-b upstream, nunca aplicado en esta rama porque se había
    delegado a una tarea aparte).
- Resto de archivos en conflicto (`indices/STYLES.md`, `indices/USAGE-MAP.md`,
  `specs/ASSIGNMENTS.md`) resueltos tomando la unión de ambos lados (bookkeeping generado, sin
  pérdida de información de ninguna rama).
