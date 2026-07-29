# Hotfix: orden de nombre incorrecto en Ex Alumnos B / Profesional

## Problema
`ExAlumnosFacade.mapRow()` (`ex-alumnos.facade.ts:172-176`) arma el nombre como
`nombres apellido_paterno apellido_materno`, distinto al orden canónico usado en
Base de Alumnos (`apellido_paterno apellido_materno nombres`, vía
`buildStudentDisplayName` en `core/utils/student-name.util.ts`). Esta facade
alimenta tanto la lista de Ex Alumnos B como la de Ex Alumnos Profesionales
(filtradas por `licenseGroup`), así que ambas vistas muestran el orden incorrecto.

## Fix
Usar `buildStudentDisplayName()` (el mismo util que ya usa Base de Alumnos) en
`mapRow()` en vez de construir el string manualmente.

## AC
- Ex Alumnos B y Ex Alumnos Profesionales muestran el nombre como
  "apellido paterno - apellido materno - nombres", igual que Base de Alumnos.

## Cierre
- `ex-alumnos.facade.ts` ahora usa `buildStudentDisplayName()` en `mapRow()`, el mismo util que compone el nombre en Base de Alumnos (apellido paterno → materno → nombres).
- Afecta a ambas listas (Ex Alumnos B y Ex Alumnos Profesionales), ya que comparten esta única facade filtrada por `licenseGroup`.
- `tsc --noEmit` limpio.
