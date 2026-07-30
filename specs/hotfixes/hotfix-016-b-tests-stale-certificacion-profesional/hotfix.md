# Hotfix: Tests stale de placeholder en certificacion-profesional.facade.spec
> id: hotfix-016-b-tests-stale-certificacion-profesional
> status: done
> created: 2026-06-24
> closed: 2026-06-24

## Problema

El bloque `acciones de placeholder` en `certificacion-profesional.facade.spec.ts` aserta que
`enviarEmail`, `generarPendientes` y `exportar` llaman `toast.info` (comportamiento de
placeholder). Esos métodos ya son implementaciones reales y NO llaman `toast.info` (el único
`toast.info` vive en `enviarEmailsMasivo`). Las 3 aserciones estaban enmascaradas por un crash
de construcción del AuthFacade real; al mockear AuthFacade (fix-027) quedaron visibles y rojas.

## Cambios

- **Archivo:** `src/app/core/facades/certificacion-profesional.facade.spec.ts` — actualizar el
  bloque "acciones de placeholder" para reflejar el comportamiento real de los 3 métodos (o
  eliminar las aserciones obsoletas de `toast.info`). Solo el spec; la facade no se toca.
