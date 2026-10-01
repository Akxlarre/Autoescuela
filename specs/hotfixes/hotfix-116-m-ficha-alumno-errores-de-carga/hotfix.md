# Hotfix: La ficha del alumno maneja mal sus errores de carga (id inválido, mensaje y error pegado)
> id: hotfix-116-m-ficha-alumno-errores-de-carga
> refs: fix-264-m (bugs B11, B12 y B13)
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Problema
Tres fallas del mismo camino de error de `AdminAlumnoDetalleFacade` / `AdminAlumnoDetalleComponent`:

1. **Id no numérico en la URL** (`/alumnos/abc`): el componente no llama al facade y la ficha queda en "Cargando…" para siempre (B13).
2. **El error queda pegado** (B12): una carga fallida no invalida la caché del alumno anterior. Al volver a abrir a ese alumno el facade lo trata como "el mismo", refresca en segundo plano y nunca limpia el error.
3. **El mensaje no dice qué pasó** (B11): cuando el alumno no existe o es de otra sede (PostgREST `PGRST116`, 0 filas), el detalle repite el título: "Error al cargar la ficha del alumno".

## Cambios
- **Archivo:** `src/app/core/facades/admin-alumno-detalle.facade.ts` — `initialize()` rechaza ids que no sean enteros positivos con un error visible; una carga fallida invalida la caché; `PGRST116` se traduce a "El alumno no existe o no tienes acceso a su ficha."
- **Archivo:** `src/app/core/facades/admin-alumno-detalle.facade.spec.ts` — tests de los tres casos.
- **Archivo:** `src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts` — `ngOnInit` siempre llama a `initialize()` (antes lo omitía si el id no era numérico).
- **Archivo:** `e2e/alumnos-b-ficha.spec.ts` — los tests A04, A05 y A06 dejan de estar marcados `knownBug`.

## Verificación
Verificado el 2026-10-01: el test E2E del caso pasa en navegador sin la marca `knownBug`, `npx vitest run` (2835 tests) y `npm run lint:arch` (0 errores) en verde.
