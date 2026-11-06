# Hotfix: "Actividad reciente" filtra por el usuario que mira
> id: hotfix-172-b-actividad-reciente-filtra-por-usuario
> refs: —
> status: done
> closed: 2026-11-06
> created: 2026-11-06

## Problema
Para una secretaria, la consulta de actividad reciente a `audit_log` (`order created_at desc limit 6`)
recorre toda la tabla (77.708 filas el 2026-11-06). La política `select_audit_log` es "admin o fila
propia" y ese OR impide usar `idx_audit_log_user (user_id, created_at desc)`. Con pocas filas propias
tarda 1 s con caché y más de 8 s bajo carga, y Postgres la corta (500 por "statement timeout", 2 veces
el 2026-11-06 con la secretaria multisede). Filtrando por `user_id` usa el índice: 2 ms, mismo
resultado (la política ya limita a sus filas).

## Cambios
- **Archivo:** `src/app/core/facades/dashboard.facade.ts` — si el usuario no es admin, filtro `user_id = dbId` en las dos consultas a `audit_log` (panel del dashboard y `fetchActivityHistory`). El admin sigue sin ese filtro.
- **Archivo:** `src/app/core/facades/dashboard.facade.spec.ts` — tests del filtro para secretaria y admin.

## Verificación
- `select_audit_log` es la única política de SELECT de `audit_log`: el filtro devuelve lo mismo.
- `EXPLAIN ANALYZE` como la secretaria multisede (`users.id` 3225), con la consulta que manda la app
  (sede + `user_id`): `Index Scan using idx_audit_log_user`, **2,8 ms**. Sin el filtro: recorría
  77.708 filas, 1.044 ms con caché.
- Navegador: el dashboard de esa secretaria pide `user_id=eq.3225` y responde 200, sin errores.
- `npm run test:ci`: 4660 ok. `npm run lint:arch`: 0 errores.
