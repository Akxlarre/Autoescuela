# Hotfix: Botón X de quitar foto en tab "Tomar foto" sin (click)
> id: hotfix-058-m-boton-quitar-foto-tab-camara-sin-click
> refs: fix-137-m-eliminar-foto-carnet-matricula
> status: done
> closed: 2026-08-07
> created: 2026-08-07

## Problema
El fix-137 conectó el botón "Quitar foto" en el tab "Subir archivo" de
`documents.component.html`, pero quedó pendiente el botón X del tab "Tomar foto"
(que muestra la misma foto vía `carnetPhoto`) — sigue sin `(click)`.

## Cambios
- **Archivo:** `src/app/shared/components/matricula-steps/documents/documents.component.html` — agrega `(click)="onRemovePhoto()"` al botón X del preview en el tab "camera" (línea ~116-121).
