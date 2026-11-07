# Fix: Configuración web acepta cualquier texto en URLs y formatos, y la landing ejecuta `javascript:`
> id: fix-500-m-configuracion-web-urls-y-formatos
> refs: fix-485-m-testing-auditoria-configuracion-web
> status: done
> closed: 2026-11-07
> created: 2026-11-07

## Root Cause

R08 y J03/J04/K10/N03/N04 de `fix-485-m`.

- **Seguridad (R08, ❌ reproducido):** con `contact.mapEmbedUrl = javascript:alert('QA-mapa')`
  la landing pública ejecutó el `alert` al cargar: la hidratación pone la URL tal cual en el `src`
  del iframe del mapa. Lo mismo para los enlaces de redes (`href` tal cual): un `javascript:` en
  Facebook se ejecuta al hacer clic. Quien edita la web (secretaria) puede correr código en la
  página que ven los visitantes.
- **Formatos:** Configuración web solo exige que dominio, redes, WhatsApp, coordenadas y mapa no
  estén vacíos. Acepta `http://` o espacios en el dominio (rompe el `canonical` y el `og:url`,
  que anteponen `https://`), redes que no son URL, un WhatsApp con letras (el botón abre
  `api.whatsapp.com/send?phone=<texto>`), latitud 200 y cualquier URL en el mapa.

## ACs Afectados

- `0003-b` (contenido editable de la landing); S14 de `fix-485-m` (escapado en la landing).

## Cambio

- `core/utils/website-config.utils.ts` (+ spec): validadores `domainValidator`,
  `httpUrlValidator`, `whatsappValidator`, `googleMapsEmbedValidator`.
- `features/admin/configuracion-web/admin-configuracion-web.component.ts`: los aplica (dominio,
  redes, WhatsApp de contacto y del hero, mapa) y rangos de latitud/longitud.
- `tabs/general-tab`, `tabs/contacto-tab`, `tabs/hero-tab`: mensaje bajo cada campo inválido.
- Landing (`webs/`): `safeHttpUrl()` — solo `http(s)://`; el mapa y las redes (hidratación,
  `Footer.astro`, `Location.astro`, `SchemaOrg.astro`) ignoran cualquier otra URL.

## Test de Regresión

- `core/utils/website-config.utils.spec.ts > fix-500-m` ✓ (35/35 junto a website-config y Configuración web). `ng build` OK.
- Navegador (2026-11-07): con `javascript:` en el mapa y en Facebook, el sitio compilado (HTML + hidratación) no ejecuta nada: el iframe del mapa queda sin URL y Facebook no se muestra. Config restaurada.
- Navegador, panel: dominio con `https://`, Facebook `javascript:`, WhatsApp `9123abc`, mapa `javascript:` y latitud 200 muestran su mensaje y "Publicar Cambios" queda deshabilitado (captura `c485-23-errores-contacto.png`).
