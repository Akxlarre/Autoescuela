# Hotfix: Botón Desactivar/Reactivar de Descuentos sin estado de carga
> id: hotfix-086-m-boton-desactivar-descuento-sin-loading
> refs: —
> status: done
> closed: 2026-08-21
> created: 2026-08-21

## Problema
En `DescuentosDrawerComponent`, el botón "Desactivar"/"Reactivar" de cada fila no muestra
ningún feedback visual mientras se procesa el `toggleStatus()` — mismo problema que ya se
corrigió en el botón "Guardar" de `PreciosCursosDrawerComponent` (fix-198-m). El usuario no
sabe si el clic se registró hasta que la fila cambia de estado.

## Cambios
- **Archivo:** `src/app/features/admin/configuracion-descuentos/descuentos-drawer.component.ts`
  — agregar un signal `togglingId` que trackea qué descuento está en proceso; mostrar
  ícono `loader-circle` + `animate-spin` y deshabilitar el botón mientras esa fila procesa
  (mismo patrón que `savingCourseId` en `precios-cursos-drawer.component.ts`).
