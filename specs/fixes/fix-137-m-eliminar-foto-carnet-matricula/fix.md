# Fix: No se puede eliminar la foto de carnet subida en matrícula
> id: fix-137-m-eliminar-foto-carnet-matricula
> refs: —
> status: done
> closed: 2026-08-07
> created: 2026-08-07

## Root Cause
El botón "Quitar foto" del paso de Documentos nunca fue cableado a un handler funcional
en ninguno de los dos flujos de matrícula:

1. **Interno (secretaria, Clase B y Profesional)** — `documents.component.html`: la X de
   eliminar solo existe dentro del bloque `@if (activePhotoTab() === 'camera')`, que es un
   flujo de cámara sin implementar (el botón "Activar Cámara" tampoco tiene handler). El
   tab "Subir archivo" — el único realmente funcional — no tiene ningún botón de eliminar,
   solo "Cambiar foto" (que reemplaza vía picker, pero no permite borrar sin reemplazar). El
   botón X de la pestaña cámara además no tiene `(click)` alguno.
2. **Público** — `public-documents.component.ts`: el botón "Cambiar" sí llama a
   `handleClearPhoto()`, que emite `fileSelected.emit({ type: 'clear', file: null })`. Pero
   `PublicEnrollmentComponent.onFileSelected()` solo maneja `event.type === 'id_photo'` — el
   caso `'clear'` se descarta en silencio. Además el template tiene un binding
   `(clearPhoto)="facade.clearCarnetPhoto()"` sobre `<app-public-documents>`, un output que
   ese componente nunca declaró ni emitió — código muerto que nunca se ejecuta.

## ACs Afectados
Ninguno — fix autónomo (bug de UI descubierto en QA manual, no ligado a una spec activa).

## Cambio
- **Archivo:** `src/app/shared/components/matricula-steps/documents/documents.component.html` /
  `.ts` — agrega botón "Quitar foto" funcional en el tab "Subir archivo" (el real), conectado
  a un nuevo output `photoRemoved`.
- **Archivo:** `src/app/features/secretaria/matricula/secretaria-matricula.component.ts` /
  `.html` — maneja `(photoRemoved)` llamando a un nuevo método del facade que borra el
  registro en `student_documents` (y limpia el signal local).
- **Archivo:** `src/app/core/facades/enrollment-documents.facade.ts` — nuevo método
  `removeCarnetPhoto(enrollmentId)` que borra la fila de `student_documents` (type `id_photo`)
  y llama a `clearCarnetPhoto()`.
- **Archivo:** `src/app/shared/components/public-enrollment-steps/public-documents/public-documents.component.ts` —
  agrega output `clearPhoto` real (reemplaza el `fileSelected` type:`'clear'` no manejado) y
  botón "Quitar foto" explícito distinto de "Cambiar".
- **Archivo:** `src/app/features/public-enrollment/public-enrollment.component.ts` — el binding
  `(clearPhoto)` ya existe apuntando a `facade.clearCarnetPhoto()`; se agrega borrado real en
  `PublicEnrollmentFacade.clearCarnetPhoto()` si corresponde borrar el documento persistido.

## Test de Regresión
- `src/app/core/facades/enrollment-documents.facade.spec.ts > removeCarnetPhoto elimina el registro persistido y limpia el signal` ✓
