# Fix: "Descargar" descarga el documento, también desde el visor
> id: fix-468-m-descargar-documento-descarga
> refs: fix-447-m-testing-documentos-certificacion (S22)
> status: done
> closed: 2026-10-20
> created: 2026-10-20

## Root Cause

El botón "Descargar" del drawer de vista previa (`DmsDocPreviewDrawerComponent`) y el del visor
(`DmsViewerModalComponent`) armaban un `<a download target="_blank">` con la URL firmada de
Storage. El atributo `download` se ignora en URLs de otro origen (Supabase Storage no es el origen
de la app), así que el navegador abría el archivo en una pestaña nueva en vez de descargarlo.
Además, el visor solo mostraba "Descargar" para formatos no soportados: un PDF o una imagen no se
podían descargar desde ahí.

Storage acepta el parámetro `download=<nombre>` en URLs firmadas y públicas (no forma parte del
token) y responde con `Content-Disposition: attachment`: esa es la descarga real.

## ACs Afectados

- AC propio — "Descargar" (drawer de vista previa y visor) descarga el archivo con el nombre del
  documento; si el nombre no trae extensión, se le agrega la del archivo.
- AC propio — El visor ofrece "Descargar" también para PDF e imágenes.
- AC propio — Con una URL que no es de Storage, se mantiene el comportamiento anterior (abrir en
  pestaña nueva).

## Cambio

- `core/utils/document-download.utils.ts` (nuevo, puro) + spec: `documentDownloadUrl(url, nombre)`.
- `DmsViewerService.download(doc)`: única implementación del clic de descarga.
- `DmsViewerModalComponent`: barra inferior con "Descargar" para PDF e imagen; usa el servicio.
- `DmsDocPreviewDrawerComponent`: usa el servicio.

## Test de Regresión

- `document-download.utils.spec.ts` — URL firmada, URL pública, nombre sin extensión, nombre con
  caracteres especiales, URL externa.
- `dms-viewer.service.spec.ts` — `download()` hace clic en un enlace con la URL de descarga.

## Progreso

- [x] Tests rojos → verdes
- [x] `lint:arch`, `test:ci`
- [x] `/verify`: descarga desde el drawer y desde el visor (PDF)
