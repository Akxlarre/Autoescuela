# Hotfix: Renombrar AnticiosFacade → AnticiposFacade (typo)
> id: hotfix-054-m-renombrar-anticiosfacade-a-anticiposfacade
> status: done
> closed: 2026-07-27
> created: 2026-07-27

## Problema

El Facade de Anticipos está mal escrito: `AnticiosFacade` en vez de `AnticiposFacade`. 37 ocurrencias
en 11 archivos (código de producción, tests, índices y una spec histórica).

## Cambios

- **Archivo:** `src/app/core/facades/anticipos.facade.ts` — clase `AnticiosFacade` → `AnticiposFacade`
- **Archivo:** `src/app/core/facades/anticipos.facade.spec.ts` — todas las referencias al import/clase
- **Archivo:** `src/app/features/admin/contabilidad-anticipos/admin-contabilidad-anticipos.component.ts` — import + `inject(AnticiosFacade)`
- **Archivo:** `src/app/features/admin/contabilidad-anticipos/registrar-anticipo-drawer.component.ts` — import + uso
- **Archivo:** `indices/COMPONENTS.md` — referencias documentales
- **Archivo:** `indices/SERVICES.md` — referencias documentales
- **Archivo:** `indices/FACADES.md` — referencias documentales
- **Archivo:** `indices/USAGE-MAP.md` — referencias documentales
- **Archivo:** `indices/NOTIFICATIONS-MAP.md` — referencias documentales
- **Archivo:** `specs/specs/0025-b-notificaciones-ola-2/plan.md` — referencia histórica (se corrige por consistencia, es texto congelado de una spec ya cerrada)
- **Archivo:** `specs/fixes/fix-071-m-anticipos-no-reactivo-a-sede/fix.md` — referencia histórica (fix ya cerrado, se corrige por consistencia)
