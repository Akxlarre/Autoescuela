# Hotfix: Tailwind no escanea la carpeta e2e
> id: hotfix-139-m-tailwind-no-escanea-la-carpeta-e2e
> refs: ASG-i-024
> status: done
> closed: 2026-10-04
> created: 2026-10-04

## Problema
Tailwind v4 detecta clases en todo el proyecto, también en `e2e/` y en los `.md`. Un selector de
Playwright formado por un atributo entre corchetes seguido de dos puntos y la palabra visible se
leía como la clase `visible` con una variante arbitraria y generaba una regla CSS inválida (`▲ [WARNING] Unexpected "=" [css-syntax-error]` en
`ng serve`). Los dos selectores que lo causaban ya se reescribieron, pero cualquier texto con forma
de clase en un test puede volver a generar CSS basura.

## Cambios
- **Archivo:** `src/tailwind.css` — `@source not` para `e2e/`, `specs/`, `docs/` e `indices/`: los
  tests y la documentación quedan fuera del escaneo de clases.

El aviso reapareció tras la primera versión (solo `e2e/`): lo generaba este mismo archivo, que
citaba el selector literal. Por eso el selector ya no se escribe acá y se excluye también la
documentación.
