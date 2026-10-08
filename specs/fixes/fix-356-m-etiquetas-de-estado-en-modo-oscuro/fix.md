# Fix: las etiquetas de estado (p-tag) conservan fondo claro en modo oscuro
> id: fix-356-m-etiquetas-de-estado-en-modo-oscuro
> refs: fix-319-m-testing-clase-profesional-piloto (U06) · ASG-i-025
> status: done
> closed: 2026-10-07
> created: 2026-10-07

## Root Cause
PrimeNG está configurado con `darkModeSelector: '.fake-dark-mode'` (el modo oscuro lo maneja
`ThemeService` con `[data-mode='dark']`), así que sus componentes nunca cambian solos a la
paleta oscura. `_primeng-overrides.scss` corrige a mano tablas, toasts y otros, pero no tiene
ninguna regla para `p-tag`: en modo oscuro las etiquetas "Activo", "Convalida A3", "Pendiente"…
siguen con el fondo pastel claro del tema claro, sobre una superficie oscura. Se leen, pero
desentonan con `app-badge`, que sí usa los tokens `--state-*` de cada modo.

Visto el 2026-10-07 en la Base de Alumnos Profesional (bloque 5 de `fix-319-m`); le pasa a todo
`p-tag` de la app (unos 57 usos).

## ACs Afectados
Ninguno — fix autónomo.

## Cambio
- `src/styles/vendors/_primeng-overrides.scss` — en `[data-mode='dark']`, las variables de color de
  `p-tag` por severidad (`success`, `info`, `warn`, `danger`, `secondary`) pasan a los tokens de
  estado del modo oscuro (`--state-*`, `--state-*-bg`, `--state-*-border`). El modo claro no cambia.

## Test de Regresión
Navegador, Base de Alumnos Profesional y Base B en modo oscuro: el fondo calculado de las
etiquetas es translúcido oscuro (no un pastel claro) y el texto mantiene contraste; en modo claro
los colores calculados son los mismos que antes del cambio.

## Progreso
- [x] Colores medidos antes del cambio: en oscuro eran idénticos a los del modo claro
  (p. ej. "Activo" `rgb(220, 252, 231)` / `rgb(21, 128, 61)` en ambos).
- [x] Implementación: variables `--p-tag-<severidad>-background|color` en `[data-mode='dark']`.
  No se agregó borde (las etiquetas de PrimeNG no lo llevan en claro).
- [x] Revisión en navegador (admin, Base Profesional y Base B, 1440 px). Oscuro: "Activo"
  `rgba(74, 222, 128, 0.1)` / `rgb(74, 222, 128)`, "Convalida A3" celeste, "Pendiente Pago"
  ámbar, y la variante con borde ("Pendiente · 0/2") toma el rojo claro del modo oscuro. Claro:
  mismos valores calculados que antes. Las severidades `secondary` no tienen un caso en esas dos
  pantallas: quedan cubiertas por la misma regla, sin revisión visual propia.
