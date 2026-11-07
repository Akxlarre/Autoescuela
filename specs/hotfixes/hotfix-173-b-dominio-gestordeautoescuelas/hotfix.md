# Hotfix: la app se muda a app.gestordeautoescuelas.cl
> id: hotfix-173-b-dominio-gestordeautoescuelas
> refs: spec 0046-b · fix-177-b
> status: done
> closed: 2026-11-06
> created: 2026-11-06

## Problema
`app.conductorchillan.cl` dejó de servir la app: el 2026-10-29 a las 22:20 los nameservers de
`conductorchillan.cl` en NIC Chile quedaron solo en Vercel, y el deploy v0.2.4 subió al cPanel sin que
nadie lo viera (404 `DEPLOYMENT_NOT_FOUND` de Vercel). El negocio decidió mudar la app a un dominio
propio: `app.gestordeautoescuelas.cl` (subdominio en el mismo cPanel, DNS en haciendopaginas).

Además, el enlace a la Política de Privacidad que se imprime en los contratos PDF apuntaba a
`https://autoescuelachillan.cl`, que no es la app (valor marcado como pendiente de confirmar).

## Cambios
- **Archivo:** `supabase/functions/_shared/contract-pdf.ts` — `APP_BASE_URL` = `https://app.gestordeautoescuelas.cl`.
- **Archivo:** `docs/DEPLOY.md` — dominio actual, historial del cambio y la causa (nameservers en Vercel).

## Fuera del código (hecho en paneles, no versionable)
- cPanel: subdominio `app.gestordeautoescuelas.cl` (docroot `/app.gestordeautoescuelas.cl`) y cuenta FTP
  `deploy@app.gestordeautoescuelas.cl` enjaulada en esa carpeta.
- GitHub, environment Production: `APP_DOMAIN`, `FTP_USERNAME`, `FTP_PASSWORD`.
- Supabase: Site URL, Redirect URL `/recuperar-contrasena`, secrets `SITE_URL`, `APP_URL`,
  `PUBLIC_ENROLLMENT_ALLOWED_ORIGINS`.
