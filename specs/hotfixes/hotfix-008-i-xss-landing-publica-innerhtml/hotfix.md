# Hotfix: XSS almacenado en la landing pública (innerHTML con textos editables)

> id: hotfix-008-i-xss-landing-publica-innerhtml
> refs: ASG-i-040
> status: done
> created: 2026-10-01
> closed: 2026-10-01

## Problema

[Heredado de ASG-i-040, confirmado en código]: el script de hidratación de la landing
(`webs/src/layouts/LandingLayout.astro`) arma HTML concatenando textos que se editan desde
Configuración web y los inserta con `innerHTML` sin escapar. Quien pueda editar esos textos (una
secretaria, o una cuenta comprometida) puede inyectar un `<script>`/`<img onerror>` que se ejecuta
en el navegador de cada visitante del sitio público.

Al revisar cada `innerHTML` del archivo, **6 reciben datos editables** (las demás solo vacían
contenedores o usan `textContent`):

| Línea | Dato editable que se inyecta |
|---|---|
| 269 | Nombre de la marca (copyright) |
| 293 | URL del logo dentro de `<img src="${...}">` (inyección de atributos) |
| 392 | Texto de la insignia de confianza del hero |
| 638 | "Qué incluye" de cada curso |
| 779 | Ícono (emoji) de "Por qué elegirnos" |
| 784 | Ícono (nombre lucide) de "Por qué elegirnos" |

## Cambio

- **`webs/src/layouts/LandingLayout.astro`** — reemplazar esos 6 `innerHTML` con datos por
  creación de nodos y `textContent` / `setAttribute`, de modo que un texto con HTML se muestre
  literal y nunca se interprete. No se agrega función de escape: seguro por construcción.
- Los textos normales se ven igual que antes.

## Fuera de alcance (pendiente aparte)

- Enlaces de redes sociales: `a.href = config.social.*` usa `textContent` para el texto, pero un
  valor `javascript:` en el campo ejecutaría código al hacer clic. Riesgo menor y distinto:
  validar el esquema (`https:`/`http:`) en otra asignación.

## Test de Regresión

- `webs/src/layouts/LandingLayout.innerhtml.test.ts` (3 tests): ninguna asignación a `innerHTML`
  interpola datos de la configuración, y los textos editables se asignan con `textContent` /
  `setAttribute`. Es una guarda estática (el script es inline en el layout y no se puede importar):
  contra el código anterior detecta 5 asignaciones con datos, contra el nuevo 0. Limitación: la
  heurística corta en el primer `;`, por eso el caso del ícono emoji lo cubren las aserciones de
  `textContent`.
- Verificación con Playwright sobre la landing en local (`astro dev`), **interceptando la
  respuesta de la configuración** para devolver textos maliciosos (no se escribe nada en la BD
  compartida).

## Evidencia de Verificación

- **Antes del arreglo (en vivo):** con la configuración interceptada, **se ejecutó el código
  inyectado en 5 de los 6 puntos**: nombre de marca (copyright), insignia de confianza, "qué
  incluye" del curso, ícono emoji e ícono lucide (`window.__xss` = `brand`, `includes`,
  `trustBadge`, `icon-emoji`, `icon-lucide`). El del logo (línea 293) no se alcanzó porque la
  marca de prueba ya trae `.brand-logo-img` en la página; la rama vulnerable solo corre cuando el
  contenedor no tiene logo previo.
- **Después del arreglo (en vivo):** con los 6 textos maliciosos (retirando el logo previo para
  alcanzar la rama del logo) `window.__xss` queda **vacío**; los textos se muestran literales
  (`<img src=x onerror=...>` visible como texto), la URL del logo queda como valor del atributo
  `src` (solo genera un 404) y el `data-lucide` queda escapado. Un texto normal ("Clases
  prácticas incluidas") se ve igual.
- **Carga normal sin interceptar:** marca, copyright, cursos con sus íconos de check, logos e
  íconos de "Por qué elegirnos" correctos; 0 errores de JS.
- `webs`: 9/9 tests (con configuración temporal, ver nota). No se tocó `src/`: la suite de la app
  no cambia.
- **Nota (anterior a este hotfix):** `npm test` dentro de `webs/` hereda el `vitest.config.ts` de la
  raíz (patrón `src/**/*.spec.ts`), por lo que **ninguno de los tests de `webs/` corre con ese
  comando** (tampoco `getSiteData.test.ts`). Queda para otra asignación.
