# Fix: nombres accesibles, controles anidados y zonas con scroll sin foco
> id: fix-238-b-a11y-nombres-y-foco
> refs: spec 0054-b
> status: done
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
| `scrollable-region-focusable` | Dashboard de secretaria (actividad y alertas) | mismas listas con scroll sin foco |
| `button-name` | Configuración web (secretaria) | botón "quitar archivo" solo-ícono de `app-media-upload-control` |
| `aria-required-children` (intermitente) | Matrícula, Cuadratura (admin) | `app-branch-gate` declara `role="listbox"` aunque no tenga opciones (sin sedes o cargando) |
| `color-contrast` | Auditoría (claro) | `--state-warning` (#b45309) daba 4,08:1 sobre los fondos tintados de advertencia |

## ACs Afectados
- **T1:** el contenedor de sede de la barra superior es `role="group"` con su nombre.
- **T2:** los enlaces/botones solo-ícono de Flota y Certificación tienen `aria-label`.
- **T3:** las filas de Auditoría no contienen otro control (el correo se muestra como texto; el
  `mailto:` sigue en el detalle).
- **T4:** las 3 zonas con scroll son enfocables (`tabindex="0"`, `role="region"` con nombre).
- **T5:** el barrido queda sin estas reglas; la línea base se regenera.

## Cambio
- `topbar.component.ts`: el contenedor de sede pasa a `role="group"` (el `aria-label` ya existía).
- `flota-list-content` y `vehiculo-card`: `aria-label="Mantenimientos"` en el enlace solo-ícono.
- `certificacion-clase-b-content`, `historial-emisiones-drawer`, `historial-emisiones-prof-drawer`:
  `aria-label="Página siguiente"`.
- `media-upload-control`: `ariaLabel="Quitar archivo"` en el `p-button`.
- `admin-auditoria`: el correo de la fila se muestra como texto; el `mailto:` queda en el detalle.
- Zonas con scroll enfocables (`tabindex="0"` + nombre; `role="region"` donde no hay otro rol):
  pestañas del dashboard, historial de pagos de la ficha, calendario de cuadraturas, listas de
  actividad y alertas del dashboard de secretaria.
- `branch-gate`: `role="listbox"` y su nombre solo cuando hay sedes que mostrar.
- `_variables.scss`: `--state-warning` pasa a `#92400e` (amber-800).

## Verificación
- Barrido completo (`e2e/barrido-rutas.spec.ts`, 53 rutas × rol, con `E2E_A11Y_WRITE_BASELINE=1`):
  53 ✅ y **todas las líneas base de `e2e/a11y-baseline/` quedan vacías**.
- `ng build` ✅ · `lint:arch` ✅ (0 errores) · `npm run test:ci` ✅ (4631 tests).

## Test de regresión
- Análisis axe por elemento en las rutas afectadas + barrido con línea base regenerada (en modo
  estricto, una regla nueva serious/critical vuelve a fallar).
