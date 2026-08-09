# Fix: DMS upload drawer no filtra tipos de documento ya subidos (selector genérico)
> id: fix-147-m-dms-upload-drawer-tipos-no-filtrados
> refs: 0007-m-dms-documentos-por-matricula (AC-E2, mismo drawer)
> status: done
> closed: 2026-08-09
> created: 2026-08-09

## Root Cause
`DmsUploadDrawerComponent.usedStudentTypes` (y su análogo `usedInstructorTypes`) solo calcula
los tipos ya subidos comparando `selectedStudentId()` contra `facade.studentDetail()?.studentId`
— que solo está poblado si el drawer se abrió con `preselectedId` desde el propio drawer de
detalle del alumno/instructor (`openStudentDocsDrawer`/`openInstructorDocsDrawer`, que llaman
`loadStudentDocuments`/`loadInstructorDocuments` antes de abrir). Si el drawer se abre desde el
selector genérico "Subir documento" (`openUpload('student')` sin id, botón de cabecera en
`secretaria-documentos.component.ts` / `admin-documentos.component.ts`) y el usuario elige un
alumno del dropdown, `facade.studentDetail()` sigue apuntando a `null` o a otra entidad — el
computed cae al fallback documentado ("no se filtra nada") y el selector "Tipo de documento"
ofrece todos los tipos aunque el alumno ya tenga varios subidos.

## ACs Afectados
- Ninguno de una spec cerrada — es un bug de comportamiento no cubierto por ningún AC existente
  (el comentario original en el código ya documentaba la limitación como conocida, pero en uso
  real produce datos duplicados/erróneos, no solo "no filtra").

## Cambio
- **Archivo:** `src/app/features/admin/documentos/dms-upload-drawer/dms-upload-drawer.component.ts`
- **Qué cambia:** se agrega un `effect()` en el constructor que, cuando `currentUploadMode()`
  es `'student'`/`'instructor'` y el `selectedStudentId()`/`selectedInstructorId()` elegido no
  coincide con la entidad ya cargada en `facade.studentDetail()`/`instructorDetail()`, dispara
  `facade.loadStudentDocuments(id)` / `facade.loadInstructorDocuments(id)`. Esto reutiliza la
  misma carga que ya usa el drawer de detalle (sin duplicar lógica ni tocar el Facade), y hace
  que `usedStudentTypes`/`usedInstructorTypes` se re-evalúen con datos reales apenas la carga
  resuelve — sin importar por qué puerta se abrió el drawer de subida.

## Test de Regresión
- `dms-upload-drawer.component.spec.ts > filtra los tipos ya subidos cuando el alumno se
  selecciona desde el dropdown genérico (sin preselectedId)` ✓
