# Hotfix: un mantenimiento realizado no puede tener fecha futura
> id: hotfix-082-b-mantenimiento-sin-fecha-futura
> refs: ASG-i-032 (checklist 032, M08; decisión del owner 2026-10-16)
> status: closed
> created: 2026-10-16

## Problema
El formulario "Registrar Servicio" guardaba como "Completado" un servicio con fecha de mañana o
de dentro de un mes. Decisión: no se permiten fechas futuras.

## Cambios
- **Archivo:** `src/app/core/utils/date.utils.ts` (+ spec) — `notAfterTodayValidator` (hoy de Chile).
- **Archivo:** `src/app/features/admin/flota/maintenance-form-drawer/maintenance-form-drawer.component.ts` —
  el selector no ofrece días posteriores a hoy y, si se escribe uno, avisa y no deja guardar.

## Verificación
- [x] vitest del validador (con reloj fijado a las 23:30 de Chile).
- [x] e2e `flota-checklist.spec.ts` L01/M01/M02: registrar un servicio con fecha de hoy sigue funcionando.
