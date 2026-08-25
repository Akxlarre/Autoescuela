# Fix: Ortografía general (tildes/errores) en texto visible de la app

> id: fix-216-m-ortografia-general-app
> refs: ASG-i-001
> status: done
> closed: 2026-08-25
> created: 2026-08-25

## Root Cause

[Heredado de ASG-i-001]: Parte del alcance original de la asignación ("revisar toda la ortografía
del proyecto") quedó fuera de `fix-215-m-ortografia-voseo-app` (que cerró solo la parte de voseo)
porque mezclar ambos hubiera violado "un fix = una causa raíz". Se abre este fix separado, acotado
a: texto visible al usuario (templates inline, `placeholder`, `aria-label` legible, mensajes de
confirmación/toast, labels de formulario) con errores de tildes u ortografía — **excluyendo**
identificadores de código (nombres de propiedades/variables, `data-llm-*`, ids de DOM, claves de
i18n) que no son texto que el usuario lea.

## ACs Afectados

Ninguno — fix autónomo (originado de Asignación de equipo, no de una spec).

## Cambio

Barrido con grep dirigido (texto entre `>...<` y dentro de literales `'...'`/`"..."`/`` `...` ``,
excluyendo identificadores de código, rutas, imports y `data-llm-*`) sobre ~90 palabras comunes
sin tilde (sesión/gestión/revisión/dirección/información/región/función/razón, etc.) en todo
`src/app`. Único hallazgo real:

- `src/app/shared/components/pre-inscritos-content/pre-inscritos-content.component.ts:409` —
  valor por defecto del `input() subtitle`: "Gestion de pre-inscripciones online pendientes de
  revision" → "Gestión de pre-inscripciones online pendientes de revisión". Es un texto que se
  renderiza tal cual si el Smart consumidor no sobreescribe `[subtitle]`.

El resto de coincidencias fueron falsos positivos (nombres de propiedad `telefono`/`sesion`/
`vehiculo` en DTOs y forms reactivos, ids de campo `for="e-telefono"`, valores de test fixtures,
`role="region"` de ARIA, rutas `configuracion-web`) — no son texto que el usuario lea, se dejan
como están.

**Limitación reconocida:** este barrido cubre patrones de palabras comunes sin tilde con grep, no
un corrector ortográfico exhaustivo — no garantiza cero errores en toda la app, pero cubre la
categoría de error más frecuente (tildes faltantes) con razonable señal/ruido.

## Test de Regresión

Copy puro sin lógica de decisión — no aplica test automatizado según `.claude/rules/testing-tdd.md`.
Verificación empírica: `npx tsc -p tsconfig.app.json --noEmit` limpio en el archivo tocado.
