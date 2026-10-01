# Asignación ASG-i-040 — XSS almacenado en la landing pública (innerHTML con texto editable)

> **status:** reclamada
> **owner:** cualquiera
> **tipo_sugerido:** hotfix
> **priority:** P0
> **created:** 2026-09-30
> **created_by:** i
> **claimed_by:** i
> **claimed_at:** 2026-10-01
> **resulting_track:** hotfix-008-i-xss-landing-publica-innerhtml

---

> **Confirmación (2026-09-30): ✅ CONFIRMADA EN CÓDIGO** (`LandingLayout.astro:638`, concatenación
> sin escapar + `innerHTML`). No se ejecutó en vivo porque requiere guardar un texto en
> Configuración web; quien la tome puede hacerlo con el paso de confirmación de abajo.

## Contexto / Objetivo

El script de hidratación de la landing arma HTML concatenando texto que se edita desde
Configuración web y lo inserta con `innerHTML` sin escapar (ej. `'<span>' + inc + '</span>'`
para "Qué incluye" de cada curso). Quien pueda editar esos textos (una secretaria, o una cuenta
comprometida) puede inyectar un `<script>`/`<img onerror>` que se ejecuta en el navegador de
**cada visitante del sitio público**. **Verificado en el código**
(`webs/src/layouts/LandingLayout.astro:638`); falta probarlo en vivo.

## Alcance sugerido

- Confirmar: en Configuración web, guardar en "Qué incluye" un texto como
  `<img src=x onerror="alert(1)">` y abrir la landing de esa sede.
- Reemplazar los `innerHTML` que reciben datos editables por `textContent` / creación de nodos,
  o escapar el texto. Revisar todas las ocurrencias: `LandingLayout.astro` líneas 269, 293, 392,
  638, 779, 784 (algunas pueden ser seguras si solo usan constantes: verificar una por una).
- Revisar si la app Angular muestra esos mismos textos con `[innerHTML]` en algún lado.

## Referencias

- `specs/testing-piloto/036-auditoria-configuracion-web.md` S14
- `specs/testing-piloto/000-resumen.md` grupo 1

## Archivos involucrados (opcional, para detectar solapes)

- `webs/src/layouts/LandingLayout.astro`

## Notas para quien la reclame

- Revertir el texto de prueba en Configuración web después de confirmar.
