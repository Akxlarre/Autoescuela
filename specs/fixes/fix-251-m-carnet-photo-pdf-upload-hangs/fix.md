# Fix: Foto carnet se cuelga en "Subiendo foto..." al subir un PDF
> id: fix-251-m-carnet-photo-pdf-upload-hangs
> refs: —
> status: done
> closed: 2026-09-15
> created: 2026-09-15

## Root Cause
En el flujo de matrícula de secretaria (Paso 3: Documentación), `onDocFileSelected()`
(`secretaria-matricula.component.ts`) llama a `normalizePhoto(event.file)` sin `try/catch`.
Cuando el archivo no es una imagen decodificable (ej. un PDF), `<img>.onerror` dispara y
`normalizePhoto` rechaza la promesa (`image.utils.ts:59-62`). El `await` sin capturar lanza
un unhandled rejection y el resto del método (incluida la llamada a
`docs.uploadCarnetPhoto()`) nunca se ejecuta.

El spinner local `isUploadingPhoto` (`documents.component.ts`) solo se apaga vía un
`effect()` que observa `data().carnetPhoto?.capturedDataUrl` — nunca se apaga en caso de
error — por lo que queda girando indefinidamente ("Subiendo foto...").

## ACs Afectados
Ninguno — fix autónomo (bug reportado por QA manual, sin spec asociada).
- AC-1: Subir un archivo no-imagen (PDF) en el campo de foto carnet muestra un error legible
  y el spinner se apaga, permitiendo reintentar.

## Cambio
- **Archivo:** `src/app/core/models/ui/enrollment-documents.model.ts` — agrega
  `uploadError: string | null` a `EnrollmentDocumentsData`.
- **Archivo:** `src/app/core/facades/enrollment-documents.facade.ts` — agrega método
  `setUploadError(message: string)` para registrar errores de validación previos al upload
  (ej. `normalizePhoto` fallido), reutilizando el signal `_error` existente.
- **Archivo:** `src/app/features/secretaria/matricula/secretaria-matricula.component.ts` —
  envuelve la rama `id_photo` de `onDocFileSelected()` en `try/catch`, notifica con
  `ToastService.error()` y llama a `docs.setUploadError()`; expone `uploadError` en
  `step3Data()`.
- **Archivo:** `src/app/shared/components/matricula-steps/documents/documents.component.ts` —
  los `effect()` que apagan `isUploadingPhoto` y `uploadingDocType` también reaccionan a
  `data().uploadError`, cubriendo tanto la foto carnet como el resto de documentos
  (mismo patrón de spinner-nunca-se-apaga-en-error).

## Test de Regresión
- `src/app/features/secretaria/matricula/secretaria-matricula.component.spec.ts >
  SecretariaMatriculaComponent — error al subir foto carnet inválida (fix-251-m) > captura el
  rechazo de normalizePhoto, notifica error y no invoca uploadCarnetPhoto` ✓ (8/8 tests verdes)
