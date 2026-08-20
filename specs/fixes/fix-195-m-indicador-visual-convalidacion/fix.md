# Fix: Indicador visual de convalidación en vistas de Clase Profesional
> id: fix-195-m-indicador-visual-convalidacion
> refs: —
> status: done
> closed: 2026-08-20
> created: 2026-08-20

## Root Cause
Cuando un alumno matricula un curso profesional convalidando simultáneamente otra licencia
(A4 dentro de A2, o A3 dentro de A5), `enrollment.facade.ts` (`savePersonalData`) escribe
correctamente una fila en `license_validations` (`enrollment_id`, `convalidated_license`,
`reduced_hours`). Pero ese enrollment queda con exactamente el mismo `promotion_course_id`
del curso madre que un alumno normal — no hay ningún campo propio de convalidación en
`enrollments`. Ninguna vista de Clase Profesional (Alumnos Profesional, Ex-Alumnos,
Asistencia, Evaluaciones, Certificados, Archivo, Libro de Clases) hace join contra
`license_validations` ni renderiza ningún indicador. La única mención en pantalla es un
mensaje de confirmación efímero en el paso 5 del wizard de matrícula, que desaparece tras
cerrar esa pantalla. Resultado: después de matricular, secretaría/administración no tiene
forma de saber, mirando cualquier listado, quién está convalidando.

## ACs Afectados
Ninguno — fix autónomo (gap de visibilidad detectado en conversación con el dueño del
negocio, no una regresión de una spec existente).

- AC-1: En el listado "Alumnos Profesional" (activos/inactivos), cada fila de un alumno con
  registro en `license_validations` muestra un indicador visual (badge) con el texto
  "Convalida A4" o "Convalida A3" según `convalidated_license`.
- AC-2: El mismo indicador aparece en "Ex-Alumnos Profesional" (matrículas `completed`) para
  los alumnos convalidados.
- AC-3: El indicador es visible también en las vistas operativas ancladas al mismo
  `enrollment_id`: Asistencia, Evaluaciones (notas por módulo), Certificados y Archivo.
- AC-4: El indicador no rompe el layout existente en ninguna vista (mobile/desktop, modo
  claro/oscuro) — verificado con `/verify`.
- AC-5: El filtro por clase (A2/A3/A4/A5) del listado principal sigue funcionando igual que
  hoy — el indicador es informativo, no introduce un 5to valor de filtro.

## Cambio
- **`core/utils/convalidation.utils.ts`** (nuevo) — `fetchConvalidationMap(supabase, enrollmentIds)`,
  helper compartido que consulta `license_validations` y devuelve `Map<enrollmentId, 'A4'|'A3'>`.
  Usado por los 6 facades listados abajo para no duplicar la query.
- **Modelos UI** — se agregó `convalidatedLicense?: 'A4' | 'A3' | null` a: `AlumnoProfesionalTableRow`,
  `EgresadoTableRow`, `SesionAlumnoAsistencia`, `ResumenAlumnoAsistencia`, `AlumnoFirmaSemana`,
  `FilaEvaluacion`, `CertificacionProfesionalAlumnoRow`, `ArchivoAlumnoRow`.
- **Facades** — se integró `fetchConvalidationMap()` y se mapeó `convalidatedLicense` en:
  `admin-alumnos-profesional.facade.ts`, `ex-alumnos.facade.ts`, `asistencia-profesional.facade.ts`
  (3 métodos: `selectSesion`, `fetchResumenAlumnos`, `fetchFirmasSemana`),
  `evaluaciones-profesional.facade.ts`, `certificacion-profesional.facade.ts`,
  `archivo-profesional.facade.ts`.
- **Componentes (badge "Convalida A4"/"Convalida A3")** — renderizado junto al nombre del alumno en:
  `alumnos-profesional-list-content.component.ts` (Alumnos Profesional, admin+secretaria),
  `ex-alumnos-profesional-content.component.ts` (Ex-Alumnos Profesional),
  `resumen-alumnos-table.component.ts` y `firma-semanal-table.component.ts` y
  `admin-sesion-drawer.component.ts` (Asistencia),
  `evaluaciones-profesional-content.component.ts` (Evaluaciones),
  `certificacion-profesional-content.component.ts` (Certificados),
  `admin-profesional-archivo.component.ts` (Archivo — reutilizado por secretaria).
  Libro de Clases y Pre-inscritos quedaron fuera de este track (ver nota abajo).

## Test de Regresión
- `convalidation.utils.spec.ts` — 3 tests: Map vacío sin filas, mapeo correcto, Map vacío sin query cuando no hay ids. ✓
- `admin-alumnos-profesional.facade.spec.ts` — mapea `convalidatedLicense` desde `license_validations` y `null` cuando no hay registro. ✓
- `ex-alumnos.facade.spec.ts` — mapea `convalidatedLicense` para egresados profesionales. ✓
- Suite completa de los 6 facades tocados: 72/72 tests verdes (`npx vitest run` sobre los 7 archivos). ✓
- `npx tsc --noEmit` sin errores relacionados a los cambios. ✓

## Nota — alcance no cubierto (fuera de este track)
Libro de Clases (`libro-de-clases.facade.ts`) y Pre-inscritos no se tocaron: el primero ya expone
`enrollmentId` en varias secciones pero requiere su propio mapeo por tener su propio modelo de fila
(`LibroDeClasesFacade`); el segundo no aplica porque un pre-inscrito aún no tiene `enrollment_id`
real (la convalidación se registra en el paso 1 del wizard, que ya ocurre post-creación del
enrollment). Si se necesita cobertura en Libro de Clases, es un fix separado y pequeño siguiendo
el mismo patrón (`fetchConvalidationMap` + badge junto a la columna Licencia).
