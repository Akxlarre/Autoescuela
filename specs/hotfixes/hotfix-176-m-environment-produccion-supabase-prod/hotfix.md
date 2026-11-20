# Hotfix: environment.ts de producción apunta al proyecto Supabase PROD
> id: hotfix-176-m-environment-produccion-supabase-prod
> refs: —
> status: done
> closed: 2026-11-20
> created: 2026-11-20

## Problema
Desde fix-503-m hay dos proyectos en la cuenta nueva: desarrollo (`klcwwrwfdqdciffraozq`, con los
datos de prueba) y producción (`vbbzcfrilnolrhcwjabr`, estructura + catálogo, sin personas). El
build de producción (`environment.ts`) seguía apuntando a desarrollo.

## Cambios
- **Archivo:** `src/environments/environment.ts` — URL y publishable key del proyecto de producción.
- **Archivo:** `webs/src/content/site/azul.json` — logo de respaldo de la landing desde el Storage de producción.

`environment.development.ts`, `e2e/support/env-guard*.ts` y `scripts/test-enrollment-flow.ts` siguen
en desarrollo a propósito: los tests nunca deben correr contra producción.
