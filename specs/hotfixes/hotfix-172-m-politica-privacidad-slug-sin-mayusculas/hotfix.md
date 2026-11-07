# Hotfix: La política de privacidad no se encuentra si el enlace trae mayúsculas
> id: hotfix-172-m-politica-privacidad-slug-sin-mayusculas
> refs: fix-485-m-testing-auditoria-configuracion-web
> status: done
> closed: 2026-11-07
> created: 2026-11-07

## Problema
V04 de `fix-485-m`. `/politica-privacidad/Autoescuela-Chillan` muestra "No encontramos esa
política de privacidad": `getPrivacyPolicy()` busca el slug tal cual. Un enlace copiado a mano o
escrito en un documento con mayúsculas (o con espacios al final) deja al alumno sin la política.

## Cambios
- **Archivo:** `src/app/core/models/ui/privacy-policy.model.ts` (+ spec) — `getPrivacyPolicy()`
  normaliza el slug (minúsculas, sin espacios en los bordes) antes de buscarlo.

## Verificación
- Test de `getPrivacyPolicy()` y de la página: 18/18.
- Navegador (2026-11-07): `/politica-privacidad/Autoescuela-Chillan` muestra la política de Autoescuela Chillán (RUT 76.007.217-6).
