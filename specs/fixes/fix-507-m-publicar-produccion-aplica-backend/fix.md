# Fix: "Publicar producción" aplica migraciones y functions antes de subir el front
> id: fix-507-m-publicar-produccion-aplica-backend
> refs: —
> status: done
> closed: 2026-11-20
> created: 2026-11-20

## Root Cause
Desde que hay dos proyectos (DEV `klcwwrwfdqdciffraozq`, PROD `vbbzcfrilnolrhcwjabr`), publicar
eran tres pasos manuales en orden (migraciones, functions, front) y solo el tercero estaba en el
workflow. Olvidar uno dejaba producción con un front que espera una columna o una function que no
existe. Con el historial de migraciones alineado (fix-506-m), `db push` ya sabe qué falta.

## ACs Afectados
Ninguno — fix autónomo.

- **AC-1:** al publicar (modo `publish`), el job de deploy aplica en PROD las migraciones pendientes
  (`supabase db push`) y despliega todas las functions, **antes** de subir el front.
- **AC-2:** si las migraciones o las functions fallan, el front no se sube.
- **AC-3:** un rollback (modo `rollback`) no toca la BD ni las functions.
- **AC-4:** una sola aprobación (la del environment Production) cubre todo.
- **AC-5:** si faltan los secretos de Supabase, falla antes de tocar nada, diciendo cuál falta.

## Cambio
- **Archivo:** `.github/workflows/deploy-app-production.yml` — pasos de Supabase en el job `deploy`.
- **Archivo:** `docs/DEPLOY.md` — secretos nuevos del environment Production y el flujo.

## Test de Regresión
- YAML válido (js-yaml) y los 3 pasos de Supabase con `if: mode == publish`, antes del FTP ✓
- `db push --remote=<url> --include-all --dry-run` con la CLI 3.2.0 (contra BD local) ✓
- La primera publicación real lo ejecuta contra PROD: el resumen del run muestra el `--dry-run`.
