# Fix: nombres accesibles, controles anidados y zonas con scroll sin foco
> id: fix-238-b-a11y-nombres-y-foco
> refs: spec 0054-b
> status: in_progress
> created: 2026-10-28

## Root Cause
Reglas de axe que quedaban en la línea base del barrido tras fix-236-b/fix-237-b, cada una con una
causa puntual:

| Regla | Dónde | Causa |
|---|---|---|
| `aria-prohibited-attr` (22 rutas × rol) | barra superior | `aria-label="Contexto de sede activa"` en un `div` sin rol: el nombre se ignora |
| `link-name` | Flota (lista y tarjeta) | enlace solo-ícono "Mantenimientos" con `pTooltip` pero sin `aria-label` |
| `button-name` | Certificación (lista y 2 drawers de historial) | botón "página siguiente" solo-ícono sin nombre (el "anterior" sí lo tenía) |
| `nested-interactive` | Auditoría | enlace `mailto:` dentro de una fila `role="button"` |
| `scrollable-region-focusable` | Dashboard (pestañas), ficha del alumno (pagos), historial de cuadraturas | contenedores con scroll sin nada enfocable: con teclado no se puede desplazar |

## ACs Afectados
- **T1:** el contenedor de sede de la barra superior es `role="group"` con su nombre.
- **T2:** los enlaces/botones solo-ícono de Flota y Certificación tienen `aria-label`.
- **T3:** las filas de Auditoría no contienen otro control (el correo se muestra como texto; el
  `mailto:` sigue en el detalle).
- **T4:** las 3 zonas con scroll son enfocables (`tabindex="0"`, `role="region"` con nombre).
- **T5:** el barrido queda sin estas reglas; la línea base se regenera.

## Cambio
(se completa al cerrar)

## Test de regresión
- Análisis axe por elemento en las rutas afectadas + barrido con línea base regenerada (en modo
  estricto, una regla nueva serious/critical vuelve a fallar).
