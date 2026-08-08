# Hotfix: Consistencia visual del botón "Quitar foto" en tab cámara
> id: hotfix-059-m-consistencia-boton-quitar-foto-tab-camara
> refs: fix-137-m-eliminar-foto-carnet-matricula
> status: done
> closed: 2026-08-07
> created: 2026-08-07

## Problema
El botón de quitar foto del tab "Tomar foto" quedó como un badge circular con solo el
ícono `x` (flotante sobre la imagen), distinto del botón "Quitar foto" con ícono
`trash-2` + texto que se agregó en el tab "Subir archivo" (fix-137). El usuario pidió
usar el mismo botón con label, por consistencia entre ambos tabs.

## Cambios
- **Archivo:** `src/app/shared/components/matricula-steps/documents/documents.component.html` — reemplaza el botón circular `x` flotante del tab "camera" por un botón con ícono `trash-2` + texto "Quitar foto", mismo estilo que el del tab "upload".
