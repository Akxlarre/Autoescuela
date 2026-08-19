# Hotfix: Drag and drop en zonas de subida (contrato firmado y foto carnet)
> id: hotfix-076-m-drag-and-drop-upload-contrato-foto
> refs: —
> status: done
> closed: 2026-08-19
> created: 2026-08-19

## Problema
Las cajas de subida de archivo (contrato firmado en `contract.component.html`, foto
carnet en `documents.component.html`) solo aceptan click — no soportan arrastrar y
soltar el archivo, a pesar de tener el estilo visual de dropzone (borde punteado +
ícono de nube).

## Cambios
- **Archivo:** `src/app/core/directives/file-dropzone.directive.ts` (nuevo) —
  directiva `appFileDropzone` que escucha `dragover`/`dragleave`/`drop`, aplica una
  clase de estado `is-dragover` al host, y emite `output()` con el primer `File`
  soltado.
- **Archivo:** `src/app/shared/components/matricula-steps/contract/contract.component.html`
  — aplica `appFileDropzone` a la caja punteada de subida del contrato firmado,
  conectada al mismo handler que ya procesa `onFileSelected`.
- **Archivo:** `src/app/shared/components/matricula-steps/contract/contract.component.ts`
  — agrega método que recibe el `File` soltado y reusa la lógica de validación/subida
  existente de `onFileSelected`.
- **Archivo:** `src/app/shared/components/matricula-steps/documents/documents.component.html`
  — aplica `appFileDropzone` al contenedor de la pestaña "Subir archivo" de la foto
  carnet (ambos estados: vacío y ya subida/reemplazo).
- **Archivo:** `src/app/shared/components/matricula-steps/documents/documents.component.ts`
  — agrega método que recibe el `File` soltado y reusa `onFileChange` para `id_photo`.
