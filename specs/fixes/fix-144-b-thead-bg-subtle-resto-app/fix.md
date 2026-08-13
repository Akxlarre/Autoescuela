# Fix: Extender remoción de `bg-subtle` en encabezados de tabla a toda la app
> id: fix-144-b-thead-bg-subtle-resto-app
> refs: fix-143-b-thead-bg-subtle-portal-instructor
> status: done
> closed: 2026-08-12
> created: 2026-08-12

## Root Cause
<!-- Qué estaba mal y por qué pasó. Una sola causa raíz. -->
Continuación de fix-143-b (portal instructor). El owner confirmó explícitamente que quiere
la franja gris (`bg-subtle`) de los encabezados de tabla fuera de **toda la app**, no solo
del portal instructor — incluyendo el componente canon compartido `alumnos-list-content`
(Base Alumnos) y sus derivados en admin/secretaria.

Relevado por grep completo del patrón `micro-label ... bg-subtle` (y su variante por-celda
`<th class="micro-label ... bg-subtle">` en `vehicle-maintenances`): 8 archivos con 14
ocurrencias restantes fuera del portal instructor (ya cubierto en fix-143-b).

## ACs Afectados
<!-- Lista los ACs de la spec original que este fix corrige. -->
Ninguno — fix autónomo (preferencia visual explícita del owner, no cambia contrato de
negocio).

## Cambio
<!-- Archivo tocado y descripción en una línea. Un fix = un cambio puntual. -->
Quitar `bg-subtle` de la fila/celdas de encabezado (`micro-label`) en:
- `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts` (Base
  Alumnos — canon, consumido por `/admin/alumnos` y `/secretaria/alumnos`)
- `src/app/shared/components/alumnos-profesional-list-content/alumnos-profesional-list-content.component.ts`
  (`/admin/clase-profesional/alumnos`, `/secretaria/profesional/alumnos`)
- `src/app/shared/components/flota-list-content/flota-list-content.component.ts`
  (`/admin/flota`)
- `src/app/shared/components/ex-alumnos-profesional-content/ex-alumnos-profesional-content.component.ts`
  (`/admin/ex-alumnos-profesional`, `/secretaria/ex-alumnos-profesional`)
- `src/app/features/admin/alumnos/ex-alumnos/admin-ex-alumnos.component.ts` (`/admin/ex-alumnos`)
- `src/app/features/secretaria/ex-alumnos/secretaria-ex-alumnos.component.ts` (`/secretaria/ex-alumnos`)
- `src/app/features/admin/profesional-relatores/admin-profesional-relatores.component.ts`
  (`/admin/clase-profesional/relatores`, wrappeado por secretaria)
- `src/app/features/instructor/ficha/instructor-ficha.component.ts`
  (`/instructor/alumnos/:id/ficha`)
- `src/app/features/admin/flota/vehicle-maintenances/vehicle-maintenances.component.ts`
  (`/admin/flota/:id/mantenimientos` — variante por-celda `<th>`, no `<tr>`)

## Test de Regresión
<!-- El test que prueba que el fix funciona. Debe quedar verde post-fix. -->
- Verificación visual en navegador: `/admin/alumnos` (canon) y `/admin/flota` sin franja
  gris en el encabezado de tabla.
- `npm run test:ci` completo sin regresiones (cambio puramente de clases CSS, sin lógica).
- Sin lógica nueva → sin `.spec.ts` obligatorio.
