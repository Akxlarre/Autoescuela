# Hotfix: Doble clic en archivar hace una sola consulta
> id: hotfix-144-m-doble-clic-en-archivar-hace-una-sola-consulta
> refs: ASG-i-024, fix-277-m
> status: done
> closed: 2026-10-05
> created: 2026-10-05

## Problema
Antes de abrir el modal de archivar, la lista consulta si el alumno tiene clases futuras e historial (`prepararArchivado()`, de `fix-277-m`). Con doble clic en el tacho, la consulta se lanza dos veces: el modal se abre una sola vez, pero si el alumno tiene clases futuras el aviso "No se puede archivar" sale duplicado. Anotado en `024a` L13 de `fix-264-m`.

## Cambios
- **Archivo:** el facade de la lista de alumnos (`admin-alumnos.facade`) — mientras la consulta previa de un alumno está en curso, un segundo pedido para el mismo alumno reutiliza esa misma consulta en vez de lanzar otra.

## Verificación
- Test unitario nuevo en el spec del facade, dentro de "prepararArchivado — fix-277-m" ✓: dos pedidos seguidos hacen una sola consulta de matrículas y un solo aviso; un pedido posterior vuelve a consultar. 52 tests del facade en verde (2026-10-05).
