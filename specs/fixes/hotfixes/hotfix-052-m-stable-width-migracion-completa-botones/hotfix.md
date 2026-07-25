# Hotfix: Migrar todos los botones restantes a StableWidthDirective (mecanismo ya corregido y verificado)
> id: hotfix-052-m-stable-width-migracion-completa-botones
> status: done
> closed: 2026-07-25
> created: 2026-07-25

## Problema
`StableWidthDirective` (`[appStableWidth]`) ya está corregida (hotfix-050, `ResizeObserver`) y verificada en vivo con Playwright (hotfix-050/051). Faltan ~45 botones hand-rolled en la app con el mismo patrón (`@if(isLoading){spinner+texto corto}@else{icon+label}` sin ancho fijo) que aún se achican. El dueño pidió migrar todos los que apliquen, y excluir (dejar sin tocar) cualquier botón "muy grande" (hero/CTA ancho completo) donde el ancho dinámico sea preferible a uno fijo.

## Cambios

`npx tsc --noEmit -p tsconfig.json` → 0 errores tras la migración.

### Migrados (40 archivos, `[appStableWidth]` + `justify-center` donde faltaba)

- `features/admin/alumno-detalle/editar-perfil-drawer/admin-editar-perfil-drawer.component.ts` — `isSaving()`
- `features/admin/alumno-detalle/inasistencia-drawer/admin-inasistencia-drawer.component.ts` — `isSaving()`
- `features/admin/alumnos/pre-inscritos/admin-pre-inscrito-drawer.component.ts` — botón "generate-contract-pdf": `isGeneratingContract()`
- `features/admin/auditoria/admin-auditoria.component.ts` — `facade.isExporting()`
- `features/admin/certificacion/drawers/enviar-masivo-drawer.component.ts` — `facade.sendingMasivo()`
- `features/admin/certificacion/drawers/generar-pendientes-drawer.component.ts` — `facade.isGeneratingPendientes()`
- `features/admin/configuracion-web/admin-configuracion-web.component.ts` — `facade.isSaving()`
- `features/admin/contabilidad-cuadratura/registrar-egreso-drawer.component.ts` — `isSaving()`
- `features/admin/contabilidad-cursos/admin-curso-singular-crear-drawer.component.ts` — `facade.isSaving()`
- `features/admin/contabilidad-reportes/registrar-gasto-fijo-drawer.component.ts` — `isSaving()`
- `features/admin/flota/maintenance-form-drawer/maintenance-form-drawer.component.ts` — `isSaving()`
- `features/admin/flota/vehicle-form-drawer/vehicle-form-drawer.component.ts` — `isSaving()`
- `features/admin/instructores/admin-instructor-crear-drawer.component.ts` — `facade.isSubmitting()`
- `features/admin/instructores/admin-instructor-editar-drawer.component.ts` — `facade.isSubmitting()`
- `features/admin/profesional-certificados/drawers/enviar-masivo-prof-drawer.component.ts` — `facade.sendingMasivo()`
- `features/admin/profesional-certificados/drawers/generar-pendientes-prof-drawer.component.ts` — `facade.isGeneratingPendientes()`
- `features/admin/profesional-relatores/admin-relator-crear-drawer.component.ts` — `facade.isSubmitting()`
- `features/admin/profesional-relatores/admin-relator-editar-drawer.component.ts` — `facade.isSubmitting()`
- `features/admin/secretarias/admin-secretarias-crear-drawer.component.ts` — `facade.isSubmitting()`
- `features/admin/secretarias/admin-secretarias-editar-drawer.component.ts` — `facade.isSubmitting()`
- `features/instructor/evaluacion/instructor-evaluacion.component.ts` — `isSubmitting()`
- `features/public-enrollment/public-enrollment.component.ts` — botón "skip-psych-test": `facade.isSubmitting()`
- `features/tareas/task-create-drawer.component.ts` — `isSaving()`
- `shared/components/alumnos-list-content/alumnos-list-content.component.ts` — botón "open-export-menu": `isExporting()`
- `shared/components/certificacion-clase-b-content/certificacion-clase-b-content.component.ts` — 5 botones (pendientes/masivo/exportar/generar-fila/confirmar-parcial), señales `isGeneratingPendientes()`, `sendingMasivo()`, `isExporting()`, `generatingId() === alumno.enrollmentId`, `generatingId() === pendingConfirmId()` (solo variantes desktop; variantes mobile con `flex-1` excluidas)
- `shared/components/certificacion-profesional-content/certificacion-profesional-content.component.ts` — mismo patrón que clase-b (5 botones desktop)
- `shared/components/ciclos-teoricos-content/ciclos-teoricos-content.component.ts` — 3 botones: `sendingClassId() === clase.id` (x2), `addingEnrollmentId() === a.enrollmentId`
- `shared/components/detalle-cuadratura-modal/detalle-cuadratura-modal.component.ts` — `facade.isExporting()`
- `shared/components/egreso-modal/egreso-modal.component.ts` — `isSaving()`
- `shared/components/eliminar-alumno-modal/eliminar-alumno-modal.component.ts` — `isDeleting()`
- `shared/components/matricula-steps/documents/documents.component.html` (+ `.ts` imports) — `uploadingDocType() === doc.type`
- `shared/components/matricula-steps/psych-test/psych-test.component.ts` — `loading()`
- `shared/components/public-enrollment-steps/public-documents/public-documents.component.ts` — `isUploading()`
- `shared/components/public-enrollment-steps/public-payment/public-payment.component.ts` — `summary().isSubmitting`
- `shared/components/public-enrollment-steps/public-personal-data/public-personal-data.component.ts` — `_isLoading()`
- `shared/components/public-enrollment-steps/public-schedule/public-schedule.component.ts` — `loading()`
- `shared/components/servicios-especiales-content/drawers/agregar-servicio-drawer.component.ts` — `isSaving()`
- `shared/components/servicios-especiales-content/drawers/registrar-venta-drawer.component.ts` — `isSaving()`
- `shared/components/servicios-especiales-content/servicios-especiales-content.component.ts` — `isExporting()`

### Excluidos — flex-1/w-full o no es botón

- `features/admin/alumno-detalle/reprogramar-clase-drawer/admin-reprogramar-clase-drawer.component.ts` — botón "Confirmar Reprogramación" usa `flex-2` en footer de dos botones (ancho lo define el contenedor flex)
- `features/admin/alumnos/pre-inscritos/admin-pre-inscrito-drawer.component.ts` — 3 botones adicionales (`save-psych-evaluation`, `upload-and-close-enrollment`, `finalize-professional-enrollment`) usan `w-full`/`flex-1`
- `features/admin/asistencia/admin-finalizar-clase-drawer.component.ts` — botón usa `flex-1` en footer
- `features/admin/asistencia/admin-iniciar-clase-drawer.component.ts` — botón usa `flex-1` en footer
- `shared/components/certificacion-clase-b-content/certificacion-clase-b-content.component.ts` — 3 variantes mobile (`flex-1`) de los mismos botones migrados en desktop
- `shared/components/certificacion-profesional-content/certificacion-profesional-content.component.ts` — 3 variantes mobile (`flex-1`) ídem
- `shared/components/cuadratura-content/cuadratura-content.component.ts` — botón "Cerrar Caja" usa `w-full`
- `shared/components/registrar-gasto-fijo-drawer/registrar-gasto-fijo-drawer.component.ts` — botón usa `flex-1`
- `shared/components/schedule-grid/schedule-grid.component.ts` — spinner es overlay de carga, no está dentro de un `<button>`
- `shared/components/historial-cuadraturas-content/historial-cuadraturas-content.component.ts` — spinner es indicador inline ("Sesión en curso"), no está dentro de un `<button>`
- `features/admin/alumno-detalle/reprogramar-clase-drawer/...`, `matricula-steps/assignment/assignment.component.html`, `matricula-steps/personal-data/personal-data.component.html` — spinners son indicadores de carga inline ("Cargando disponibilidad...", "Cargando cursos disponibles..."), no están dentro de `<button>`
- `shared/components/public-enrollment-steps/public-documents/public-documents.component.ts` — el segundo spinner (dropzone de foto) está dentro de un `<div>` clickeable, no de un `<button>`
- Iconos-only `w-8 h-8` en `shared/components/alumnos-list-content/alumnos-list-content.component.ts` (botones "ver ficha PDF" en tabla) — sin texto que cambie de ancho, no aplica

### Excluidos — candidato a tamaño dinámico (a decisión del dueño)

Ninguno detectado en esta pasada: todos los botones que aplicaban son acciones estándar de formulario/drawer/tabla, no CTAs hero de ancho completo con tipografía grande.

Los 3 archivos ya migrados en la sesión previa (fuera de este listado, no tocados de nuevo): `shared/components/async-btn/async-btn.component.ts`, `features/secretaria/pagos/secretaria-pagos.component.ts`, `features/admin/pagos/admin-pagos.component.ts`.
