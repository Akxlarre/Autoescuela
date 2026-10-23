# Fix: El editor de plantillas protege los cambios sin publicar
> id: fix-469-m-editor-plantillas-cambios-sin-publicar
> refs: fix-447-m-testing-documentos-certificacion (S20) · 0016-m
> status: done
> closed: 2026-10-20
> created: 2026-10-20

## Root Cause

`DocumentContentTemplatesFacade.load()` no limpiaba el formulario al empezar. Si la carga de la
sede o tipo nuevo fallaba, quedaba en pantalla el formulario anterior, con los selectores mostrando
la sede nueva, y "Publicar" escribía en la sede anterior (`publish()` usa `form.branchId`).

Además, el editor no distinguía un borrador de lo publicado: cambiar de sede o de tipo, o salir de
la página, descartaba los cambios en silencio, y "Publicar" (que cambia lo que reciben los alumnos
desde ese momento) se ejecutaba sin confirmación.

## ACs Afectados

- AC propio — Si la carga de una sede o tipo falla, no queda ningún formulario: "Publicar" y
  "Vista previa" quedan deshabilitados.
- AC propio — Con cambios sin publicar, el editor lo indica, los selectores de sede y tipo quedan
  bloqueados y aparece "Descartar cambios", que vuelve al texto publicado.
- AC propio — "Publicar" pide confirmación nombrando el documento y la sede.
- AC propio — Salir de Documentos con cambios sin publicar pide confirmación.

## Cambio

- `DocumentContentTemplatesFacade`: `load()` limpia el form al empezar; contenido publicado en
  memoria; `hasUnsavedChanges`; `discardChanges()`; tras publicar, el borrador pasa a ser lo publicado.
- `DmsListContentComponent`: input `templateHasUnsavedChanges`, output `templateDiscardRequested`;
  aviso, selectores deshabilitados y botón "Descartar cambios".
- `AdminDocumentosComponent`: confirmación antes de publicar.
- `core/guards/document-template-draft.guard.ts` (nuevo) + spec, en la ruta `admin/documentos`.

## Test de Regresión

- `document-content-templates.facade.spec.ts` — carga fallida deja el form en null; cambios y
  descarte; publicar actualiza lo publicado.
- `document-template-draft.guard.spec.ts` — sin cambios deja salir; con cambios pregunta.

## Progreso

- [x] Tests rojos → verdes
- [x] `lint:arch`, `test:ci`
- [x] `/verify` del editor
