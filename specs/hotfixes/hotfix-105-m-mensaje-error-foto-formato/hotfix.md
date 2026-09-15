# Hotfix: Mensaje de error de foto carnet inválida sugiere formatos incorrectos
> id: hotfix-105-m-mensaje-error-foto-formato
> refs: fix-251-m-carnet-photo-pdf-upload-hangs
> status: done
> closed: 2026-09-15
> created: 2026-09-15

## Problema
El toast de error al fallar `normalizePhoto()` (fix-251-m) decía "Usa JPG o PNG", pero
`normalizePhoto` acepta cualquier formato de imagen (los convierte a JPEG si hace falta) — solo
falla cuando el archivo no es una imagen decodificable (PDF, etc.). El mensaje inducía a error.

## Cambios
- **Archivo:** `src/app/features/secretaria/matricula/secretaria-matricula.component.ts` —
  cambia el texto del error a "El archivo no es una imagen. Sube una foto, no un PDF u otro
  documento."
