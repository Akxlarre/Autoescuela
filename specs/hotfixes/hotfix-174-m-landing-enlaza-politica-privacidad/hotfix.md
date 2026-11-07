# Hotfix: La landing no enlaza a la política de privacidad de su sede
> id: hotfix-174-m-landing-enlaza-politica-privacidad
> refs: fix-485-m-testing-auditoria-configuracion-web
> status: done
> closed: 2026-11-07
> created: 2026-11-07

## Problema
V09 de `fix-485-m`. La política de privacidad de cada sede existe en la app
(`/politica-privacidad/:slug`), pero la landing pública no la enlaza en ninguna parte: un
visitante que deja sus datos (WhatsApp, preinscripción) no tiene cómo leerla.

## Cambios
- **Archivo:** `webs/src/lib/app-links.ts` — dominio de la app (`docs/DEPLOY.md`:
  `app.gestordeautoescuelas.cl`) y slug de la política por sede (1 → `autoescuela-chillan`,
  2 → `conductores-chillan`, los de `branches.slug`).
- **Archivo:** `webs/src/components/Footer.astro` — enlace "Política de privacidad" en el pie.

## Verificación
- Navegador (2026-11-07, landing de la sede 1 compilada con `astro build`): el pie muestra "Política de privacidad", visible, con `https://app.gestordeautoescuelas.cl/politica-privacidad/autoescuela-chillan`.
