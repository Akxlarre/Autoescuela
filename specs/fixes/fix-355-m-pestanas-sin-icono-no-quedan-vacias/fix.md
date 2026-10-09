# Fix: las pestañas sin ícono quedan vacías cuando no cabe el texto
> id: fix-355-m-pestanas-sin-icono-no-quedan-vacias
> refs: fix-319-m-testing-clase-profesional-piloto (hallazgo "Comunicación 375 px") · ASG-i-025 · fix-127-m
> status: done
> closed: 2026-10-07
> created: 2026-10-07

## Root Cause
`app-tabs` (`variant="line"`) elige el modo más denso que cabe en su ancho: texto completo →
texto abreviado → solo ícono → desplegable (`pickSubnavTier`, fix-127-m). El modo "solo ícono" se
mide con una fila que contiene únicamente los íconos; si las pestañas **no tienen ícono**, esa
fila mide solo el padding, siempre "cabe", y las pestañas se pintan sin ícono ni texto.

Visto el 2026-10-07 en Comunicación (`/app/secretaria/observaciones`) a 375 px: las dos barras
de pestañas ("Tareas del equipo / Comunicados a alumnos" y las tres de la lista) se ven como
rayas, y solo se lee el contador. Le pasa a cualquier `app-tabs` de línea sin íconos en un
contenedor angosto (móvil o con un panel lateral abierto).

## ACs Afectados
Ninguno — fix autónomo.

## Cambio
- `src/app/core/utils/subnav-tier.utils.ts` — nueva función pura `canUseIconTier(tabs)`: el modo
  "solo ícono" solo es válido si **todas** las pestañas tienen ícono.
- `src/app/shared/components/tabs/tabs.component.ts` — al elegir el modo, descarta "solo ícono"
  cuando `canUseIconTier` es falso: pasa directo al desplegable.

## Test de Regresión
- Unit (`subnav-tier.utils.spec.ts`): `canUseIconTier` es verdadero solo si todas tienen ícono
  (falso con una sin ícono, con la lista vacía).
- Navegador a 375 px en Comunicación: las dos barras muestran un desplegable con el nombre de la
  pestaña activa; a 1440 px siguen como pestañas con texto. Una barra con íconos (Libro de
  Clases usa su propio subnav; revisar otra pantalla con `app-tabs` e íconos) no cambia.

## Progreso
- [x] Test unitario en rojo (3 fallan) y luego en verde (7/7 del archivo).
- [x] Implementación. `tsc` sin errores; `lint:arch` 0 errores.
- [x] Revisión en navegador (admin, `/app/admin/tareas`, la misma pantalla de Comunicación): a
  375 px las dos barras son desplegables ("Tareas del equipo" y "Asignadas por mí"); el segundo
  ofrece las 3 pestañas y al elegir "Dirigidas a mí" queda seleccionada. A 1440 px vuelven a ser
  pestañas con texto. Barra con íconos (Configuración Web, 6 pestañas): texto completo a 1440,
  abreviado a 900 y solo ícono de 700 a 375 px, igual que antes. Consola sin errores.
- Observación fuera de alcance: en Comunicación a 375 px queda un hueco de ~100 px entre la
  barra de canales y la lista (la celda de la barra hereda el alto mínimo de fila del grid).
