# Fix: La secretaria puede cambiar el catálogo de servicios, que es común a las dos sedes
> id: fix-434-m-catalogo-servicios-solo-admin
> refs: fix-429-m-testing-servicios-especiales (decisión M08 / D09 / E10)
> status: done
> closed: 2026-10-15
> created: 2026-10-15

## Root Cause

`service_catalog` no tiene sede: es un catálogo único para las dos sedes. Las policies de
INSERT/UPDATE/DELETE admiten a admin y secretaria, y la pantalla de la secretaria tiene los mismos
botones que la del admin (agregar, editar, borrar, reactivar, eliminar definitivamente). La
secretaria de una sede cambiaba precios o desactivaba servicios de la otra. Probado el 2026-10-15:
UPDATE de `service_catalog` como secretaria → 1 fila.

**Decisión de Matías (2026-10-15, M08):** el catálogo sigue siendo común; solo el admin lo crea,
edita y borra. La secretaria solo vende (el precio es editable en cada venta).

## ACs Afectados

Ninguno — fix autónomo. ACs propios:

- AC-1: la BD rechaza que una secretaria cree, modifique o borre un servicio del catálogo.
- AC-2: la pantalla de la secretaria no muestra "Agregar servicio", "Mostrar inactivos", ni los
  botones de editar, borrar, reactivar o eliminar; sí "Vender", "Registrar Venta" y "Ver Historial".
- AC-3: con el catálogo vacío, la secretaria ve un estado vacío sin botón de agregar, que le dice
  que el administrador agrega los servicios.
- AC-4: el admin sigue con todas las acciones.

## Cambio

- `supabase/migrations/20261015150000_fix434_catalogo_servicios_solo_admin.sql` — policies de
  INSERT/UPDATE/DELETE de `service_catalog`: solo admin.
- `shared/components/servicios-especiales-content` — input `puedeEditarCatalogo` (default `true`):
  en `false` oculta las acciones del catálogo y los inactivos.
- `features/secretaria/servicios-especiales` — pasa `[puedeEditarCatalogo]="false"` y deja de
  conectar las acciones del catálogo.

## Test de Regresión

- `servicios-especiales-content.component.spec.ts > sin permiso de catálogo nunca muestra inactivos`.
- `supabase/tests/rls/fix-434-m-catalogo-servicios-solo-admin.sql` (transacción revertida).
- Migración aplicada por Matías el 2026-10-15; test SQL re-ejecutado contra la BD real ✅.
