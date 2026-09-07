# Hotfix: Matrícula con doble ## en la card Info Personal de la ficha de alumno
> id: hotfix-100-m-matricula-doble-hash-ficha-alumno
> refs: —
> status: done
> closed: 2026-09-07
> created: 2026-09-07

## Problema
En la card "Info Personal" de la ficha de alumno, el número de matrícula se muestra
con dos `#` (`##SEED-002945`). El facade `AdminAlumnoDetalleFacade` ya entrega
`alumno.matricula` con el prefijo `#` incluido (`#${summary.number}`), y el template
añade otro `#` literal antes de la interpolación.

El `contextLine` del hero de la misma página ya usa `'Matrícula ' + matricula` sin
`#` literal, así que ahí se ve bien — la inconsistencia es solo en la card.

## Cambios
- **Archivo:** `src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts` — quitar el `#` literal en `>Matrícula #{{ alumno.matricula }}<` (línea ~327), dejando `>Matrícula {{ alumno.matricula }}<`. El prefijo lo pone siempre el facade.
