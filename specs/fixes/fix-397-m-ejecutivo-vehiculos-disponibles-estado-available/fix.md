# Fix: el ejecutivo no cuenta como disponibles los vehículos creados desde Flota
> id: fix-397-m-ejecutivo-vehiculos-disponibles-estado-available
> refs: fix-395-m-testing-dashboards (caso I02) · spec 0044-b (AC19) · DG-003
> status: done
> closed: 2026-10-13
> created: 2026-10-13

## Síntoma

Dashboard ejecutivo → tab "Operación de hoy": "Vehículos disponibles" muestra menos vehículos que
Flota. Sede 1 en dev: ejecutivo 4, Flota 9 (y el dashboard de secretaria, 9).

## Root Cause

`exec_dashboard_today_ops()` cuenta como disponibles solo `status IN ('operational', 'in_use')`,
siguiendo DG-003 ("`'available'` nunca existe en producción"). Pero el formulario de vehículo de
Flota guarda `'available'` (`vehicle-form-drawer.component.ts`, opciones `available` /
`maintenance` / `out_of_service`): todo vehículo creado o editado desde la app queda fuera del
conteo. En dev, 11 de 17 vehículos tienen `'available'`; `operational` solo lo tienen los del seed
inicial. El resto de la app (Flota, dashboard de secretaria) usa `resolveVehicleStatus()`, que
trata `available`, `operational` e `in_use` como disponible.

## Fix

Migración `20261013161000_fix397_exec_today_ops_vehiculos_available.sql` (**la aplica Matías**):
disponible = todo vehículo que no está en mantención, fuera de servicio ni bloqueado, la misma
regla de `resolveVehicleStatus()`. DG-003 se corrige: `'available'` sí existe, es lo que escribe
la app.

## Acceptance Criteria

- [x] AC1 — "Vehículos disponibles" cuenta los vehículos `available`, `operational` e `in_use` de
      la sede (más los de "ambas sedes"); sede 1 de dev: 9.
- [x] AC2 — Un vehículo en `maintenance` cuenta en "En mantención" y no en disponibles; uno
      `out_of_service` o `blocked` no cuenta en ninguno.
- [x] AC3 — El resto de la respuesta (clases, instructores) no cambia, y la función conserva
      firma, `search_path`, permisos y el rechazo `42501`.

## Regression Test

- Ensayo de la migración en una transacción con `ROLLBACK` contra la BD de dev (AC1–AC3).

## Verificación (2026-10-13)

Migración ensayada contra la BD de dev en una transacción deshecha (no quedó aplicada):

| Caso | Antes | Después |
|---|---|---|
| AC1 — disponibles sede 1 / sede 2 / todas | 4 / 2 / 6 | 9 / 8 / 17 (los 17 vehículos de dev) |
| AC2 — sede 1 con uno en mantención, uno fuera de servicio, uno bloqueado y uno de la sede 2 marcado "ambas sedes" | — | 7 disponibles, 1 en mantención |
| AC3 — clases e instructores | iguales | iguales; secretaria `42501`; `search_path` intacto |

DG-003 de `indices/DOMAIN-GOTCHAS.md` corregida. Migración aplicada por Matías el 2026-10-14 y verificada en la BD de dev.
