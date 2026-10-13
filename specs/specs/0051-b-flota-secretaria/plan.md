# Plan 0051-b — Flota para la secretaria, limitada a su sede

> **Status:** aprobado (alcance decidido por el owner el 2026-10-12, §6 de la spec). La migración se
> aplica en producción solo con su aprobación explícita.

## Diseño

### 1. La regla, una sola vez — `core/utils/vehicle-permissions.utils.ts` (pura + spec)

```ts
canManageVehicle(user, vehicle): boolean   // crear/editar ficha, documentos y mantenimientos
canViewVehicle(user, vehicle): boolean     // aparece en su Flota
```

| Quién | Ve | Opera |
|---|---|---|
| admin | todo | todo |
| secretaria con grant multi-sede | todo | todo |
| secretaria sin grant | su sede + "Ambas" | solo su sede y que no sea "Ambas" |
| otro rol | nada | nada |

`FlotaFacade` y `FlotaDetalleFacade` agregan `canManage` a cada `VehicleTableRow` (campo derivado
del modelo de UI); las pantallas solo leen ese campo.

### 2. La BD exige lo mismo (migración — requiere aprobación para aplicar)

`supabase/migrations/20261012150000_spec0051_flota_secretaria.sql`:

- `auth_can_manage_vehicle(vehicle_id)` — `STABLE SECURITY DEFINER`, `search_path = ''`: la misma
  tabla de arriba, del lado del servidor.
- `vehicle_documents` y `maintenance_records`, INSERT y UPDATE: `auth_can_manage_vehicle(vehicle_id)`
  (antes solo admin).
- `vehicles`, INSERT y UPDATE: la rama de la secretaria suma "o tiene grant multi-sede" (antes
  solo su sede y no "Ambas"). La rama del instructor en UPDATE queda igual.
- DELETE y SELECT: sin cambios (borrar sigue siendo solo del admin; leer, ver §5 de la spec).
- Storage: sin cambios — el bucket `documents` ya permite a la secretaria la carpeta `vehicle-docs`.

Marcar un vehículo como "Ambas" lo sigue ofreciendo solo el formulario del admin; para una
secretaria con grant la BD no lo impide (puede editar un "Ambas" existente, que es lo pedido).

### 3. Pantallas

- **Rutas:** `/app/secretaria/flota` y `/app/secretaria/flota/:id/mantenimientos`, con los mismos
  componentes del admin (`AdminFlotaComponent`, `VehicleMaintenancesComponent`). La base de los
  enlaces (`/app/admin` o `/app/secretaria`) sale de `data.basePath` de la ruta.
- **Menú:** "Flota" en el menú de la secretaria.
- **Botones según `canManage`:** en el listado (tabla y tarjetas) "Editar" solo si puede operar;
  "Agenda", "Documentos" y "Mantenimientos" siempre (son consulta). En el drawer de Documentos y en
  la página de mantenimientos, las acciones de cargar/editar/registrar solo si puede operar.
- **Formulario:** el selector de sede ya trata a la secretaria (su sede fija; con grant elige sede;
  "Ambas" solo admin) — se le pasa el grant.
- **Detalle por URL (AC2):** `FlotaDetalleFacade.loadVehicleDetail()` no carga un vehículo que la
  persona no puede ver: muestra "Vehículo no encontrado".

### 4. Búsqueda global (AC7)

Con la ruta creada, la sugerencia existente deja de estar rota. Sin cambios de código ahí.

## Validación

| AC | Cómo |
|---|---|
| AC1, AC2, AC6, AC7 | e2e con secretaria A, secretaria B y multi-sede (solo lectura) |
| AC3 | e2e interceptando la escritura (payload correcto) + test SQL impersonando, sin efectos |
| AC4, AC5, AC-E2 | `supabase/tests/rls/0051-b-flota-secretaria.sql` (impersona, todo en sub-bloques que abortan) + e2e de botones |
| AC8 | e2e de Flota del admin existentes (`flota-*.spec.ts`) + test SQL |
| AC-E1 | test SQL: el `audit_log` de un INSERT hecho como secretaria lleva su `user_id` |
| Regla | `vehicle-permissions.utils.spec.ts` |

## Riesgos

- **PRs abiertos de Flota (#262–#264)** tocan el listado y el formulario: se integran antes de cerrar.
- **Secretaria con grant puede editar "Ambas" y la otra sede:** es lo decidido; queda en Auditoría.
- **KM al finalizar clase (S2 del checklist):** una secretaria sin grant sigue sin poder actualizar el
  km de un vehículo "Ambas" (no lo opera). Se resuelve en su propio fix, no acá.
