# Hotfix: El KPI "Activos" de la Base de Alumnos deja fuera a quienes están cursando con un pendiente
> id: hotfix-118-m-kpi-activos-incluye-pendientes
> refs: fix-264-m (caso D03 de `024a`), ASG-i-024
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Problema
El KPI "Activos" cuenta solo las filas con estado "Activo". Un alumno con matrícula vigente que no ha pagado nada ("Pendiente Pago") o al que le falta un documento ("Docs Pendientes") está teniendo clases, pero no se cuenta.

**Decisión del owner (Matías, 2026-10-01):** "Activos" incluye "Pendiente Pago" y "Docs Pendientes": si están teniendo clases, están activos. Quedan fuera Retirado, Pre-inscrito, Inactivo y Finalizado.

## Cambios
- **Archivo:** `src/app/core/utils/alumno-status.utils.ts` — función pura `isAlumnoCursando(status)`: `true` para Activo, Pendiente Pago y Docs Pendientes.
- **Archivo:** `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts` — `activos()` usa `isAlumnoCursando`.
- **Archivo:** `src/app/core/facades/admin-alumnos.facade.ts` — el `computed` `activos` usa `isAlumnoCursando`.

El filtro "Estado" de la tabla no cambia: "Activo" sigue filtrando solo ese estado.

## Verificación
Verificado el 2026-10-01: `src/app/core/utils/alumno-status.utils.spec.ts > isAlumnoCursando` (7 casos) y `admin-alumnos.facade.spec.ts` en verde. En navegador se comprueba junto con el resto de la tanda de la lista.
