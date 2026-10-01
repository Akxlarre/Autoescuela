# Hotfix: La lista de Alumnos del admin consulta dos veces al abrir y muestra "0 alumnos" un instante
> id: hotfix-117-m-alumnos-admin-carga-doble-y-parpadeo-vacio
> refs: fix-264-m (bug B22), hotfix-055-b, fix-269-m
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Problema
Al abrir `/app/admin/alumnos` con una carga completa de la app (F5 o URL directa), la lista suele hacer **dos** consultas a `students` y muestra por un instante "Mostrando 0 a 0 de 0 alumnos" + "No se encontraron alumnos" antes de los datos reales. Medido el 2026-10-01 con un observador del DOM: 2 de 4 cargas con parpadeo y 3 de 4 con doble consulta.

El `effect()` de `AdminAlumnosComponent` llama a `facade.initialize()` **dentro** del contexto reactivo, así que queda suscrito a todos los signals que `initialize()` lee (usuario actual, vista Papelera), no solo a la sede. Cuando alguno cambia durante el arranque, el effect dispara una segunda carga solapada con la primera; el guard de respuestas fuera de orden descarta el resultado de la primera, pero su `finally` apaga `isLoading` y la tabla se dibuja vacía hasta que termina la segunda. `hotfix-055-b` ya había quitado una consulta duplicada de esta pantalla; esta es otra vía.

Encontrado al corregir `fix-269-m`, que le agregó el mismo `effect()` a la pantalla de secretaria (ahí ya nació con `untracked`).

## Cambios
- **Archivo:** `src/app/features/admin/alumnos/admin-alumnos.component.ts` — el `effect()` sigue solo a `selectedBranchId()` y llama a `initialize()` dentro de `untracked()`.

## Verificación
Medido el 2026-10-01 con el mismo observador del DOM, 4 cargas por rol (admin, secretaria, secretaria multi-sede): 12 de 12 con una sola consulta a `students` y sin estado vacío transitorio. Verificado el 2026-10-01: `npx vitest run` (2848 tests) y `npm run lint:arch` (0 errores) en verde; `npm run test:e2e` con 58/58 esperados en dos corridas seguidas.
