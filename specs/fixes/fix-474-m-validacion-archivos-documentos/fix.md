# Fix: La validación de documentos rechaza archivos vacíos o disfrazados, y no deja el anterior
> id: fix-474-m-validacion-archivos-documentos
> refs: fix-447-m-testing-documentos-certificacion (D10, D11, D12, D13)
> status: done
> closed: 2026-10-20
> created: 2026-10-20

## Root Cause

`validateDocumentFile()` (regla compartida por DMS, documentos de vehículo, ficha de vehículo y
alta de instructor) solo mira el MIME que declara el navegador, que sale de la extensión, y el
tamaño máximo. Verificado en el drawer "Subir documento":

- **D12** — un archivo de 0 bytes se acepta y se sube.
- **D10** — un `.exe` renombrado a `.pdf` se acepta: nadie mira el contenido.
- **D11 / D13** — si se elige un archivo válido y después uno inválido, se muestra el error pero
  el válido anterior **sigue seleccionado** y "Subir" queda habilitado: se sube algo distinto de lo
  último que el usuario eligió. Mismo patrón en los drawers de vehículo.

## ACs Afectados

- AC propio — Un archivo de 0 bytes se rechaza: "El archivo está vacío."
- AC propio — Un archivo cuyo contenido no es PDF, JPG, PNG ni WEBP (firma de los primeros bytes)
  se rechaza con "El archivo no es un PDF o una imagen válida.", aunque su extensión lo sea.
- AC propio — Elegir un archivo inválido deja sin archivo seleccionado (el anterior se descarta) y
  "Subir" deshabilitado.
- Aplica en los 4 puntos de subida y en "Reemplazar" (fix-471-m).

## Cambio

- `core/utils/document-file-validation.util.ts` (+ spec): rechazo de 0 bytes en
  `validateDocumentFile()`; nueva `checkDocumentFile(file)` (async) = reglas + firma del contenido.
- `dms-upload-drawer`, `vehicle-documents-drawer`, `vehicle-form-drawer`,
  `admin-instructor-crear-drawer`, `DmsFacade.replaceStudentDocument()`: usan `checkDocumentFile` y
  limpian la selección anterior cuando el archivo nuevo es inválido.

## Test de Regresión

- `document-file-validation.util.spec.ts` — 0 bytes; firma PDF/JPG/PNG/WEBP válida; `.exe` con
  extensión `.pdf`; las reglas de tipo/vacío se aplican antes que la firma.

## Progreso

- [x] Tests rojos → verdes
- [x] `lint:arch`, `test:ci`
- [x] Navegador: D10, D12, D13 en "Subir documento"

### Resultado (2026-10-20)

- Navegador ("Subir documento"): `.exe` renombrado → "El archivo no es un PDF o una imagen válida."; 0 bytes → "El archivo está vacío."; válido y luego `.docx` → error, sin archivo, "Subir" deshabilitado.
- `test:ci` de core + flota + instructores + documentos: 3715 verdes; `lint:arch` 0 errores.
