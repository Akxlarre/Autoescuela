# Fix: Textos pintados con el color de fondo por la clase text-base
> id: fix-303-m-textos-pintados-con-el-color-de-fondo-por-text-base
> refs: ASG-i-024
> status: done
> closed: 2026-10-04
> created: 2026-10-04

## Root Cause
En este proyecto `text-base` no fija el tamaño de letra: como el `@theme` define `--color-base` (el
fondo de la página), Tailwind la genera como utilidad de **color** (`color: var(--color-base)`), y
lo mismo con `sm:text-base` y `md:text-base`. Un texto con esa clase y sin otro color que la
corrija se pinta casi blanco en modo claro y casi negro en modo oscuro. Es el mismo problema de
`hotfix-122-m` (título del modal de archivar), que dejó anotados otros 24 usos sin revisar.

Revisión del 2026-10-04, midiendo el color calculado en el navegador: hay 27 usos en 18 archivos.

- **22 se leen bien.** 11 llevan además `text-text-primary`, `text-text-secondary` o
  `text-text-muted`, que se declaran después y ganan. 8 llevan el color en un estilo en línea. En
  los 2 campos de texto del instructor (`form-control`) gana la regla del campo, y en
  `evaluation-checklist` un color con `!important`. En esos 22 la clase no hace nada.
- **5 quedan con el color del fondo** (los de este fix):
  - Título "Elegir destinatarios" y título "Incorporar alumno de otro ciclo" (ciclos teóricos):
    casi blanco sobre la tarjeta blanca.
  - Título "Eliminar definitivamente" (eliminar servicio): igual.
  - Subtítulo de la cabecera grande (`app-section-hero`, densidad full) desde 768 px de ancho.
  - Texto del botón "Finalizar" del detalle de clase del instructor: casi blanco en modo claro (no
    se nota), casi negro sobre el botón de marca en modo oscuro.

## ACs Afectados
- Los 5 textos se leen en modo claro y oscuro, con el color que les corresponde por su contenedor.

## Cambio
Mismo criterio que `hotfix-122-m`: se quita la clase y el tamaño no cambia (ya era el heredado).
- `src/app/shared/components/ciclos-teoricos-content/ciclos-teoricos-content.component.ts` — los
  dos títulos pasan de `text-base` a `text-text-primary`.
- `src/app/shared/components/eliminar-servicio-modal/eliminar-servicio-modal.component.ts` — ídem.
- `src/app/shared/components/section-hero/section-hero.component.ts` — el subtítulo pierde
  `md:text-base` y hereda el color de la cabecera, como el título.
- `src/app/features/instructor/clase-detail/instructor-clase-detail.component.ts` — el botón pierde
  `text-base` y usa el color de `btn-primary`.

No se tocan los 22 usos que se leen bien, ni el `@theme`.

## Test de Regresión
- Color calculado en el navegador, antes del cambio (modo claro / oscuro): `text-base` sola y con
  variantes `sm:`/`md:` da `rgb(244, 244, 245)` / `rgb(9, 9, 11)`, el color del fondo de la página.
  Con `text-text-primary` da `rgb(9, 9, 11)` / `rgb(244, 244, 245)`. El botón `btn-primary` sin
  `text-base` vuelve a `rgb(255, 255, 255)`.
- `npm run test:ci`: 3.129 pasan, 5 omitidos ✓ · `npm run lint:arch`: 0 errores ✓

## Límites conocidos
- No se abrieron en pantalla los dos modales ni una cabecera grande con subtítulo (las páginas
  revisadas usan la cabecera compacta): la comprobación es sobre las mismas clases, medidas en la
  app en ejecución.
- Sigue sin existir un guardrail que avise al escribir `text-base`. Los 22 usos restantes no hacen
  nada; se pueden limpiar cuando se agregue esa regla.
