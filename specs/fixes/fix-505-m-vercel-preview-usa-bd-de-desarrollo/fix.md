# Fix: los previews de Vercel usan la BD de desarrollo
> id: fix-505-m-vercel-preview-usa-bd-de-desarrollo
> refs: —
> status: done
> closed: 2026-11-20
> created: 2026-11-20

## Root Cause
Vercel compila el preview de cada PR con `npm run build` (`ng build`, configuración `production`), así
que usa `environment.ts`. Desde hotfix-176-m ese archivo apunta a producción
(`vbbzcfrilnolrhcwjabr`): quien probaba un preview escribía en la BD real. No podía usar la
configuración `development` porque `environment.development.ts` es personal de cada dev y está en
`.gitignore` (Vercel no lo tiene).

## ACs Afectados
Ninguno — fix autónomo.

- **AC-1:** existe una configuración `preview` (como `production`, pero con
  `environment.preview.ts`, que apunta a desarrollo `klcwwrwfdqdciffraozq`).
- **AC-2:** Vercel compila los previews con `--configuration preview`.
- **AC-3:** `environment.development.ts` sigue ignorado y personal; `environment.preview.ts` se versiona.
- **AC-4:** el build `production` (cPanel) no cambia.

## Cambio
- **Archivo:** `src/environments/environment.preview.ts` (nuevo) — URL y publishable key de desarrollo.
- **Archivo:** `angular.json` — configuración `preview` con `fileReplacements`.
- **Archivo:** `vercel.json` — `buildCommand` con `--configuration preview`.
- **Archivo:** `.gitignore` — ignora solo `environment.development.ts` en vez de la carpeta.

## Test de Regresión
- Build `preview` contiene solo el ref de desarrollo; build `production`, solo el de producción ✓
