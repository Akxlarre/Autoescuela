# Hotfix: el historial de notificaciones abierto no se actualiza
> id: hotfix-105-b-historial-notificaciones-al-dia
> refs: ASG-i-035 (checklist 035, S17 · G04, G05)
> status: done
> created: 2026-10-20

## Problema
Con el drawer "Historial de Notificaciones" abierto (verificado en e2e):
- **G05:** "Marcar todo como leído" (y "marcar grupo leído") solo actualizaban la lista del panel;
  en el historial las filas seguían "sin leer" hasta cerrarlo y volver a abrirlo.
- **G04:** una notificación nueva llegaba al panel y al toast, pero no aparecía en el historial.

## Cambios
- **Archivo:** `src/app/core/facades/notifications.facade.ts` (+ spec): `markAllAsRead` y
  `markManyAsRead` marcan también el historial (y lo revierten si falla); la notificación que llega
  por Realtime se agrega también al historial si ya está cargado.

Fuera de alcance (por diseño, decisión del owner 2026-09-04): el historial no distingue las
eliminadas ni navega al hacer clic.

## Verificación
- [x] vitest de `notifications.facade` (33); `lint:arch` sin errores.
- [x] e2e `comunicacion-notificaciones.spec.ts` G04 y G05.
