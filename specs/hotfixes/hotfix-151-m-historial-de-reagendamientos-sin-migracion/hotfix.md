# Hotfix: la tabla del historial de reagendamientos no está en las migraciones
> id: hotfix-151-m-historial-de-reagendamientos-sin-migracion
> refs: fix-366-m-testing-asistencia-clase-b (bloque 3) · fix-008-i · fix-383-m
> status: done
> closed: 2026-10-12
> created: 2026-10-12

## Problema
`class_b_reschedule_history` (historial de reagendamientos, fix-008-i) existe en la BD de dev con
RLS para admin y secretaria, pero ninguna migración la crea. Una BD levantada desde
`supabase/migrations` no la tendría, y "Reagendar Clases" (y la RPC de `fix-383-m`) fallaría.

## Cambio
Migración `20261012125000_hotfix151_class_b_reschedule_history.sql`, idempotente, que versiona la
tabla tal como está en la BD (columnas, FKs, índice por matrícula, RLS y las 4 políticas). Sobre la BD
de dev no cambia nada.

## Verificación
Ensayo en la BD de dev sin aplicar (`BEGIN; <migración>; ROLLBACK;`): corre sin errores sobre la
tabla existente. Aplicada por Matías el 2026-10-12; el reagendamiento de `fix-383-m` escribe en la tabla sin problemas.
