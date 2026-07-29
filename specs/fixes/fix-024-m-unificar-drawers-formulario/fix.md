# fix-024-m — Unificar el diseño de los drawers de formulario

## Contexto

El dueño detectó inconsistencia visual entre drawers: la Agenda envuelve su
contenido en una card y se ve bien; "Nueva comunicación" (`task-create`) tiene
los campos flotando sueltos sobre el fondo del drawer; "Nuevo Relator"
(`relator-crear`) tiene los inputs sobre el mismo gris del host, creando un
contraste incómodo. Causa raíz: no existe un contenedor canónico para el
cuerpo de un drawer de formulario, así que cada uno improvisa fondo, ancho,
agrupación y footer. La skill `form-ux §6` ya define la estructura correcta,
pero nada la impone.

## Cambio (piloto)

1. **Nuevo componente `app-drawer-form`** (`shared/components/drawer-form/`):
   shell de layout que encapsula `form-ux §6` — superficie `bg-surface` tipo
   card, cuerpo scrolleable con la columna de campos llenando el ancho de la
   card (padding `px-6` como margen; ancho acotable vía input `maxWidthRem`),
   y footer fijo al fondo (slot proyectado `[drawer-form-footer]`). Solo layout;
   los tokens de campo (`.field-*`) siguen siendo responsabilidad del drawer
   (globalizarlos es fase 2).
2. **Migrar 2 pilotos** al shell: `task-create-drawer` y `admin-relator-crear-drawer`.
   Footer canónico: `justify-end` con `btn-secondary` (Cancelar) + `btn-primary`.

Fase 2 (fuera de este fix): globalizar `.field-*`/`.section-title` y propagar
el shell al resto de drawers de formulario en lotes.

## Acceptance Criteria

- [x] Existe `app-drawer-form` con proyección de contenido + slot de footer,
      OnPush, sin `@Input()`/`@Output()` (usa `input()`).
- [x] `task-create` y `relator-crear` renderizan su formulario dentro del shell:
      cuerpo `bg-surface`, campos a ancho completo de la card, footer fijo con
      Cancelar/acción.
- [x] `npm run test:ci` (tsc + specs) sin regresiones — 1081/1082, único fallo
      `auth.facade > whenReady` preexistente y ajeno al cambio. `tsc --noEmit`
      limpio. Verificación visual aprobada por el dueño en `ng serve` (incluido
      el ajuste de ancho full-width solicitado).
