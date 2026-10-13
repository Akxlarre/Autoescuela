# Acceptance 0051-b — Flota para la secretaria, limitada a su sede

> **Estado (2026-10-13):** código listo y verificado. **Pendiente aplicar la migración**
> `20261012150000_spec0051_flota_secretaria.sql` en producción (requiere aprobación). Sin ella, la
> secretaria ya ve Flota y puede crear y editar vehículos de su sede, pero cargar un documento o
> registrar un mantenimiento le da error de permisos.

| AC | Estado | Evidencia |
|---|---|---|
| AC1 — Menú y acceso | ✅ | `e2e/flota-secretaria.spec.ts`: "Flota" en el menú, ve tantos vehículos como hay en su sede + "Ambas" |
| AC2 — No ve la otra sede | ✅ | e2e: un vehículo exclusivo de la otra sede no aparece ni buscándolo; por URL, su detalle dice "Vehículo no encontrado." (`flota-detalle.facade.spec.ts`) |
| AC3 — Opera en su sede | ✅ app · ⏳ BD | e2e: tiene Editar y "Registrar Servicio"; al crear envía `branch_id` = su sede (creación interceptada). Test SQL (con la migración en una transacción con ROLLBACK): registra mantenimiento, carga documento, edita y crea |
| AC4 — "Ambas" en solo lectura (sin grant) | ✅ app · ⏳ BD | e2e: sin Editar, sin cargar documento, sin "Registrar Servicio" (un vehículo presentado como "Ambas" en la respuesta). Test SQL: la BD rechaza mantenimiento, documento y edición |
| AC5 — La otra sede, cerrada en la BD | ⏳ BD | Test SQL: rechaza mantenimiento y documento en un vehículo de la otra sede |
| AC6 — Sin "Ambas" ni cambio de sede | ✅ | e2e: sin selector de sede ni "Ambas sedes"; el alta sale con su sede y `both_branches = false` |
| AC7 — Búsqueda global | ✅ | e2e: buscar "flota" como secretaria abre `/app/secretaria/flota` y carga |
| AC8 — El admin no cambia | ✅ | e2e del admin (`flota-listado`, `flota-documentos`, `flota-formulario`) 8/8 + test SQL (admin: todo permitido) |
| AC-E1 — Auditoría | ⏳ BD | Test SQL: el mantenimiento registrado como secretaria queda en `audit_log` con su `user_id` |
| AC-E2 — Multi-sede con grant | ✅ app · ⏳ BD | e2e: ve todos los vehículos y tiene Editar en uno de la otra sede. Test SQL: opera sede 1, sede 2 y "Ambas" |

"⏳ BD" = verificado con la migración aplicada dentro de una transacción con ROLLBACK (66 casos, 0
fallas); falta aplicarla de verdad. Contra producción hoy el mismo test falla en 15 casos, que son
exactamente los permisos nuevos.

## Verificación

- vitest: `vehicle-permissions.utils.spec.ts` 17/17; `flota-detalle.facade.spec.ts` (+4 de permisos); 127/127 en los specs tocados.
- e2e: `flota-secretaria.spec.ts` 8/8 (solo lectura; la creación se intercepta).
- SQL: `supabase/tests/rls/0051-b-flota-secretaria.sql` — 66 casos (5 roles × 3 vehículos × mantenimiento/documento/ficha, alta de vehículos, auditoría).
- `tsc` sin errores, `lint:arch` 0 errores (182 advertencias).

## Hallazgos durante la implementación

1. **La secretaria no podía crear vehículos aunque la BD se lo permitía:** el formulario no
   preseleccionaba su sede y el selector le quedaba bloqueado en "Seleccione sede". Ahora usa la
   misma regla del alta de instructores (`resolveInstructorCreateBranch`): la secretaria anclada
   crea en su sede sin selector; el admin parte con la sede del topbar.
2. **En la BD no hay ningún vehículo "Ambas"** (0 de 17): AC4 se probó presentando uno como tal en
   la respuesta (e2e) y marcándolo dentro del bloque que se deshace (SQL).
3. Esta rama integra `hotfix-073/074/075-b` (PRs #262–#264), que tocan los mismos archivos.

## Para cerrar la spec

1. Aprobar y aplicar la migración; correr el test SQL contra producción.
2. Mergear y publicar.
