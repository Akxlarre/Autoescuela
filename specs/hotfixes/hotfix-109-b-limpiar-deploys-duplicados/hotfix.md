# Hotfix: deploys duplicados (Vercel Production y workflow Astro sin uso)
> id: hotfix-109-b-limpiar-deploys-duplicados
> status: in_progress
> created: 2026-10-28

## Problema
El repo tiene 5 environments de deploy y solo uno es producción real (`Production`, cPanel vía
`publicar-produccion.yml`). Los otros cuatro los crea Vercel: el proyecto `autoescuela` (la app)
despliega Production en cada merge a `main` aunque `docs/DEPLOY.md` dice que Vercel queda solo para
previews, y el proyecto `autoescuela-dbd2` (root `webs/`, sitios Astro) despliega Preview y
Production de unas webs que no se van a usar. Además `deploy-cpanel.yml` (deploy Astro a cPanel)
está deshabilitado desde 2026-09 y fallaba.

Decisión del owner (2026-10-28): las webs Astro no se despliegan; Vercel solo para previews de la app.
Revierte lo que fijó la spec 0046-b ("`deploy-cpanel.yml` queda desactivado, no borrado"). El código
de `webs/` no se toca y el workflow se recupera de git si se retoma.

## Cambios
- **Archivo:** `.github/workflows/deploy-cpanel.yml` — eliminado.
- **Archivo:** `vercel.json` (nuevo) — `git.deploymentEnabled.main: false`: el proyecto Vercel
  `autoescuela` deja de desplegar `main` (Production); las previews de PR siguen.
- **Archivo:** `docs/DEPLOY.md` — nota de qué environments quedan y por qué.

## Fuera del repo (owner)
- Vercel: eliminar el proyecto `autoescuela-dbd2`.
- GitHub: borrar los environments `Production – autoescuela`, `Production – autoescuela-dbd2` y
  `Preview – autoescuela-dbd2` cuando Vercel deje de recrearlos.
