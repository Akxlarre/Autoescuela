# Fix: "Actividad reciente" no muestra qué se agregó en un INSERT (solo en DELETE/UPDATE)
> id: fix-107-m-actividad-reciente-insert-sin-detalle
> refs: fix-105-m-actividad-reciente-eliminados-genericos
> status: done
> closed: 2026-08-02
> created: 2026-08-02

## Root Cause

`DashboardFacade.mapAuditLogToActivity()` (`src/app/core/facades/dashboard.facade.ts:459-464`)
descarta `log.detail` para la rama `INSERT` y arma un mensaje genérico fijo:

```typescript
if (log.action === 'INSERT') {
  title = `Nuev${artO} ${entityLabel.toLowerCase()}`;
  desc = `Registrad${artO} por ${userName}`;   // ← nunca usa log.detail
  ...
}
```

Mientras que `DELETE` (fix-105-m) sí usa `log.detail` para mostrar qué se eliminó
(`"Sistema / Online eliminó: Foto (Carnet) de Patricia Aguilar"`), `INSERT` quedó con el
mensaje genérico original ("Registrado por Sistema / Online"), sin decir qué se registró.

El backend (`log_change()`, cualquier migración vigente) sí construye un `v_detail` completo
para INSERT — `'Registrado: ' + v_entity_label` (ej. `"Registrado: Foto (Carnet) de Patricia
Aguilar"`) — el dato existe en `audit_log.detail`, pero el frontend lo ignora para esta rama.
Confirmado con prueba manual del dueño: subir un documento nuevo no mostró qué documento fue.

## ACs Afectados
Ninguno — fix autónomo (reportado por el dueño tras probar manualmente el módulo de
Actividad Reciente post fix-101..106-m).

## Cambio
- **Archivo:** `src/app/core/facades/dashboard.facade.ts`
- **Qué cambia:** rama `INSERT` de `mapAuditLogToActivity()` ahora usa `log.detail` (con el
  mismo patrón de `replace(/^Registrado:\s*/, '')` que DELETE usa para su prefijo), igual que
  ya hacen `UPDATE` y `DELETE`.

## Test de Regresión
- `src/app/core/facades/dashboard.facade.spec.ts > mapAuditLogToActivity > INSERT incluye el detalle del registro creado` ✓
