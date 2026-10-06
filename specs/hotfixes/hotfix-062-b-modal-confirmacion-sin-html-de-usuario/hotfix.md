# Hotfix: El modal de confirmación interpreta como HTML lo que escriben los usuarios
> id: hotfix-062-b-modal-confirmacion-sin-html-de-usuario
> refs: ASG-i-037 (sospecha S10, caso F10 del checklist 037; confirmada en fix-190-b)
> status: done
> closed: 2026-10-06
> created: 2026-10-06

## Problema
El modal de confirmación global (`app-shell.component.ts`) pinta el mensaje con `[innerHTML]`, y
varias llamadas interpolan datos escritos por usuarios sin escapar: la descripción de un egreso
(Caja, admin y secretaria), el nombre de una plantilla, de un servicio, de un cliente, de un alumno.
Angular quita los scripts, pero `<b>`, `<a href>` o `<img>` sí se renderizan dentro del modal. Solo
las 4 llamadas de "Rematricular" usan HTML a propósito, y esas ya escapan el nombre (`escapeHtml`).

Efecto lateral: el mensaje de "ya cursó anteriormente" de la matrícula usa saltos de párrafo (`\n\n`)
que `innerHTML` ignora: hoy se ve como un solo bloque.

## Cambios
- **Archivo:** `src/app/core/services/ui/confirm-modal.service.ts` (+ spec) — `ConfirmConfig.allowHtml`
  (por defecto `false`).
- **Archivo:** `src/app/layout/app-shell.component.ts` — por defecto el mensaje va como texto
  (`{{ }}`, que Angular escapa) con `white-space: pre-line`; `[innerHTML]` solo con `allowHtml`.
- **Archivos:** las 4 llamadas de "Rematricular" (`admin-ex-alumnos`, `secretaria-ex-alumnos`,
  `admin-ex-alumnos-profesional`, `secretaria-ex-alumnos-profesional`) — `allowHtml: true`.

## Verificación
- `vitest` del servicio; `ng build`, `lint:arch`, `test:ci`; E2E del modal con un texto con HTML.
- Resultado: `confirm-modal.service.spec.ts` 8/8 (1 nuevo); E2E nuevo `e2e/modal-confirmacion.spec.ts`
  1/1 contra el build de producción (un servicio llamado `E2E-<b>negrita</b>` se ve literal en el
  modal de "Borrar servicio" y el modal no contiene ningún `<b>`; el servicio sembrado se borra al
  final). `ng build` OK, `lint:arch` 0 errores.
